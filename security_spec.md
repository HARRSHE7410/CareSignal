# Security Specification: CarePulse Clinical Monitor

## 1. Data Invariants
- **Care Requests**: Must have a valid `roomNumber` that exists in the `patients` collection with an `active` status.
- **Priority**: Must be one of `low`, `medium`, `high`, `critical`.
- **Status Transitions**: 
  - `CareRequest`: `pending` -> `resolved`.
  - `PatientProfile`: `active` -> `discharged`.
- **Immutability**: `roomNumber` and `timestamp` (for requests) cannot be changed after creation.
- **Verification**: All staff actions (writes to `patients`, updates to `requests`) require a valid nurse session (simulated via 1234 PIN in frontend, but rules will protect data). *Note: Since this is a demo environment, I will implement rules that expect certain auth states if they were to be fully integrated with Firebase Auth.*

## 2. The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Spoofing**: Patient in RM01 trying to delete RM02's profile.
2. **State Shortcutting**: Marking a clinical request as `resolved` without being an authorized nurse.
3. **Ghost Field Injection**: Adding `isEmergency: true` to a request that is not in the schema.
4. **ID Poisoning**: Creating a request with a 2MB string as the `roomNumber`.
5. **Vitals Tampering**: Patient trying to manually overwrite their `heartRate` history.
6. **Bulk Scrape**: Unauthorized access to `list` all patient records.
7. **Temporal Fraud**: Creating a request with a manual `timestamp` from 1999.
8. **Role Escalation**: Patient trying to create a new `StaffProfile`.
9. **Negative Metadata**: Setting patient `age` to -50.
10. **Shadow Deletion**: Deleting the `active` request of another room.
11. **Resource Exhaustion**: Sending 500 tags in a care request.
12. **Orphaned Writes**: Creating a care request without a link to an active room.

## 3. Test Runner (Draft Logic)
- `get(/databases/$(database)/documents/patients/RM01)` -> OK for RM01.
- `list(/databases/$(database)/documents/patients)` -> DENIED for RM01.
- `create(/databases/$(database)/documents/requests/...)` -> OK if `roomNumber` matches patient.
- `update(/databases/$(database)/documents/requests/REQ_ID)` -> DENIED for RM01 if setting `status` to `resolved`.

## 4. Red Team Audit
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|-------------------|--------------------|-------------------|
| patients   | Blocked: `documentID` must match access room. | `status` changes only via Nurse login. | String and Array size checks. |
| requests   | Blocked: `roomNumber` must match session. | Transitions forced to `resolved`. | Priority and Source enums. |
| (internal) | No unmapped collections. | All paths secured. | Default deny-all in place. |
