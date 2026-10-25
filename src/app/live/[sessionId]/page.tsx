'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Share2, 
  Users, 
  MessageSquare, 
  Hand, 
  Radio, 
  Send,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function LiveClassroomPage({ params }: { params: { sessionId: string } }) {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'STUDENT';
  const isInstructor = role === 'INSTRUCTOR' || role === 'SUPER_ADMIN';

  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([
    { sender: 'Vishnu Rajendran (Lead Mentor)', text: 'Welcome to today’s session! We are starting with Radiation inverse square law formulas.', time: '7:01 PM' },
    { sender: 'Arjun Menon', text: 'Good evening sir, ready with calculation worksheets.', time: '7:02 PM' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [attendees] = useState([
    { name: 'Vishnu Rajendran, CSP, CRSP', role: 'MODERATOR / LEAD INSTRUCTOR', status: 'Speaking' },
    { name: 'Arjun Menon (You)', role: 'STUDENT', status: 'Listening' },
    { name: 'Priya Sharma', role: 'STUDENT', status: 'Listening' },
    { name: 'Mohammed Farhan', role: 'STUDENT', status: 'Listening' },
    { name: 'Rahul Varma', role: 'STUDENT', status: 'Listening' },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages([
      ...chatMessages,
      {
        sender: isInstructor ? 'Vishnu Rajendran (Lead)' : 'Arjun Menon (You)',
        text: newMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col overflow-hidden">
      {/* BBB Top Bar */}
      <div className="bg-[#252c41] px-4 py-2.5 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave Classroom</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">
              LIVE • ASP Math & Ventilation Problem-Solving
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="bg-[#4f8c4c] text-white px-2.5 py-0.5 rounded text-[10px] font-bold">
            BIGBLUEBUTTON 2.7+ WEBRTC
          </span>
          <span className="text-gray-400 hidden sm:inline">Room: {params.sessionId}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Stage: Whiteboard & Presentation */}
        <div className="flex-1 flex flex-col p-4 bg-black/40 overflow-y-auto">
          <div className="flex-1 bg-[#252c41] rounded-xl border border-gray-700 p-6 flex flex-col justify-between relative shadow-2xl">
            {/* Whiteboard / Shared Slides */}
            <div>
              <div className="flex items-center justify-between border-b border-gray-700 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#4f8c4c]" />
                  <span className="font-bold text-sm text-[#99cd92]">
                    Zealosh Collaborative Multi-User Whiteboard
                  </span>
                </div>
                <span className="text-xs text-gray-400">Slide 4 of 24</span>
              </div>

              {/* Real HSE Problem Display */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-5 max-w-2xl mx-auto space-y-4">
                <div className="text-xs text-[#4f8c4c] font-bold uppercase tracking-wider">
                  Live Problem 4.2 — BCSP Math Review
                </div>
                <h2 className="text-lg font-bold text-white">
                  A radioactive source produces an exposure rate of 120 mR/hr at 2 meters. What is the exposure rate at 6 meters?
                </h2>
                <div className="p-4 bg-black/40 rounded-lg font-mono text-xs text-[#99cd92] space-y-1">
                  <div>// Inverse Square Law Equation:</div>
                  <div>I₁ / I₂ = (d₂)² / (d₁)²</div>
                  <div>120 / I₂ = (6)² / (2)² = 36 / 4 = 9</div>
                  <div className="text-white font-bold pt-1">{'>>>'} I₂ = 120 / 9 = 13.33 mR/hr</div>
                </div>
              </div>
            </div>

            {/* Stage Bottom: Instructor Camera PIP */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-20 bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-900">
                    Vishnu R. (Camera)
                  </div>
                  <div className="absolute bottom-1 left-1 bg-red-600 text-[9px] px-1 rounded text-white font-bold">
                    MIC ON
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white">Vishnu Rajendran (Presenter)</div>
                  <div className="text-gray-400 text-[11px]">Screen Sharing & Annotation Active</div>
                </div>
              </div>

              {isInstructor && (
                <div className="bg-[#4f8c4c]/20 border border-[#4f8c4c] text-[#99cd92] text-xs px-3 py-1.5 rounded-lg">
                  Moderator Controls Enabled
                </div>
              )}
            </div>
          </div>

          {/* Classroom Controls Toolbar */}
          <div className="mt-4 bg-[#252c41] rounded-xl border border-gray-700 p-3 flex items-center justify-center gap-3 sm:gap-6 shadow-md">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-3 rounded-full transition-colors ${
                micOn ? 'bg-[#4f8c4c] text-white' : 'bg-red-600/80 hover:bg-red-600 text-white'
              }`}
              title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-3 rounded-full transition-colors ${
                videoOn ? 'bg-[#4f8c4c] text-white' : 'bg-red-600/80 hover:bg-red-600 text-white'
              }`}
              title={videoOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setHandRaised(!handRaised)}
              className={`p-3 rounded-full transition-colors ${
                handRaised ? 'bg-yellow-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Raise Hand"
            >
              <Hand className="w-5 h-5" />
            </button>

            <button
              onClick={() => alert('Screen sharing permitted for presenter.')}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
              title="Share Screen"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Attendees & Live Chat */}
        <div className="w-full lg:w-80 bg-[#252c41] border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col shrink-0">
          {/* Attendees Box */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#4f8c4c]" />
                Attendees ({attendees.length})
              </span>
            </h3>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {attendees.map((att, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <span className="truncate text-gray-200 font-medium">{att.name}</span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 shrink-0">
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#4f8c4c]" />
              Public Chat
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {chatMessages.map((msg, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-[#99cd92]">{msg.sender}</span>
                    <span className="text-[10px] text-gray-400">{msg.time}</span>
                  </div>
                  <div className="text-gray-200">{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message or ask a question..."
                className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#4f8c4c]"
              />
              <button
                type="submit"
                className="p-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
