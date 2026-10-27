'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Clock, 
  Bookmark, 
  BookmarkCheck, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Award,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';

export default function ExamAttemptPage({ params }: { params: { examId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptIdParam = searchParams.get('attemptId');

  const [attemptId, setAttemptId] = useState<string>(attemptIdParam || '');
  const [blueprint, setBlueprint] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [deadlineTime, setDeadlineTime] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins default
  const [submitting, setSubmitting] = useState(false);
  const [examResult, setExamResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('Saved');

  // Load Exam Attempt
  useEffect(() => {
    const initExam = async () => {
      try {
        let attId = attemptId;
        if (!attId) {
          const res = await fetch(`/api/exams/${params.examId}/start`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          attId = data.attemptId;
          setAttemptId(attId);
          setBlueprint(data.blueprint);
          setQuestions(data.questions);
          setDeadlineTime(data.deadlineTime);
          setAnswers(data.savedAnswers || {});
          setBookmarks(data.bookmarks || []);
        } else {
          // Re-fetch or start
          const res = await fetch(`/api/exams/${params.examId}/start`, { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            setAttemptId(data.attemptId);
            setBlueprint(data.blueprint);
            setQuestions(data.questions);
            setDeadlineTime(data.deadlineTime);
            setAnswers(data.savedAnswers || {});
            setBookmarks(data.bookmarks || []);
          }
        }
      } catch (e: any) {
        alert(e.message);
      } finally {
        setLoading(false);
      }
    };
    initExam();
  }, [params.examId]);

  // Server-Enforced Timer Countdown
  useEffect(() => {
    if (!deadlineTime || examResult) return;

    const interval = setInterval(() => {
      const remainingMs = new Date(deadlineTime).getTime() - new Date().getTime();
      const secs = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsRemaining(secs);

      if (secs === 0 && !submitting && !examResult) {
        clearInterval(interval);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineTime, examResult, submitting]);

  // Periodic Auto-Save
  useEffect(() => {
    if (!attemptId || examResult) return;

    const saveTimer = setTimeout(async () => {
      setSaveStatus('Saving...');
      try {
        const res = await fetch(`/api/exams/${params.examId}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptId, answers, bookmarks }),
        });
        if (res.ok) {
          setSaveStatus('All answers saved');
        }
      } catch (e) {
        setSaveStatus('Sync error');
      }
    }, 1500);

    return () => clearTimeout(saveTimer);
  }, [answers, bookmarks, attemptId, examResult, params.examId]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: [optionId], // Single choice selection
    }));
  };

  const toggleBookmark = (questionId: string) => {
    if (bookmarks.includes(questionId)) {
      setBookmarks(bookmarks.filter((id) => id !== questionId));
    } else {
      setBookmarks([...bookmarks, questionId]);
    }
  };

  const handleAutoSubmit = async () => {
    handleSubmit(true);
  };

  const handleSubmit = async (isAuto = false) => {
    if (!isAuto && !confirm('Are you sure you want to finalize and submit your examination?')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/exams/${params.examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExamResult(data.result);
    } catch (e: any) {
      alert(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Initializing examination session...</p>
      </div>
    );
  }

  // POST-EXAM DIAGNOSTIC REPORT
  if (examResult) {
    return (
      <div className="py-12 px-4 sm:px-8 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-[#eaedf5] shadow-lg overflow-hidden">
          {/* Result Header */}
          <div className={`p-8 text-white ${examResult.passed ? 'bg-gradient-to-r from-[#252c41] to-[#3a7536]' : 'bg-gradient-to-r from-[#252c41] to-red-800'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <span className="bg-white/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Official Diagnostic Examination Result
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold mt-2">
                  {blueprint?.title || 'BCSP ASP Examination Mock Simulation'}
                </h1>
                <p className="text-xs text-gray-200 mt-1">
                  Completed on {new Date(examResult.completedTime).toLocaleString()}
                </p>
              </div>

              <div className="text-center sm:text-right bg-black/20 p-4 rounded-xl border border-white/10">
                <div className="text-4xl font-black">{examResult.totalScore}%</div>
                <div className="text-xs font-bold uppercase mt-1 tracking-wider">
                  {examResult.passed ? (
                    <span className="text-[#99cd92] flex items-center gap-1 justify-center sm:justify-end">
                      <CheckCircle2 className="w-4 h-4" /> PASSED MOCK
                    </span>
                  ) : (
                    <span className="text-red-300 flex items-center gap-1 justify-center sm:justify-end">
                      <XCircle className="w-4 h-4" /> DID NOT PASS
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-300 mt-0.5">
                  Passing Threshold: {examResult.passingScorePercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Official Issued Credential Card */}
          {examResult.passed && examResult.certificate && (
            <div className="bg-[#f1f8f0] border-b border-[#3a7536]/20 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#4f8c4c] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3a7536] bg-green-100 px-2 py-0.5 rounded">
                    Official Accreditation Credential Issued
                  </span>
                  <h3 className="text-lg font-extrabold text-[#252c41] mt-1">
                    Certificate Code: {examResult.certificate.certificateCode}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Cryptographically recorded in the Zealosh Compliance Registry on{' '}
                    {new Date(examResult.certificate.issueDate).toLocaleDateString()} with a passing score of{' '}
                    <strong>{examResult.totalScore}%</strong>.
                  </p>
                </div>
              </div>

              <Link
                href={`/verify/${encodeURIComponent(examResult.certificate.certificateCode)}`}
                className="btn-primary bg-[#3a7536] hover:bg-[#2e5e2b] text-xs py-3 px-6 shadow-md flex items-center gap-2 shrink-0 w-full md:w-auto justify-center"
              >
                <Award className="w-4 h-4" />
                <span>View & Print Official Certificate</span>
              </Link>
            </div>
          )}

          {/* Domain Breakdown */}
          <div className="p-8 border-b border-[#eaedf5]">
            <h3 className="font-bold text-base text-[#252c41] mb-4">
              Domain-by-Domain Blueprint Breakdown
            </h3>
            <div className="space-y-4">
              {Object.entries(examResult.domainBreakdown || {}).map(([domain, stats]: [string, any]) => (
                <div key={domain} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>{domain}</span>
                    <span>
                      {stats.correct} / {stats.total} Correct ({stats.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full ${
                        stats.percent >= 70 ? 'bg-[#4f8c4c]' : 'bg-red-500'
                      }`}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Question-Level Review with Explanations */}
          <div className="p-8">
            <h3 className="font-bold text-base text-[#252c41] mb-6">
              Detailed Question Analysis & Authoritative Explanations
            </h3>

            <div className="space-y-6">
              {examResult.questions?.map((q: any, i: number) => (
                <div
                  key={q.id}
                  className={`p-5 rounded-xl border ${
                    q.isCorrect ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-500">Question {i + 1} • {q.domain}</span>
                    <span
                      className={`font-bold text-xs flex items-center gap-1 ${
                        q.isCorrect ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {q.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {q.isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-[#252c41] mb-4">
                    {q.stem}
                  </p>

                  <div className="space-y-2 mb-4 text-xs">
                    {q.options.map((opt: any) => {
                      const isSelected = q.userSelected.includes(opt.id);
                      const isCorrectAnswer = q.correctOptionIds.includes(opt.id);

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-lg border flex items-center justify-between ${
                            isCorrectAnswer
                              ? 'border-green-400 bg-green-100/70 font-semibold text-green-900'
                              : isSelected
                              ? 'border-red-400 bg-red-100/70 text-red-900'
                              : 'border-gray-200 bg-white text-gray-700'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {isCorrectAnswer && (
                            <span className="text-[10px] bg-green-700 text-white font-bold px-2 py-0.5 rounded">
                              Correct Answer
                            </span>
                          )}
                          {isSelected && !isCorrectAnswer && (
                            <span className="text-[10px] bg-red-700 text-white font-bold px-2 py-0.5 rounded">
                              Your Selection
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Official Explanation Box */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 text-xs text-gray-700">
                    <div className="font-bold text-[#3a7536] mb-1">
                      Authoritative Blueprint Explanation:
                    </div>
                    <p className="leading-relaxed">{q.explanation}</p>
                    <div className="text-[11px] text-gray-400 mt-2 font-mono">
                      Ref: {q.referenceSource}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[#eaedf5] flex justify-between items-center">
              <Link href="/exams" className="btn-outline text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Exam Hub</span>
              </Link>

              <Link href="/student" className="btn-primary text-xs">
                <span>Return to Student Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col">
      {/* Top Examination HUD */}
      <div className="bg-[#252c41] text-white px-4 sm:px-8 py-3.5 sticky top-0 z-40 border-b border-gray-700 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="bg-[#4f8c4c] text-white text-[10px] font-bold px-2.5 py-1 rounded">
            BCSP TIMED SIMULATION
          </span>
          <span className="text-xs font-semibold text-gray-200 hidden sm:inline truncate max-w-md">
            {blueprint?.title || 'ASP Examination Prep'}
          </span>
        </div>

        {/* Timer & Save Indicator */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-gray-400 hidden md:inline">
            {saveStatus}
          </span>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
            secondsRemaining < 180 ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-[#99cd92]'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="btn-primary bg-[#4f8c4c] text-xs py-1.5 px-4 font-bold"
          >
            {submitting ? 'Scoring...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      {/* Main Examination View */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Question Area */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-white rounded-2xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
          {currentQ ? (
            <div>
              <div className="flex items-center justify-between border-b border-[#eaedf5] pb-4 mb-6">
                <div>
                  <span className="text-xs font-bold text-[#4f8c4c] uppercase tracking-wider">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {currentQ.domain} • {currentQ.topic}
                  </div>
                </div>

                <button
                  onClick={() => toggleBookmark(currentQ.id)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    bookmarks.includes(currentQ.id)
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>
                    {bookmarks.includes(currentQ.id) ? 'Bookmarked' : 'Flag for Review'}
                  </span>
                </button>
              </div>

              {/* Question Stem */}
              <div className="text-base sm:text-lg font-bold text-[#252c41] leading-relaxed mb-6">
                {currentQ.stem}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {currentQ.options?.map((opt: any) => {
                  const isSelected = (answers[currentQ.id] || []).includes(opt.id);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#4f8c4c] bg-[#f1f8f0]'
                          : 'border-[#eaedf5] hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-sm font-medium text-[#252c41]">
                        {opt.text}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#4f8c4c] bg-[#4f8c4c]' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No questions loaded.</p>
          )}

          {/* Navigation Controls */}
          <div className="pt-6 border-t border-[#eaedf5] flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="btn-outline text-xs py-2 px-4 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="btn-primary text-xs py-2 px-4 disabled:opacity-40"
            >
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Palette Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-[#eaedf5] p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[#252c41] mb-3">
              Question Navigator ({Object.keys(answers).length}/{questions.length} Answered)
            </h3>

            <div className="grid grid-cols-5 gap-2.5 mb-6">
              {questions.map((q, idx) => {
                const isAnswered = (answers[q.id] || []).length > 0;
                const isBookmarked = bookmarks.includes(q.id);
                const isCurrent = currentIndex === idx;

                let btnClass = 'bg-gray-100 text-gray-700 border-gray-200';
                if (isCurrent) btnClass = 'ring-2 ring-[#4f8c4c] font-black';
                if (isAnswered) btnClass = 'bg-[#4f8c4c] text-white border-[#3a7536]';
                if (isBookmarked && !isAnswered) btnClass = 'bg-yellow-400 text-yellow-950 font-bold';

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold border flex items-center justify-center transition-all relative ${btnClass}`}
                  >
                    {idx + 1}
                    {isBookmarked && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-500 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs text-gray-500 pt-4 border-t border-[#eaedf5]">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-[#4f8c4c]" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-300" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-yellow-400" />
                <span>Flagged for Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
