'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Circle, 
  Download, 
  FileText, 
  Video, 
  ShieldAlert,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import WatermarkOverlay from '@/components/WatermarkOverlay';

export default function LearnPlayerPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(['lsn-asp-01']);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch user session
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      });

    // 2. Fetch course details
    fetch(`/api/courses/asp-examination-prep`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.course) {
          setCourse(data.course);
          if (data.course.lessons?.length > 0) {
            setActiveLesson(data.course.lessons[0]);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.courseId]);

  const toggleLessonComplete = (lessonId: string) => {
    if (completedLessonIds.includes(lessonId)) {
      setCompletedLessonIds(completedLessonIds.filter((id) => id !== lessonId));
    } else {
      setCompletedLessonIds([...completedLessonIds, lessonId]);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading secure player...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col">
      {/* Player Header */}
      <div className="bg-[#252c41] px-4 sm:px-8 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Link
            href="/student"
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <span className="text-xs font-semibold text-[#99cd92] truncate max-w-md">
            {course?.title || 'ASP Preparation'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="bg-[#4f8c4c] text-white px-2.5 py-1 rounded text-[10px] font-bold">
            SECURE ADAPTIVE STREAM
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Video & Content Column */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Protected Video Stage with Dynamic Watermark */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex items-center justify-center">
            {/* Dynamic Forensic Watermark Overlay */}
            <WatermarkOverlay
              userName={user?.name || 'Arjun Menon'}
              userEmail={user?.email || 'student@zealosh.com'}
            />

            {/* Video Element */}
            <video
              key={activeLesson?.id}
              controls
              className="w-full h-full object-contain"
              poster="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200"
            >
              <source
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Lesson Details & Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
            <div>
              <span className="text-xs text-[#99cd92] font-semibold">
                {activeLesson?.moduleTitle}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1">
                {activeLesson?.title}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleLessonComplete(activeLesson?.id)}
                className={`btn-primary text-xs py-2 px-4 ${
                  completedLessonIds.includes(activeLesson?.id)
                    ? 'bg-[#3a7536]'
                    : 'bg-[#4f8c4c]'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {completedLessonIds.includes(activeLesson?.id)
                    ? 'Completed'
                    : 'Mark as Complete'}
                </span>
              </button>
            </div>
          </div>

          {/* Downloadable Reference Materials */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#4f8c4c]" />
              Downloadable Lesson Materials & Quick Cards
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="font-semibold text-gray-200">
                    Zealosh ASP Formula Sheet & Quick Reference Card
                  </div>
                  <div className="text-[11px] text-gray-400">PDF • 1.2 MB</div>
                </div>
                <button
                  onClick={() => alert('Downloading official Zealosh formula reference card...')}
                  className="p-2 text-gray-400 hover:text-white"
                  title="Download File"
                >
                  <Download className="w-4 h-4 text-[#4f8c4c]" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="font-semibold text-gray-200">
                    Module 1 Study Notes & Problem Set Solutions
                  </div>
                  <div className="text-[11px] text-gray-400">PDF • 3.4 MB</div>
                </div>
                <button
                  onClick={() => alert('Downloading study notes...')}
                  className="p-2 text-gray-400 hover:text-white"
                  title="Download File"
                >
                  <Download className="w-4 h-4 text-[#4f8c4c]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lesson Curriculum Sidebar */}
        <div className="w-full lg:w-96 bg-[#252c41] border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Course Syllabus</h3>
            <span className="text-xs text-gray-400">
              {completedLessonIds.length} / {course?.lessons?.length || 3} Completed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-700/60">
            {course?.lessons?.map((lesson: any, i: number) => {
              const isActive = activeLesson?.id === lesson.id;
              const isCompleted = completedLessonIds.includes(lesson.id);

              return (
                <div
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                    isActive ? 'bg-[#3a7536]/30 border-l-4 border-[#4f8c4c]' : 'hover:bg-white/5'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLessonComplete(lesson.id);
                    }}
                    className="mt-0.5 text-gray-400 hover:text-[#4f8c4c]"
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-[#4f8c4c]" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">
                      {lesson.title}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {lesson.durationMinutes}m
                      </span>
                      <span>•</span>
                      <span>{lesson.moduleTitle}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
