'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Share2, 
  Hand, 
  MessageSquare, 
  Users, 
  ArrowLeft, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileText, 
  AlertCircle,
  PenTool,
  Eraser,
  RotateCcw,
  Sparkles,
  FolderOpen,
  Download,
  Eye,
  Plus,
  Play,
  Calendar,
  Check
} from 'lucide-react';
import { LiveSession } from '@/types';

interface EnrichedLiveSession extends LiveSession {
  courseTitle?: string;
  courseSlug?: string;
  batchName?: string;
  instructor?: {
    id: string;
    name: string;
  };
  attendanceCount?: number;
}

export default function LiveClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [sessionData, setSessionData] = useState<EnrichedLiveSession | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Classroom WebRTC Controls State
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'attendees' | 'coursework' | 'materials'>('chat');

  // Live Session Teaching Materials Pack
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    displayName: '',
    presenterNotes: '',
    materialType: 'PDF',
    fileUrl: '',
    releaseCondition: 'PRE_CLASS',
    releaseOffsetMinutes: 15,
  });

  const fetchMaterials = () => {
    if (!sessionId) return;
    setMaterialsLoading(true);
    fetch(`/api/materials?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.materials) {
          setMaterials(data.materials);
        }
      })
      .catch(() => {})
      .finally(() => setMaterialsLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
    const interval = setInterval(fetchMaterials, 20000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleMaterialAction = async (materialId: string, action: string, extra?: any) => {
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        fetchMaterials();
      }
    } catch {}
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.title) return;
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: sessionData?.courseId || 'course-asp',
          batchId: sessionData?.batchId,
          sessionId,
          title: newMaterial.title,
          displayName: newMaterial.displayName || newMaterial.title,
          presenterNotes: newMaterial.presenterNotes,
          materialType: newMaterial.materialType,
          fileUrl: newMaterial.fileUrl || '/materials/sample.pdf',
          releaseCondition: newMaterial.releaseCondition,
          releaseOffsetMinutes: Number(newMaterial.releaseOffsetMinutes) || 0,
        }),
      });
      if (res.ok) {
        setShowAddMaterialModal(false);
        setNewMaterial({
          title: '',
          displayName: '',
          presenterNotes: '',
          materialType: 'PDF',
          fileUrl: '',
          releaseCondition: 'PRE_CLASS',
          releaseOffsetMinutes: 15,
        });
        fetchMaterials();
      }
    } catch {}
  };

  // Interactive Live Whiteboard State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#4f8c4c');
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [activeSlide, setActiveSlide] = useState(1);
  const totalSlides = 12;

  // Live Chat Stream State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string; isMentor?: boolean }>>([
    { sender: 'System', text: 'Welcome to Zealosh VC. Session audio and collaborative whiteboard are ready.', time: '09:00' },
    { sender: 'Vishnu Rajendran', text: 'Good morning everyone. Please have the LEV equation sheet open for Slide 4 calculations.', time: '09:02', isMentor: true },
    { sender: 'Arjun Menon', text: 'Understood sir. Calculator ready.', time: '09:04' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  // Attendees Roster
  const attendees = [
    { name: 'Vishnu Rajendran, CSP', role: 'INSTRUCTOR', isSpeaking: true, handRaised: false },
    { name: 'Arjun Menon', role: 'STUDENT', isSpeaking: false, handRaised: handRaised },
    { name: 'Priya Nambiar', role: 'STUDENT', isSpeaking: false, handRaised: false },
    { name: 'Karthik Varma', role: 'STUDENT', isSpeaking: false, handRaised: true },
    { name: 'Sanjay Kumar', role: 'STUDENT', isSpeaking: false, handRaised: false },
  ];

  // Live Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(1450);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((authData) => {
        if (authData?.user) setUser(authData.user);
      })
      .catch(() => {});

    fetch('/api/live')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        let found = false;
        if (data && Array.isArray(data.sessions)) {
          const match = data.sessions.find((s: any) => s.id === sessionId || s.meetingId === sessionId);
          if (match) {
            setSessionData(match);
            found = true;
          }
        }
        if (!found) {
          try {
            const detailRes = await fetch(`/api/live/${encodeURIComponent(sessionId)}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData?.session) {
                setSessionData(detailData.session);
              }
            }
          } catch {
            // Ignore
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // Setup Canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = activeTool === 'eraser' ? 16 : 3;
  }, [activeTool]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 20;
    } else {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    setChatMessages((prev) => [
      ...prev,
      {
        sender: user?.name || 'Student',
        text: inputMessage.trim(),
        time: timeStr,
        isMentor: user?.role === 'INSTRUCTOR'
      }
    ]);
    setInputMessage('');
  };

  const handleEndMeeting = async () => {
    if (!confirm('Are you sure you want to end this live session for all attendees?')) return;
    try {
      await fetch(`/api/live/${sessionId}/end`, { method: 'POST' });
    } catch {
      // Fallback redirect
    }
    router.push('/instructor');
  };

  const isInstructor = user?.role === 'INSTRUCTOR' || user?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f9f3] text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin w-10 h-10 border-4 border-[#4f8c4c] border-t-transparent rounded-full mb-4" />
        <p className="text-xs text-slate-600 font-bold tracking-wide">
          Connecting to Zealosh Virtual Classroom (Zealosh VC)...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f9f3] text-slate-900 flex flex-col overflow-hidden">
      {/* Official Zealosh VC Header Bar — Deep Forest Green */}
      <div className="bg-[#1e481c] px-4 py-2.5 flex items-center justify-between border-b border-emerald-900 shadow-sm text-white">
        <div className="flex items-center gap-3">
          <Link
            href={user?.role === 'INSTRUCTOR' ? '/instructor' : '/classroom'}
            className="text-xs text-emerald-100 hover:text-white flex items-center gap-1.5 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4 text-[#6fb76b]" />
            <span>Leave Classroom</span>
          </Link>
          <span className="text-emerald-700">|</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
              {sessionData?.title || 'Live Certification Workshop'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Recording & Session Duration Indicators */}
          <div className="hidden sm:flex items-center gap-2 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[11px] text-emerald-100 font-mono font-bold">REC {formatTimer(elapsedSeconds)}</span>
          </div>

          <span className="bg-[#4f8c4c] text-white px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shadow-xs">
            ZEALOSH VC WEBRTC
          </span>

          {isInstructor && (
            <button
              onClick={handleEndMeeting}
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors shadow-xs"
            >
              End Class
            </button>
          )}
        </div>
      </div>

      {/* Main Classroom Workspace Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Stage: Collaborative Whiteboard & Slides */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 bg-emerald-950/5 overflow-y-auto">
          <div className="flex-1 glass-card p-4 sm:p-6 flex flex-col justify-between relative shadow-lg border border-emerald-500/20">
            {/* Whiteboard Top Toolbar */}
            <div className="flex items-center justify-between border-b border-[#e2efe1] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
                <span className="font-bold text-xs sm:text-sm text-slate-800">
                  Zealosh Collaborative Stage & Whiteboard
                </span>
              </div>

              {/* Whiteboard Tools */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setActiveTool('pen')}
                  className={`p-1.5 rounded-lg transition-colors ${activeTool === 'pen' ? 'bg-[#4f8c4c] text-white shadow-xs' : 'text-slate-500 hover:text-[#4f8c4c] hover:bg-emerald-50'}`}
                  title="Pen Tool"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`p-1.5 rounded-lg transition-colors ${activeTool === 'eraser' ? 'bg-[#4f8c4c] text-white shadow-xs' : 'text-slate-500 hover:text-[#4f8c4c] hover:bg-emerald-50'}`}
                  title="Eraser"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Clear Whiteboard"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Color Selector */}
                <div className="flex items-center gap-1">
                  {['#4f8c4c', '#ef4444', '#0f172a', '#2ea033'].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setDrawColor(color);
                        setActiveTool('pen');
                      }}
                      className={`w-3.5 h-3.5 rounded-full border ${drawColor === color ? 'border-slate-800 scale-125' : 'border-slate-200'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="h-4 w-px bg-slate-200 mx-1" />

                <div className="text-[11px] text-slate-500 font-bold">
                  Slide {activeSlide} of {totalSlides}
                </div>
              </div>
            </div>

            {/* Interactive Whiteboard Canvas & Slide Material */}
            <div className="relative flex-1 min-h-[300px] sm:min-h-[380px] bg-white rounded-xl border border-emerald-500/20 overflow-hidden flex flex-col justify-center items-center p-4 shadow-inner">
              {/* Canvas Overlay for Live Drawing */}
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="absolute inset-0 w-full h-full cursor-crosshair z-10"
              />

              {/* Background Curriculum Slide */}
              <div className="relative z-0 max-w-xl text-center space-y-4 pointer-events-none select-none">
                <div className="text-[11px] text-[#4f8c4c] font-black uppercase tracking-wider">
                  {sessionData?.courseTitle || 'BCSP Certification Blueprint'} • Live Math Drill
                </div>
                <h3 className="text-base sm:text-xl font-black text-slate-900">
                  Radiation Safety & Chemical Bay LEV Problem Solving
                </h3>
                <div className="bg-[#f4f9f3] border border-emerald-300/80 rounded-xl p-4 font-mono text-xs text-[#245921] text-left space-y-1.5 shadow-xs">
                  <div className="text-slate-500 font-semibold">// Local Exhaust Ventilation (LEV) Hood Design:</div>
                  <div className="font-bold">Q = V * (10 * X² + A)</div>
                  <div>Where X = 1.2 ft capture distance, V = 100 FPM capture velocity</div>
                  <div className="text-slate-900 font-black pt-1">
                    {'>>> Minimum Airflow Required: Q = 1,840 CFM'}
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Bottom: Presenter PIP & Slide Navigator */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-20 bg-emerald-950 rounded-xl overflow-hidden border border-emerald-500/30 shadow-md">
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-emerald-100">
                    {sessionData?.instructor?.name?.split(',')[0] || 'Presenter'}
                  </div>
                  <div className="absolute bottom-1 left-1 bg-red-600 text-[9px] px-1 rounded text-white font-bold">
                    MIC LIVE
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{sessionData?.instructor?.name || 'Lead Instructor'}</span>
                    <span className="text-[10px] bg-[#e8f3e7] text-[#245921] px-1.5 rounded font-bold border border-emerald-300">FACULTY</span>
                  </div>
                  <div className="text-slate-500 text-[11px] font-medium">Screen Sharing & Collaborative Canvas Active</div>
                </div>
              </div>

              {/* Slide Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSlide((prev) => Math.max(1, prev - 1))}
                  disabled={activeSlide <= 1}
                  className="btn-outline text-xs py-1 px-2.5 text-slate-600 disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-xs text-slate-700 font-mono font-bold">
                  {activeSlide} / {totalSlides}
                </span>
                <button
                  onClick={() => setActiveSlide((prev) => Math.min(totalSlides, prev + 1))}
                  disabled={activeSlide >= totalSlides}
                  className="btn-outline text-xs py-1 px-2.5 text-slate-600 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Unified WebRTC Classroom Controls — Tactile Neumorphic Buttons */}
          <div className="mt-3 glass-panel rounded-2xl p-3 flex items-center justify-center gap-4 sm:gap-6 shadow-md border border-emerald-500/20">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-3 rounded-full transition-all shadow-sm ${
                micOn ? 'bg-[#4f8c4c] text-white hover:bg-[#3a7536]' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-3 rounded-full transition-all shadow-sm ${
                videoOn ? 'bg-[#4f8c4c] text-white hover:bg-[#3a7536]' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              title={videoOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setHandRaised(!handRaised)}
              className={`p-3 rounded-full transition-all shadow-sm ${
                handRaised ? 'bg-amber-500 text-white scale-105' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title={handRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setScreenSharing(!screenSharing);
                alert(screenSharing ? 'Screen sharing stopped.' : 'Screen sharing active for collaborative session.');
              }}
              className={`p-3 rounded-full transition-all shadow-sm ${
                screenSharing ? 'bg-[#2ea033] text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title="Share Screen"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Chat, Attendees Roster — Clean White Frosted Glass */}
        <div className="w-full lg:w-80 bg-white/95 backdrop-blur-md border-t lg:border-t-0 lg:border-l border-[#e2efe1] flex flex-col shrink-0">
          {/* Sidebar Tab Header */}
          <div className="flex items-center border-b border-[#e2efe1] text-xs font-semibold">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === 'chat'
                  ? 'border-[#4f8c4c] text-[#245921] font-bold bg-[#f1f8f0]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setSidebarTab('attendees')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === 'attendees'
                  ? 'border-[#4f8c4c] text-[#245921] font-bold bg-[#f1f8f0]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>People ({attendees.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('coursework')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === 'coursework'
                  ? 'border-[#4f8c4c] text-[#245921] font-bold bg-[#f1f8f0]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>

            <button
              onClick={() => setSidebarTab('materials')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === 'materials'
                  ? 'border-[#4f8c4c] text-[#245921] font-bold bg-[#f1f8f0]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Materials ({materials.length})</span>
            </button>
          </div>

          {/* Sidebar Tab Content */}
          <div className="flex-1 p-3 overflow-y-auto">
            {sidebarTab === 'chat' && (
              <div className="flex flex-col h-full justify-between">
                <div className="space-y-3 overflow-y-auto pr-1">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-bold ${msg.isMentor ? 'text-[#3a7536]' : 'text-slate-900'}`}>
                          {msg.sender}
                        </span>
                        {msg.isMentor && (
                          <span className="text-[9px] bg-[#e8f3e7] text-[#245921] px-1 rounded font-bold">FACULTY</span>
                        )}
                        <span className="text-[10px] text-slate-400">{msg.time}</span>
                      </div>
                      <div className={`p-2 rounded-xl text-slate-800 leading-relaxed shadow-xs ${msg.isMentor ? 'bg-[#f1f8f0] border border-emerald-200' : 'bg-slate-50 border border-slate-100'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-[#e2efe1] flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask doubt or share formula..."
                    className="neomorphic-input text-xs"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white rounded-lg transition-colors shadow-xs"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {sidebarTab === 'attendees' && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Roster in Classroom ({attendees.length})
                </div>
                {attendees.map((att, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl border border-[#e2efe1] bg-white flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#e8f3e7] text-[#245921] font-bold text-xs flex items-center justify-center border border-emerald-300">
                        {att.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{att.name}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{att.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {att.handRaised && (
                        <span title="Hand Raised">
                          <Hand className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                      {att.isSpeaking && (
                        <span className="w-2 h-2 rounded-full bg-[#4f8c4c] animate-pulse" title="Speaking" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === 'coursework' && (
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Live Workshop Study Material
                </div>
                <div className="p-3 rounded-xl border border-[#e2efe1] bg-[#fbfdfb] shadow-xs">
                  <div className="text-xs font-bold text-slate-900 mb-1">
                    LEV Capture Velocity Reference
                  </div>
                  <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                    Recommended capture velocities for particulate vs vapor contaminants under ACGIH guidelines.
                  </p>
                  <span className="text-[10px] font-bold text-[#4f8c4c] bg-[#e8f3e7] px-2 py-0.5 rounded border border-emerald-200">
                    ACGIH Standard
                  </span>
                </div>
              </div>
            )}

            {sidebarTab === 'materials' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Session Material Pack ({materials.length})
                  </div>
                  {user?.role !== 'STUDENT' && (
                    <button
                      onClick={() => setShowAddMaterialModal(true)}
                      className="text-[10px] font-bold text-white bg-[#4f8c4c] hover:bg-[#3a7536] px-2 py-1 rounded flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <Plus className="w-3 h-3" /> Preload
                    </button>
                  )}
                </div>

                {materialsLoading ? (
                  <div className="text-center py-6 text-xs text-slate-400">Loading teaching materials...</div>
                ) : materials.length === 0 ? (
                  <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs">
                    No teaching materials preloaded for this session.
                  </div>
                ) : (
                  materials.map((mat) => {
                    const isStaff = user?.role !== 'STUDENT';
                    const lifecycle = mat.lifecycleState || (mat.isReleased ? 'AVAILABLE' : 'SCHEDULED');
                    const badgeColor =
                      lifecycle === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : lifecycle === 'PRESENTED'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : lifecycle === 'POSTPONED'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : lifecycle === 'CANCELLED'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200';

                    return (
                      <div
                        key={mat.id}
                        className="p-3 rounded-xl border border-[#e2efe1] bg-white shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900 leading-tight">
                              {mat.displayName || mat.title}
                            </div>
                            {isStaff && mat.originalFilename && mat.originalFilename !== mat.displayName && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Original: {mat.originalFilename}
                              </div>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${badgeColor}`}>
                            {lifecycle}
                          </span>
                        </div>

                        {mat.description && (
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {mat.description}
                          </p>
                        )}

                        {isStaff && mat.presenterNotes && (
                          <div className="p-2 bg-amber-50/60 border border-amber-200/70 rounded-lg text-[10px] text-amber-900">
                            <span className="font-bold">Faculty Notes: </span>
                            {mat.presenterNotes}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                          <span className="text-slate-400 font-semibold uppercase">{mat.materialType || 'PDF'}</span>

                          <div className="flex items-center gap-1.5">
                            {isStaff ? (
                              <>
                                {!mat.isReleased && (
                                  <button
                                    onClick={() => handleMaterialAction(mat.id, 'release_now')}
                                    className="px-2 py-0.5 bg-[#4f8c4c] text-white rounded font-bold hover:bg-[#3a7536] transition-colors"
                                    title="Release to learners immediately"
                                  >
                                    Release Now
                                  </button>
                                )}
                                {mat.isReleased && lifecycle !== 'PRESENTED' && (
                                  <button
                                    onClick={() => handleMaterialAction(mat.id, 'present')}
                                    className="px-2 py-0.5 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 transition-colors"
                                  >
                                    Present
                                  </button>
                                )}
                                {lifecycle !== 'POSTPONED' && lifecycle !== 'CANCELLED' && (
                                  <button
                                    onClick={() => {
                                      const reason = prompt('Reason for postponing:');
                                      if (reason) handleMaterialAction(mat.id, 'postpone', { reason });
                                    }}
                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                                  >
                                    Postpone
                                  </button>
                                )}
                              </>
                            ) : (
                              mat.fileUrl && (
                                <a
                                  href={mat.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-[#4f8c4c] text-white rounded-md font-bold flex items-center gap-1 hover:bg-[#3a7536] transition-colors"
                                >
                                  <Eye className="w-3 h-3" /> View
                                </a>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add / Preload Material Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Preload Teaching Material</h3>
              <button
                onClick={() => setShowAddMaterialModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Display Name (Learner-Facing)</label>
                <input
                  type="text"
                  required
                  value={newMaterial.displayName}
                  onChange={(e) => setNewMaterial({ ...newMaterial, displayName: e.target.value, title: e.target.value })}
                  placeholder="e.g. Ventilation Formula Handout"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-[#4f8c4c]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Release Condition</label>
                <select
                  value={newMaterial.releaseCondition}
                  onChange={(e) => setNewMaterial({ ...newMaterial, releaseCondition: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-[#4f8c4c]"
                >
                  <option value="PRE_CLASS">PRE_CLASS (Available immediately)</option>
                  <option value="CLASS_START">CLASS_START (Auto-release when live class starts)</option>
                  <option value="ELAPSED_TIME">ELAPSED_TIME (Release after offset minutes)</option>
                  <option value="MANUAL">MANUAL (Instructor manual 1-click release)</option>
                </select>
              </div>

              {newMaterial.releaseCondition === 'ELAPSED_TIME' && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Release Offset (Minutes after start)</label>
                  <input
                    type="number"
                    min="1"
                    value={newMaterial.releaseOffsetMinutes}
                    onChange={(e) => setNewMaterial({ ...newMaterial, releaseOffsetMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-[#4f8c4c]"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Presenter Notes (Hidden from Learners)</label>
                <textarea
                  rows={2}
                  value={newMaterial.presenterNotes}
                  onChange={(e) => setNewMaterial({ ...newMaterial, presenterNotes: e.target.value })}
                  placeholder="e.g. Direct students to slide 4 calculation before revealing this handout"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-[#4f8c4c]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(false)}
                  className="px-3 py-1.5 rounded-lg border text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#4f8c4c] text-white font-bold hover:bg-[#3a7536]"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
