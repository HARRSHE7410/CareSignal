import { useEffect, useState } from 'react';
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Stethoscope, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Bath,
  Pill,
  Sparkles,
  Shirt,
  Activity,
  Shield,
  Plus,
  Mic,
  UserPlus,
  LogOut,
  Search,
  Trash2,
  X,
  Droplets,
  Bell,
  BookOpen,
  Users,
  Coffee,
  Heart,
  Wind,
  Music,
  Archive,
  History,
  Camera,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { cn } from './lib/utils';
import { 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Gemini Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// --- Types ---
type UserRole = 'nurse' | 'patient';

interface CareRequest {
  id: string;
  roomNumber: string;
  patientName?: string;
  patientPhoto?: string;
  need: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  instructions: string;
  aiNote?: string;
  tags: string[];
  status: 'pending' | 'resolved';
  timestamp: Timestamp;
  source: 'manual' | 'voice' | 'sensor' | 'vision';
}

interface PatientProfile {
  id?: string;
  roomNumber: string;
  name: string;
  age: number;
  gender: string;
  photoUrl: string;
  description: string;
  assignedNurse?: string;
  status: 'active' | 'discharged' | 'passed_away' | 'archived';
  vitals?: {
    heartRate: number;
    movement: number;
    history: { time: string; hr: number; mov: number }[];
  };
}

const CARE_OPTIONS = [
  { id: 'medicine', label: 'Medicine Assist', icon: Pill, category: 'Medical' },
  { id: 'wound', label: 'Wound Care', icon: Activity, category: 'Medical' },
  { id: 'hydration', label: 'Water / Juice', icon: Droplets, category: 'Comfort' },
  { id: 'sheets', label: 'Fresh Bedding', icon: Shirt, category: 'Comfort' },
  { id: 'baths', label: 'Bath Assist', icon: Bath, category: 'Hygiene' },
  { id: 'toilet', label: 'Toileting', icon: User, category: 'Hygiene' },
  { id: 'pain', label: 'Pain Relief', icon: Zap, category: 'Medical' },
  { id: 'garden', label: 'Garden Walk', icon: Wind, category: 'Activity' },
  { id: 'support', label: 'Emotional Support', icon: Heart, category: 'Support' },
  { id: 'reading', label: 'Reading Assist', icon: BookOpen, category: 'Support' },
  { id: 'prayer', label: 'Prayer / Meditation', icon: Sparkles, category: 'Support' },
  { id: 'social', label: 'Social Call', icon: Users, category: 'Activity' },
  { id: 'snack', label: 'Light Snack', icon: Coffee, category: 'Comfort' },
  { id: 'music', label: 'Listen to Music', icon: Music, category: 'Activity' },
];

const NURSE_NAMES = ["Sarah J.", "Robert M.", "Elena G.", "David K.", "Linda P."];

const AUTOMATIC_ALERTS = [
  { label: 'FALL DETECTED', priority: 'critical', instructions: 'SENSOR: GRAVITY IMPACT DETECTED', tags: ['auto', 'fall'] },
  { label: 'CARDIAC ANOMALY', priority: 'critical', instructions: 'SENSOR: IRREGULAR HEART RATE', tags: ['auto', 'heart'] },
];

// --- Vision AI Component ---
function VisionMonitor({ roomNumber, patientName }: { roomNumber: string, patientName: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let interval: any;
    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setStream(s);
        
        // Setup periodic Vision AI check
        interval = setInterval(async () => {
          if (!s) return;
          setScanning(true);
          try {
            // Capture frame from video
            const video = document.createElement('video');
            video.srcObject = s;
            await video.play();
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
            
            // Send to Gemini Vision
            const result = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: { 
                parts: [
                  { text: "Analyze this nursing home room camera frame. Detect emergencies: 1. Resident on floor (FAINT/FALL). 2. SOS hand gesture. 3. Unauthorized person/Trespassing. 4. Aggressive behavior. Respond ONLY in JSON: { detected: boolean, emergencyType: string | null, confidence: number, actionNote: string | null }" },
                  { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                ]
              }
            });

            const rawResponse = result.text || '{}';
            const cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanedResponse);
            if (analysis.detected && analysis.confidence > 0.7) {
              await addDoc(collection(db, 'requests'), {
                roomNumber,
                patientName,
                need: `AI VISION: ${analysis.emergencyType?.toUpperCase()}`,
                priority: 'critical',
                instructions: `VISION SENSOR DETECTED: ${analysis.actionNote}`,
                aiNote: "URGENT: Visual confirmation of emergency behavior. Dispatch immediate response.",
                status: 'pending',
                source: 'vision',
                timestamp: serverTimestamp(),
                tags: ['ai-vision', 'emergency']
              });
            }
          } catch (err) {
            console.error("Vision AI Error:", err);
          } finally {
            setScanning(false);
          }
        }, 45000); // Check every 45 seconds to conserve resources
      } catch (err) {
        console.error("Camera Setup Error:", err);
      }
    }
    setupCamera();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (interval) clearInterval(interval);
    };
  }, [roomNumber]);

  return (
    <div className="fixed bottom-6 right-6 w-56 aspect-video bg-slate-900 rounded-3xl border-4 border-white shadow-2xl overflow-hidden group z-50 transition-all hover:scale-105">
      {stream ? (
        <video autoPlay muted playsInline ref={el => { if (el) el.srcObject = stream; }} className="w-full h-full object-cover opacity-60" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
          <Camera size={24} className="mb-2" />
          <span className="text-[0.5rem] font-bold">OFFLINE</span>
        </div>
      )}
      <div className="absolute inset-0 border-2 border-white/10 rounded-xl" />
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", scanning ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
        <span className="text-[0.5rem] font-black text-white/50 tracking-widest">VISION ACTIVE</span>
      </div>
    </div>
  );
}

// --- App Component ---
export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('hospital_role');
    const savedRoom = localStorage.getItem('hospital_room');
    if (savedRole) setRole(savedRole as UserRole);
    if (savedRoom) setRoomNumber(savedRoom);
  }, []);

  const selectRole = (r: UserRole, room?: string) => {
    if (r === 'nurse' && !showPinInput) {
      setShowPinInput(true);
      return;
    }
    setRole(r);
    localStorage.setItem('hospital_role', r);
    if (room) {
      setRoomNumber(room);
      localStorage.setItem('hospital_room', room);
    }
  };

  const verifyPin = () => {
    if (pin === '1234') { 
      setRole('nurse');
      localStorage.setItem('hospital_role', 'nurse');
      setShowPinInput(false);
    } else {
      setNotification("INVALID STAFF ID OR PIN");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handlePatientAccess = async () => {
    if (!roomNumber) return;
    try {
      const q = query(collection(db, 'patients'), where('roomNumber', '==', roomNumber), where('status', '==', 'active'));
      const snap = await getDocs(q);
      if (snap.empty) {
        setNotification("ROOM NOT REGISTERED");
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      selectRole('patient', roomNumber);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'patients');
    }
  };

  const logout = () => {
    localStorage.clear();
    setRole(null);
    setRoomNumber('');
    setPin('');
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 sm:p-12 font-sans relative overflow-hidden text-slate-900 border-8 border-red-600">
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-4 shadow-xl rounded-xl flex items-center gap-3"
            >
              <AlertTriangle size={20} />
              <p className="text-sm font-bold tracking-wider uppercase">{notification}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-4xl w-full relative z-10">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <div className="bg-red-600 p-6 rounded-3xl shadow-lg border-4 border-white">
                <Stethoscope size={48} className="text-white" />
              </div>
            </div>
            <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-slate-900 leading-none font-agency">CARESIGNAL</h1>
            <p className="text-[#cd5c5c] font-bold tracking-[0.4em] uppercase text-sm mt-4">Compassionate Care • Individual Dignity</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => { if (!showPinInput) setShowPinInput(true); }}
              className="bg-white p-12 border-2 border-[#e9e0d8] cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group rounded-[3rem] relative"
            >
              <div className="w-20 h-20 rounded-full bg-[#cd5c5c] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-lg">
                <Shield size={32} className="text-white" />
              </div>
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter font-agency">STAFF TRIAGE</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Clinical & Social Protocols</p>
              
              {showPinInput && (
                <div className="w-full space-y-4" onClick={e => e.stopPropagation()}>
                   <input 
                    type="password" 
                    placeholder="PIN" 
                    value={pin}
                    onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-slate-50 border-b-4 border-[#cd5c5c] p-4 text-center tracking-[1em] focus:outline-none text-2xl font-black text-[#cd5c5c] rounded-xl"
                    autoFocus
                  />
                  <button onClick={verifyPin} className="w-full py-4 bg-[#cd5c5c] text-white font-bold text-xl uppercase tracking-widest hover:bg-slate-900 rounded-xl transition-all">VERIFY STAFF</button>
                  <button onClick={() => setShowPinInput(false)} className="text-xs font-bold text-[#cd5c5c] uppercase tracking-widest w-full mt-2">CANCEL</button>
                </div>
              )}
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-12 border-2 border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group rounded-[3rem]"
            >
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-lg">
                <User size={32} className="text-white" />
              </div>
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter font-agency">RESIDENT LOGIN</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Secure Resident Dashboard</p>
              
              <div className="w-full space-y-4 font-agency">
                 <input 
                  type="text" 
                  placeholder="ROOM NO" 
                  value={roomNumber}
                  onKeyDown={(e) => e.key === 'Enter' && handlePatientAccess()}
                  onChange={(e) => setRoomNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-100 border-b-4 border-slate-900 p-4 text-center text-3xl font-black focus:outline-none rounded-xl"
                 />
                 <button onClick={handlePatientAccess} disabled={!roomNumber} className="w-full py-4 bg-slate-900 text-white font-bold text-xl uppercase tracking-widest hover:bg-red-600 rounded-xl transition-all disabled:opacity-30">ACCESS</button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return role === 'patient' ? <PatientView roomNumber={roomNumber} logout={logout} /> : <NurseView logout={logout} />;
}

// --- Patient View ---
function PatientView({ roomNumber, logout }: { roomNumber: string, logout: () => void }) {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [roomRequests, setRoomRequests] = useState<CareRequest[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'patients'), where('roomNumber', '==', roomNumber));
    const unsubProfile = onSnapshot(q, (snap) => {
      if (!snap.empty) setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() } as PatientProfile);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'patients'));

    const qReq = query(
      collection(db, 'requests'), 
      where('roomNumber', '==', roomNumber), 
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    const unsubReq = onSnapshot(qReq, (snap) => {
      setRoomRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as CareRequest)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'requests'));

    return () => { unsubProfile(); unsubReq(); };
  }, [roomNumber]);

  const startVoice = () => {
    if (isListening) return;
    setIsListening(true);
    setTranscript('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotification("VOICE NOT SUPPORTED");
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        setTranscript(text);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Resident in nursing home says: "${text}". Analyze for health or safety emergencies.`,
            config: {
              systemInstruction: "Triage the resident's request. Identify emergencies (pain, chest, fall, stranger, fear). Return JSON: { priority: 'low'|'medium'|'high'|'critical', need: string, instructions: string, aiNote: string }.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
                  need: { type: Type.STRING },
                  instructions: { type: Type.STRING },
                  aiNote: { type: Type.STRING }
                },
                required: ["priority", "need", "instructions", "aiNote"]
              }
            }
          });
          
          const rawResponse = response.text || '{}';
          const cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const analysis = JSON.parse(cleanedResponse);
          await addDoc(collection(db, 'requests'), {
            roomNumber,
            patientName: profile?.name || 'Resident',
            ...analysis,
            status: 'pending',
            source: 'voice',
            timestamp: serverTimestamp()
          });
          setNotification(`${analysis.need.toUpperCase()} REQUESTED`);
        } catch (e) {
          console.error(e);
          setNotification("TRIAGE ERROR");
        }
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const submitManual = async (item: any) => {
    try {
      await addDoc(collection(db, 'requests'), {
        roomNumber,
        patientName: profile?.name || 'Resident',
        need: item.label.toUpperCase(),
        priority: 'medium',
        instructions: `Standard request for ${item.label}`,
        status: 'pending',
        source: 'manual',
        timestamp: serverTimestamp()
      });
      setNotification(`${item.label.toUpperCase()} REQUESTED`);
      setTimeout(() => setNotification(null), 3000);
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, 'requests');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans uppercase relative overflow-hidden">
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-3 rounded-xl shadow-lg font-bold flex items-center gap-3">
             <Bell size={20} /> {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-20 border-b-2 border-[#e9e0d8] px-6 sm:px-12 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#cd5c5c] text-white rounded-lg flex items-center justify-center font-black text-xl shadow-md font-agency">
               {roomNumber}
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-[#cd5c5c] font-agency ml-2">CARESIGNAL</h1>
         </div>
         <div className="flex gap-4">
            <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 px-4 py-2 border-2 border-[#e9e0d8] rounded-xl hover:bg-slate-50">
               <User size={24} className="text-[#cd5c5c]" />
               <span className="font-bold text-xs text-slate-900 hidden sm:block">{profile?.name || "MY SPACE"}</span>
            </button>
            <button onClick={logout} className="p-2 border-2 border-[#e9e0d8] rounded-xl text-[#cd5c5c] hover:bg-slate-900 hover:text-white transition-all"><LogOut size={24} /></button>
         </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 relative">
         <VisionMonitor roomNumber={roomNumber} patientName={profile?.name || 'Resident'} />
         
         <div className="bg-[#fcfaf8] border-2 border-[#e9e0d8] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm">
            <h2 className="text-4xl font-black mb-2 font-agency">VOICE COMMAND</h2>
            <p className="text-[#cd5c5c] text-[0.6rem] font-bold tracking-[0.3em] mb-8 uppercase">Speak Naturally • We Are Listening</p>
            
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all mb-4 relative",
              isListening ? "bg-slate-900 border-[#cd5c5c] scale-110 shadow-lg" : "bg-white border-[#e9e0d8] hover:border-[#cd5c5c] cursor-pointer"
            )} onClick={startVoice}>
               <Mic size={48} className={isListening ? "text-[#cd5c5c] animate-pulse" : "text-[#cd5c5c]"} />
               {isListening && <motion.div animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-[#cd5c5c]/20 rounded-full"></motion.div>}
            </div>
            <p className="text-xs font-bold text-slate-500">{isListening ? transcript || "LISTENING..." : "PRESS TO MESSAGE STAFF"}</p>
         </div>

         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {CARE_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => submitManual(opt)} className="aspect-square bg-white border-2 border-[#e9e0d8] p-4 flex flex-col items-center justify-center gap-2 rounded-2xl hover:border-[#cd5c5c] hover:bg-slate-50 transition-all shadow-sm group font-agency">
                <opt.icon size={32} className="text-[#cd5c5c] group-hover:scale-110 transition-transform" />
                <span className="text-[0.6rem] font-bold text-slate-900 text-center leading-tight tracking-wider">{opt.label}</span>
              </button>
            ))}
         </div>

         <div className="flex-1 border-t-2 border-slate-50 pt-6">
            <h3 className="text-xl font-black mb-4 font-agency tracking-widest text-slate-400">ACTIVE RESPONSES</h3>
            <div className="space-y-3">
               {roomRequests.length > 0 ? roomRequests.map(r => (
                 <div key={r.id} className={cn("p-4 border-l-8 bg-white rounded-r-xl shadow-sm flex items-center justify-between", r.priority === 'critical' ? "border-red-600 bg-red-50" : "border-slate-900")}>
                    <div>
                      <p className="text-lg font-black font-agency leading-none">{r.need}</p>
                      <p className="text-[0.5rem] font-bold text-slate-400 mt-1 uppercase">ESTIMATED ARRIVAL: 2M</p>
                    </div>
                    {r.priority === 'critical' && <AlertTriangle size={20} className="text-red-600 animate-pulse" />}
                 </div>
               )) : (
                 <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-sm tracking-[0.2em]">NO PENDING REQUESTS</div>
               )}
            </div>
         </div>
      </main>

      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-4 sm:inset-12 z-[100] bg-white border-4 border-[#e9e0d8] rounded-[2rem] p-8 shadow-2xl flex flex-col font-agency">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-5xl font-black font-agency text-slate-900">RESIDENT PROFILE</h3>
                <button onClick={() => setShowProfile(false)}><X size={32} /></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-8">
                <div className="flex gap-6 border-b-2 border-[#e9e0d8] pb-8">
                   <div className="w-32 h-40 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border-2 border-[#e9e0d8]"><User size={48} className="text-slate-300" /></div>
                   <div className="flex flex-col justify-center">
                      <p className="text-4xl font-black leading-none text-slate-900">{profile?.name || "ADMITTED"}</p>
                      <p className="text-xl text-[#cd5c5c] font-bold mt-2 uppercase">{profile?.age}Y • {profile?.gender}</p>
                      <div className="mt-4 p-3 bg-slate-50 border border-[#e9e0d8] rounded-xl">
                         <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Care Manager</p>
                         <p className="text-xl font-black text-slate-900">{profile?.assignedNurse || "STAFF ON CALL"}</p>
                      </div>
                   </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-[#e9e0d8]">
                   <p className="text-lg font-bold tracking-widest text-[#cd5c5c] mb-4 uppercase">Clinical Monitoring</p>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border-2 border-[#e9e0d8]">
                         <p className="text-[0.6rem] text-slate-400 font-bold uppercase">Biometric HR</p>
                         <p className="text-4xl font-black text-slate-900">{profile?.vitals?.heartRate} BPM</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border-2 border-[#e9e0d8]">
                         <p className="text-[0.6rem] text-slate-400 font-bold uppercase">Activity Level</p>
                         <p className="text-4xl font-black text-slate-900">{profile?.vitals?.movement}%</p>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Nurse View ---
function NurseView({ logout }: { logout: () => void }) {
  const [activeRequests, setActiveRequests] = useState<CareRequest[]>([]);
  const [resolvedRequests, setResolvedRequests] = useState<CareRequest[]>([]);
  const [allPatients, setAllPatients] = useState<PatientProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'patients' | 'history'>('requests');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showAdmission, setShowAdmission] = useState(false);
  const [admissionForm, setAdmissionForm] = useState({ 
    name: '', 
    roomNumber: '', 
    age: '', 
    gender: 'Male',
    description: '',
    photoUrl: ''
  });

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'patients'), orderBy('roomNumber', 'asc')), snap => {
      setAllPatients(snap.docs.map(d => ({ id: d.id, ...d.data() }) as PatientProfile));
    });
    
    const unsubR = onSnapshot(query(collection(db, 'requests'), where('status', '==', 'pending'), orderBy('timestamp', 'desc')), snap => {
      setActiveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CareRequest));
    });

    const unsubH = onSnapshot(query(collection(db, 'requests'), where('status', '==', 'resolved'), orderBy('timestamp', 'desc')), snap => {
      setResolvedRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CareRequest));
    });

    return () => { unsubP(); unsubR(); unsubH(); };
  }, []);

  const handleAdmission = async () => {
    if (!admissionForm.name || !admissionForm.roomNumber) return;
    
    try {
      // Check if there is already an active resident in this room
      const q = query(
        collection(db, 'patients'), 
        where('roomNumber', '==', admissionForm.roomNumber),
        where('status', '==', 'active')
      );
      const existingActive = await getDocs(q);
      
      if (!existingActive.empty) {
        setNotification(`ROOM ${admissionForm.roomNumber} IS CURRENTLY OCCUPIED`);
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      const randomNurse = NURSE_NAMES[Math.floor(Math.random() * NURSE_NAMES.length)];
      await addDoc(collection(db, 'patients'), {
        ...admissionForm,
        assignedNurse: randomNurse,
        age: parseInt(admissionForm.age) || 70,
        status: 'active',
        admittedAt: serverTimestamp(),
        vitals: { heartRate: 72, movement: 10, history: [] }
      });
      
      setShowAdmission(false);
      setAdmissionForm({ 
        name: '', 
        roomNumber: '', 
        age: '', 
        gender: 'Male',
        description: '',
        photoUrl: ''
      });
      setNotification("RESIDENT ENROLLED");
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, 'patients'); 
    }
  };

  const updateStatus = async (id: string, newStatus: PatientProfile['status']) => {
    try {
      await updateDoc(doc(db, 'patients', id), { status: newStatus });
      setNotification(`STATUS UPDATED`);
      setTimeout(() => setNotification(null), 2000);
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'patients'); }
  };

  const confirmDelete = async (id: string, name: string) => {
    const doubleCheck = window.confirm(`FINAL WARNING: Delete all records for ${name}? This cannot be undone.`);
    if (doubleCheck) {
      try {
        await deleteDoc(doc(db, 'patients', id));
        setNotification("RECORD PURGED");
        setTimeout(() => setNotification(null), 3000);
      } catch (e) { 
        handleFirestoreError(e, OperationType.DELETE, 'patients'); 
      }
    }
  };

  const resolve = async (id: string) => {
    try {
      await updateDoc(doc(db, 'requests', id), { status: 'resolved' });
      setNotification("COMPLETED");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'requests'); }
  };

  const filteredPatients = allPatients.filter(p => 
    (p.name.toUpperCase().includes(searchFilter.toUpperCase()) || p.roomNumber.includes(searchFilter)) &&
    (activeTab === 'requests' || searchFilter || p.status === 'active')
  );

  const historyPatients = allPatients.filter(p => p.status !== 'active');

  return (
    <div className="flex h-screen bg-slate-50 font-sans uppercase overflow-hidden text-slate-900">
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: -20, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-2 rounded-full border-b-4 border-red-600 shadow-xl font-bold flex items-center gap-2">
            <CheckCircle2 size={16} /> {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="w-64 sm:w-80 border-r-2 border-red-50 bg-white flex flex-col shrink-0 shadow-md">
        <div className="p-6 border-b-2 border-red-50 space-y-4">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600 rounded-xl text-white shadow-md"><Stethoscope size={24} /></div>
              <h1 className="text-3xl font-black font-agency tracking-tighter text-slate-900">CARESIGNAL</h1>
           </div>
           <p className="text-[0.6rem] font-bold text-red-600 tracking-[0.4em]">OPS TERMINAL</p>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
           <div className="bg-slate-900 text-white p-6 rounded-2xl border-b-8 border-red-600 flex justify-between items-end">
              <div>
                 <p className="text-[0.6rem] font-bold text-red-400 tracking-widest mb-1">LIVE CALLS</p>
                 <p className="text-5xl font-black font-agency leading-none">{activeRequests.length}</p>
              </div>
              <Activity size={32} className="text-red-500" />
           </div>
           
           <div className="space-y-2 pt-4 font-agency">
              <button onClick={() => setActiveTab('requests')} className={cn("w-full text-left px-6 py-3 font-black text-2xl rounded-xl transition-all", activeTab === 'requests' ? "bg-red-600 text-white shadow-md" : "text-slate-300 hover:bg-red-50 hover:text-red-600")}>LIVE FEED</button>
              <button onClick={() => setActiveTab('patients')} className={cn("w-full text-left px-6 py-3 font-black text-2xl rounded-xl transition-all", activeTab === 'patients' ? "bg-red-600 text-white shadow-md" : "text-slate-300 hover:bg-red-50 hover:text-red-600")}>RESIDENTS</button>
              <button onClick={() => setActiveTab('history')} className={cn("w-full text-left px-6 py-3 font-black text-2xl rounded-xl transition-all", activeTab === 'history' ? "bg-red-600 text-white shadow-md" : "text-slate-300 hover:bg-red-50 hover:text-red-600")}>LOG HISTORY</button>
           </div>
        </div>

        <button onClick={logout} className="m-4 py-4 border-2 border-slate-100 rounded-xl text-xs font-bold tracking-widest hover:bg-slate-900 hover:text-white transition-all uppercase">LOGOUT</button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b-2 border-red-50 px-6 flex items-center justify-between bg-white shrink-0 shadow-sm">
           <div className="flex items-center gap-4 flex-1 max-w-lg">
              <Search size={24} className="text-slate-300" />
              <input type="text" placeholder="SEARCH DATABASE..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full bg-transparent text-2xl font-black font-agency placeholder:text-slate-100 outline-none" />
           </div>
           <button onClick={() => setShowAdmission(true)} className="bg-red-600 text-white px-6 py-2 rounded-xl text-lg font-black font-agency tracking-widest hover:bg-slate-900 transition-all border-b-4 border-red-800">ADMIT</button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === 'requests' ? (
            <div className="space-y-4 max-w-4xl mx-auto">
              {activeRequests.map(r => (
                <motion.div layout key={r.id} className={cn("p-6 bg-white border-2 border-[#e9e0d8] flex items-start gap-6 rounded-2xl shadow-sm relative group", r.priority === 'critical' && "border-[#cd5c5c] border-b-8")}>
                   <div className="w-20 h-24 bg-slate-50 rounded-xl flex flex-col items-center justify-center shrink-0 border-2 border-[#e9e0d8] relative font-agency">
                      <span className="text-3xl font-black leading-none text-slate-900">{r.roomNumber}</span>
                      <span className="text-[0.5rem] font-bold text-slate-400 uppercase tracking-tighter">Room</span>
                      {r.source === 'vision' && <div className="mt-2 bg-red-100 p-1 rounded-md text-red-600"><Eye size={16} /></div>}
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                         <span className={cn("px-2 py-0.5 rounded text-[0.5rem] font-black uppercase tracking-widest", 
                           r.priority === 'critical' ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500")}>
                           {r.priority}
                         </span>
                         <span className="text-[0.6rem] font-bold text-slate-400">{r.source.toUpperCase()}</span>
                      </div>
                      <h3 className="text-3xl font-black font-agency leading-none text-slate-900">{r.need}</h3>
                      <p className="text-sm font-bold text-slate-600 mt-2 uppercase tracking-tight">{r.instructions}</p>
                      
                      {r.aiNote && (
                        <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-600 rounded-lg">
                           <p className="text-[0.5rem] font-black text-red-600 uppercase mb-1 flex items-center gap-1"><ShieldAlert size={10} /> AI DIAGNOSIS</p>
                           <p className="text-xs font-bold text-red-800 leading-tight italic">{r.aiNote}</p>
                        </div>
                      )}
                   </div>
                   <div className="flex flex-col gap-2">
                      <button onClick={() => resolve(r.id)} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold font-agency border-b-4 border-slate-700 hover:bg-[#cd5c5c] transition-all">RESOLVE</button>
                      <button onClick={() => setSelectedPatient(allPatients.find(p => p.roomNumber === r.roomNumber) || null)} className="text-[0.5rem] font-bold text-slate-400 hover:text-slate-900 transition-all underline">BIO-DATA</button>
                   </div>
                </motion.div>
              ))}
              {activeRequests.length === 0 && <div className="h-64 flex flex-col items-center justify-center text-slate-200 uppercase font-black tracking-[0.3em] font-agency"><CheckCircle2 size={64} className="mb-4 opacity-10" /> RESIDENCE SECURE</div>}
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-4 max-w-4xl mx-auto">
               <h2 className="text-4xl font-black font-agency tracking-widest text-slate-300 mb-8 uppercase">COMPLETED CARE LOG</h2>
               <div className="grid grid-cols-1 gap-3">
                  {resolvedRequests.map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-xl border-2 border-slate-50 flex items-center justify-between opacity-70 hover:opacity-100 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="text-2xl font-black font-agency text-slate-900">{r.roomNumber}</div>
                          <div>
                             <p className="text-sm font-black font-agency uppercase leading-none">{r.need}</p>
                             <p className="text-[0.5rem] font-bold text-slate-400 uppercase tracking-widest">PATIENT: {r.patientName}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-[0.5rem] font-bold text-slate-300">{new Date(r.timestamp?.toDate()).toLocaleTimeString()}</span>
                          <CheckCircle2 size={20} className="text-emerald-500" />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPatients.filter(p => p.status === 'active').map(p => (
                  <div key={p.id} className="bg-white border-2 border-[#e9e0d8] p-6 rounded-2xl shadow-sm flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center border-2 border-[#e9e0d8]"><User size={24} className="text-slate-300" /></div>
                        <div className="flex gap-2">
                           <button onClick={() => updateStatus(p.id!, 'archived')} title="Archive" className="text-slate-300 hover:text-slate-900"><Archive size={20} /></button>
                           <button onClick={() => confirmDelete(p.id!, p.name)} title="Delete" className="text-slate-200 hover:text-red-600"><Trash2 size={20} /></button>
                        </div>
                     </div>
                     <div>
                        <p className="text-[0.6rem] font-bold text-[#cd5c5c] tracking-widest leading-none mb-1">RM {p.roomNumber}</p>
                        <h3 className="text-2xl font-black font-agency leading-tight tracking-tight text-slate-900">{p.name}</h3>
                        <p className="text-[0.6rem] font-bold text-slate-400 mt-1 uppercase">Care: {p.assignedNurse}</p>
                     </div>
                     <div className="flex justify-between items-center mt-2">
                        <select 
                          value={p.status}
                          onChange={(e) => updateStatus(p.id!, e.target.value as any)}
                          className="bg-slate-50 text-[0.6rem] font-bold px-2 py-1 rounded border border-[#e9e0d8] outline-none"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="discharged">DISCHARGED</option>
                          <option value="passed_away">PASSED AWAY</option>
                          <option value="archived">ARCHIVED</option>
                        </select>
                        <button onClick={() => setSelectedPatient(p)} className="text-[0.6rem] font-bold underline underline-offset-4 tracking-widest text-slate-900 hover:text-[#cd5c5c] transition-all">ANALYSIS</button>
                     </div>
                  </div>
                ))}
              </div>

              {historyPatients.length > 0 && (
                <div className="pt-12 border-t-4 border-[#e9e0d8]">
                   <h3 className="text-3xl font-black font-agency tracking-[0.2em] text-slate-300 mb-8 uppercase">Historical Records</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {historyPatients.map(p => (
                        <div key={p.id} className="bg-slate-50/50 border-2 border-dashed border-[#e9e0d8] p-6 rounded-2xl opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                           <div className="flex justify-between items-center mb-4">
                              <span className={cn(
                                "text-[0.5rem] font-bold px-2 py-0.5 rounded uppercase tracking-widest",
                                p.status === 'passed_away' ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                              )}>
                                {p.status.replace('_', ' ')}
                              </span>
                              <button onClick={() => updateStatus(p.id!, 'active')} className="text-[0.5rem] font-bold underline">RESTORE</button>
                           </div>
                           <h3 className="text-xl font-black font-agency text-slate-900">{p.name}</h3>
                           <p className="text-[0.5rem] font-bold text-slate-400 uppercase">Room {p.roomNumber}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPatient(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative bg-white w-full max-w-lg p-8 rounded-[3rem] shadow-2xl border-4 border-slate-50 flex flex-col max-h-[90vh] overflow-hidden">
               <div className="flex justify-between items-start mb-6 border-b-2 border-red-50 pb-4 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-100 shrink-0">
                        <img 
                          src={selectedPatient.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                     </div>
                     <div>
                        <h3 className="text-3xl font-black font-agency tracking-tighter uppercase leading-none">{selectedPatient.name}</h3>
                        <p className="text-[0.6rem] font-bold text-red-600 mt-1 uppercase tracking-widest">{selectedPatient.age}Y • {selectedPatient.roomNumber}</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={24} /></button>
               </div>

               <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  {selectedPatient.description && (
                    <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                       <p className="text-[0.6rem] font-bold text-slate-400 tracking-widest mb-1 uppercase">CARE SUMMARY</p>
                       <p className="text-sm font-bold text-slate-700 normal-case italic">"{selectedPatient.description}"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-red-50 p-6 rounded-2xl text-center border-2 border-red-100">
                        <p className="text-[0.6rem] font-bold text-red-400 tracking-widest uppercase">BIOMETRIC HR</p>
                        <p className="text-5xl font-black font-agency text-red-600">{selectedPatient.vitals?.heartRate || 72}</p>
                     </div>
                     <div className="bg-slate-900 p-6 rounded-2xl text-center">
                        <p className="text-[0.6rem] font-bold text-red-400 tracking-widest uppercase">MOBILITY</p>
                        <p className="text-5xl font-black font-agency text-white">{selectedPatient.vitals?.movement || 0}%</p>
                     </div>
                  </div>

                  <div className="h-40 w-full bg-slate-50 rounded-2xl p-2 border-2 border-red-50">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedPatient.vitals?.history || []}>
                           <Area type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={4} fill="#fee2e2" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center gap-2 mb-2">
                        <History size={16} className="text-red-600" />
                        <h4 className="text-xl font-black font-agency tracking-widest text-slate-400 uppercase">INDIVIDUAL CARE LOG</h4>
                     </div>
                     {resolvedRequests.filter(r => r.roomNumber === selectedPatient.roomNumber).length > 0 ? (
                        resolvedRequests.filter(r => r.roomNumber === selectedPatient.roomNumber).map(log => (
                           <div key={log.id} className="p-3 bg-white border-2 border-slate-50 rounded-xl flex items-center justify-between">
                              <p className="text-xs font-black font-agency text-slate-900 uppercase">{log.need}</p>
                              <span className="text-[0.5rem] font-bold text-slate-300">{new Date(log.timestamp?.toDate()).toLocaleDateString()}</span>
                           </div>
                        ))
                     ) : (
                        <p className="text-center py-8 text-slate-200 font-bold text-xs uppercase tracking-widest">No previous requests tracked</p>
                     )}
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdmission && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdmission(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative bg-white w-full max-w-sm p-8 rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh]">
                <h2 className="text-4xl font-black mb-8 uppercase font-agency tracking-widest shrink-0">ADMISSION</h2>
                <div className="space-y-4 mb-8 font-agency overflow-y-auto pr-2 custom-scrollbar">
                   <div>
                      <p className="text-[0.6rem] font-bold text-red-600 ml-1 mb-1 tracking-widest">ESSENTIAL INFO</p>
                      <div className="space-y-2">
                         <input type="text" placeholder="ROOM NUMBER" value={admissionForm.roomNumber} onChange={e => setAdmissionForm({...admissionForm, roomNumber: e.target.value.toUpperCase()})} className="w-full bg-slate-100 p-4 font-black text-2xl uppercase rounded-xl border-2 border-white focus:border-red-600 transition-all outline-none" />
                         <input type="text" placeholder="FULL NAME" value={admissionForm.name} onChange={e => setAdmissionForm({...admissionForm, name: e.target.value.toUpperCase()})} className="w-full bg-slate-100 p-4 font-black text-2xl uppercase rounded-xl border-2 border-white focus:border-red-600 transition-all outline-none" />
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="AGE" value={admissionForm.age} onChange={e => setAdmissionForm({...admissionForm, age: e.target.value})} className="w-full bg-slate-100 p-4 font-black text-2xl uppercase rounded-xl border-2 border-white focus:border-red-600 transition-all outline-none" />
                      <select value={admissionForm.gender} onChange={e => setAdmissionForm({...admissionForm, gender: e.target.value})} className="w-full bg-slate-100 p-4 font-black text-xl uppercase rounded-xl border-2 border-white outline-none">
                         <option value="Male">Male</option>
                         <option value="Female">Female</option>
                         <option value="Other">Other</option>
                      </select>
                   </div>

                   <div>
                      <p className="text-[0.6rem] font-bold text-red-600 ml-1 mb-1 tracking-widest">CARE NOTES (OPTIONAL)</p>
                      <textarea 
                        placeholder="ENTER PATIENT BACKGROUND..." 
                        value={admissionForm.description} 
                        onChange={e => setAdmissionForm({...admissionForm, description: e.target.value})} 
                        className="w-full bg-slate-100 p-4 font-bold text-sm rounded-xl border-2 border-white focus:border-red-600 transition-all outline-none h-24 resize-none normal-case"
                      />
                   </div>

                   <div>
                      <p className="text-[0.6rem] font-bold text-red-600 ml-1 mb-1 tracking-widest">PROFILE PIC (URL)</p>
                      <input type="url" placeholder="HTTPS://IMAGE.URL" value={admissionForm.photoUrl} onChange={e => setAdmissionForm({...admissionForm, photoUrl: e.target.value})} className="w-full bg-slate-100 p-4 font-bold text-sm rounded-xl border-2 border-white focus:border-red-600 transition-all outline-none normal-case" />
                   </div>
                </div>
                <button onClick={handleAdmission} className="w-full py-4 bg-red-600 text-white font-black text-3xl font-agency rounded-xl border-b-8 border-red-800 hover:bg-slate-900 transition-all shrink-0">SUBMIT</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
