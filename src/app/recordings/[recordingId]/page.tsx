'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download, 
  Lock, 
  Bookmark, 
  FileText, 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Share2
} from 'lucide-react';
import { ClassRecording, RecordingHighlight, RecordingResource, RecordingDoubt } from '@/types';

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function RecordingPlayerPage({ params }: { params: { recordingId: string } }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [recording, setRecording] = useState<ClassRecording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'chapters' | 'resources' | 'doubts'>('chapters');

  // Doubt submission state
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtTimestamp, setDoubtTimestamp] = useState(0);
  const [doubtIsPublic, setDoubtIsPublic] = useState(false);
  const [submittingDoubt, setSubmittingDoubt] = useState(false);
  const [doubtSuccess, setDoubtSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recordings/${params.recordingId}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load recording');
        }
        return res.json();
      })
      .then((data) => {
        if (data?.recording) {
          setRecording(data.recording);
          setDuration(data.recording.durationSeconds || 7200);
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.recordingId, router]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const jumpToSeconds = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      setCurrentTime(sec);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const captureDoubtTimestamp = () => {
    setDoubtTimestamp(Math.floor(currentTime));
    setActiveTab('doubts');
  };

  const handleDoubtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtQuestion.trim()) return;

    setSubmittingDoubt(true);
    try {
      const res = await fetch(`/api/recordings/${params.recordingId}/doubts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestampSeconds: doubtTimestamp,
          question: doubtQuestion.trim(),
          isPublic: doubtIsPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit doubt');

      if (recording) {
        setRecording({
          ...recording,
          doubts: [...(recording.doubts || []), data.doubt],
        });
      }

      setDoubtQuestion('');
      setDoubtSuccess('Doubt submitted directly to course instructor at current timestamp!');
      setTimeout(() => setDoubtSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingDoubt(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 max-w-7xl mx-auto px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading class recording and syllabus chapters...</p>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="py-20 max-w-2xl mx-auto px-4 text-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 shadow-sm">
          <Lock className="w-10 h-10 mx-auto text-red-500 mb-3" />
          <h2 className="text-xl font-bold mb-2">Recording Access Restricted</h2>
          <p className="text-sm text-red-600 mb-6">
            {error || 'You do not have access to stream or download this recording under your enrolled cohort policy.'}
          </p>
          <Link
            href="/student"
            className="btn-primary inline-flex items-center gap-2 text-xs font-bold py-2.5 px-5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111622] text-white flex flex-col">
      {/* Top Header */}
      <div className="bg-[#1a2133] border-b border-gray-800 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-xs font-bold text-gray-200 truncate max-w-md">
            {recording.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {recording.isDownloadable ? (
            <a
              href={`/api/recordings/${recording.id}/stream?download=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#2a364f] hover:bg-[#354563] text-gray-200 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Download MP4</span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">
              <Lock className="w-3.5 h-3.5 text-yellow-500" />
              <span>Streaming Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Video Canvas & Controls */}
        <div className="flex-1 flex flex-col bg-black/60 p-4 sm:p-6 overflow-y-auto">
          {/* Video Container */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex items-center justify-center group">
            {/* Native / Mock Video Element */}
            <video
              ref={videoRef}
              src={`/api/recordings/${recording.id}/stream`}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
              playsInline
            />

            {/* Overlay Play/Pause Big Button if paused */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute w-20 h-20 bg-[#4f8c4c]/90 hover:bg-[#4f8c4c] rounded-full flex items-center justify-center text-white shadow-2xl transition-transform transform hover:scale-105"
              >
                <Play className="w-8 h-8 ml-1" />
              </button>
            )}

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Progress Slider */}
              <div className="relative w-full h-2 bg-gray-700 rounded-lg cursor-pointer mb-3">
                <div
                  className="h-full bg-[#4f8c4c] rounded-lg"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
                {/* Visual Chapter Markers */}
                {recording.highlights?.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpToSeconds(hl.startTimestampSeconds);
                    }}
                    title={`${hl.title} (${formatSeconds(hl.startTimestampSeconds)})`}
                    style={{ left: `${(hl.startTimestampSeconds / (duration || 1)) * 100}%` }}
                    className="absolute top-[-3px] w-2 h-3.5 bg-yellow-400 hover:bg-yellow-300 rounded-sm cursor-pointer z-10 shadow"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-300">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="hover:text-white transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (videoRef.current) videoRef.current.muted = !isMuted;
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <span className="font-mono text-[11px]">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Speed Controls */}
                  <div className="flex items-center gap-1 bg-gray-800/80 rounded px-1.5 py-0.5 border border-gray-700">
                    {[1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          playbackRate === s ? 'bg-[#4f8c4c] text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={captureDoubtTimestamp}
                    className="btn-primary text-[10px] font-bold py-1 px-2.5 bg-yellow-600 hover:bg-yellow-500 text-white flex items-center gap-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Ask Doubt at {formatSeconds(currentTime)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Title & Metadata Details */}
          <div className="mt-6 bg-[#1a2133] rounded-2xl p-6 border border-gray-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white">{recording.title}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  Recorded Live Classroom • Batch: {recording.batchId} • Course: {recording.courseId}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-[#4f8c4c]/20 text-[#99cd92] text-xs font-bold px-3 py-1 rounded-full border border-[#4f8c4c]/30">
                  DURATION: {formatSeconds(duration)}
                </span>
                <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
                  {recording.storageProvider}
                </span>
              </div>
            </div>

            {recording.description && (
              <p className="text-sm text-gray-300 leading-relaxed">{recording.description}</p>
            )}
          </div>
        </div>

        {/* Right Sidebar: Chapters, Resources & Doubts */}
        <div className="w-full lg:w-96 bg-[#1a2133] border-l border-gray-800 flex flex-col h-[500px] lg:h-auto">
          {/* Sidebar Nav Tabs */}
          <div className="flex border-b border-gray-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('chapters')}
              className={`flex-1 py-3 px-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'chapters'
                  ? 'border-b-2 border-[#4f8c4c] text-white bg-gray-800/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Chapters ({recording.highlights?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`flex-1 py-3 px-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'resources'
                  ? 'border-b-2 border-[#4f8c4c] text-white bg-gray-800/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Resources ({recording.resources?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('doubts')}
              className={`flex-1 py-3 px-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'doubts'
                  ? 'border-b-2 border-[#4f8c4c] text-white bg-gray-800/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
              <span>Doubts ({recording.doubts?.length || 0})</span>
            </button>
          </div>

          {/* Tab 1: Chapters & Highlights */}
          {activeTab === 'chapters' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                Curated Revision Topics & Moments
              </div>

              {(!recording.highlights || recording.highlights.length === 0) ? (
                <div className="text-center py-10 text-gray-500 text-xs">
                  No instructor chapters created for this class yet.
                </div>
              ) : (
                recording.highlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={() => jumpToSeconds(hl.startTimestampSeconds)}
                    className="p-3 bg-gray-800/40 hover:bg-gray-800 rounded-xl border border-gray-700/60 cursor-pointer transition-all hover:border-[#4f8c4c]/50 group"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                      <span className="group-hover:text-[#99cd92] transition-colors">{hl.title}</span>
                      <span className="font-mono text-[10px] bg-black/40 text-yellow-400 px-2 py-0.5 rounded">
                        {formatSeconds(hl.startTimestampSeconds)} - {formatSeconds(hl.endTimestampSeconds)}
                      </span>
                    </div>
                    {hl.description && (
                      <p className="text-[11px] text-gray-400 leading-snug">{hl.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Resources & Documents */}
          {activeTab === 'resources' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                Attached Formulas, Slides & References
              </div>

              {(!recording.resources || recording.resources.length === 0) ? (
                <div className="text-center py-10 text-gray-500 text-xs">
                  No reference materials attached to this class.
                </div>
              ) : (
                recording.resources.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/60 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                          {res.resourceType}
                        </span>
                        <h4 className="text-xs font-bold text-white">{res.title}</h4>
                      </div>
                      {res.description && (
                        <p className="text-[11px] text-gray-400 mb-1">{res.description}</p>
                      )}
                      {res.timestampSeconds !== undefined && res.timestampSeconds !== null && (
                        <button
                          onClick={() => jumpToSeconds(res.timestampSeconds!)}
                          className="text-[10px] text-yellow-400 hover:underline flex items-center gap-1"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>Referenced at {formatSeconds(res.timestampSeconds)}</span>
                        </button>
                      )}
                    </div>

                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-700 hover:bg-[#4f8c4c] text-white rounded-lg transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Interactive Doubts Feed & Submission */}
          {activeTab === 'doubts' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Doubt Submission Form */}
              <form onSubmit={handleDoubtSubmit} className="bg-gray-800/60 p-3 rounded-xl border border-gray-700 mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-yellow-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Doubt at {formatSeconds(doubtTimestamp)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDoubtTimestamp(Math.floor(currentTime))}
                    className="text-[10px] text-gray-400 hover:text-white underline"
                  >
                    Sync to Current Time ({formatSeconds(currentTime)})
                  </button>
                </div>

                <textarea
                  value={doubtQuestion}
                  onChange={(e) => setDoubtQuestion(e.target.value)}
                  placeholder="Ask a technical or formula doubt at this timestamp..."
                  rows={2}
                  className="w-full bg-[#111622] text-xs text-white p-2.5 rounded-lg border border-gray-700 focus:border-[#4f8c4c] focus:outline-none resize-none mb-2"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doubtIsPublic}
                      onChange={(e) => setDoubtIsPublic(e.target.checked)}
                      className="rounded text-[#4f8c4c] focus:ring-0"
                    />
                    <span>Share with cohort</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submittingDoubt || !doubtQuestion.trim()}
                    className="btn-primary text-xs py-1.5 px-3 bg-[#4f8c4c] hover:bg-[#3a7536] text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>Submit</span>
                  </button>
                </div>

                {doubtSuccess && (
                  <p className="text-[11px] text-green-400 mt-2 font-medium">{doubtSuccess}</p>
                )}
              </form>

              {/* Doubts List */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {(!recording.doubts || recording.doubts.length === 0) ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No doubts asked at this class yet. Ask above to get mentor feedback!
                  </div>
                ) : (
                  recording.doubts.map((dbt) => (
                    <div
                      key={dbt.id}
                      className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <button
                          onClick={() => jumpToSeconds(dbt.timestampSeconds)}
                          className="font-mono text-yellow-400 hover:underline flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{formatSeconds(dbt.timestampSeconds)}</span>
                        </button>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            dbt.status === 'RESOLVED'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}
                        >
                          {dbt.status}
                        </span>
                      </div>

                      <p className="text-xs text-white leading-relaxed">{dbt.question}</p>

                      {/* Instructor Answers */}
                      {dbt.answers && dbt.answers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-700/60 space-y-1.5">
                          {dbt.answers.map((ans) => (
                            <div key={ans.id} className="bg-black/30 p-2 rounded-lg text-[11px]">
                              <div className="flex items-center gap-1 text-[#99cd92] font-bold text-[10px] mb-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Instructor Answer ({ans.instructorName || 'Lead Mentor'})</span>
                              </div>
                              <p className="text-gray-200">{ans.answerText}</p>
                              {ans.referenceUrl && (
                                <a
                                  href={ans.referenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline inline-flex items-center gap-1 mt-1 text-[10px]"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>Reference Link</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
