'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  Video, 
  BookOpen, 
  Award, 
  Clock, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  PlayCircle,
  FileText,
  Receipt,
  Bookmark,
  Download,
  Lock,
  Play
} from 'lucide-react';
import { Enrollment, Course, LiveSession, ClassRecording } from '@/types';


export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          // Enrich enrollments
          fetch('/api/courses')
            .then((r) => r.json())
            .then((cData) => {
              const enrolled = data.enrollments.map((enr: any) => {
                const course = cData.courses?.find((c: any) => c.id === enr.courseId);
                return { ...enr, course };
              });
              setEnrollments(enrolled);
              setLoading(false);
            });

          // Fetch student certificates
          fetch('/api/certificates')
            .then((r) => (r.ok ? r.json() : null))
            .then((certData) => {
              if (certData?.certificates) {
                setCertificates(certData.certificates);
              }
            })
            .catch(() => {});

          // Fetch assignments
          fetch('/api/assignments')
            .then((r) => (r.ok ? r.json() : null))
            .then((asgData) => {
              if (asgData?.assignments) {
                setAssignments(asgData.assignments);
              }
            })
            .catch(() => {});

          // Fetch invoices
          fetch('/api/invoices')
            .then((r) => (r.ok ? r.json() : null))
            .then((invData) => {
              if (invData?.invoices) {
                setInvoices(invData.invoices);
              }
            })
            .catch(() => {});

          // Fetch authorized class recordings
          fetch('/api/recordings')
            .then((r) => (r.ok ? r.json() : null))
            .then((recData) => {
              if (recData?.recordings) {
                setRecordings(recData.recordings);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));

  }, [router]);

  const handleJoinLive = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/live/${sessionId}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        alert(data.error || 'Failed to join live session');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading student portal...</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#252c41] to-[#3a7536] text-white rounded-2xl p-6 sm:p-8 mb-10 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold text-[#99cd92] uppercase tracking-wider mb-1">
              Zealosh Student Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-sm text-gray-200 mt-1 max-w-xl">
              Track your certified course progression, attend upcoming live cohorts, and test your exam readiness with official mock blueprints.
            </p>
          </div>

          <Link
            href="/exams"
            className="btn-primary bg-white text-[#252c41] hover:bg-gray-100 hover:text-[#252c41] text-xs font-bold py-2.5 px-5 shadow"
          >
            <Award className="w-4 h-4 text-[#4f8c4c]" />
            <span>Launch Exam Simulation</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Enrolled Courses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#4f8c4c]" />
              Active Enrolled Programs
            </h2>
            <Link href="/courses" className="text-xs font-bold text-[#4f8c4c] hover:underline">
              Browse More Courses
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-10 text-center">
              <p className="text-gray-500 text-sm mb-4">You have not enrolled in any programs yet.</p>
              <Link href="/courses" className="btn-primary text-xs inline-flex">
                Explore Available Cohorts
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                      <Image
                        src={enr.course?.coverImage || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400'}
                        alt="Course"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-green text-[10px]">
                          {enr.course?.certificationType || 'HSE'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Expires: {new Date(enr.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-[#252c41]">
                        {enr.course?.title || 'Certification Course'}
                      </h3>

                      {/* Progress Bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-36 sm:w-48 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#4f8c4c] h-2 rounded-full"
                            style={{ width: `${enr.progressPercent || 35}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600">
                          {enr.progressPercent || 35}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/learn/${enr.courseId}`}
                    className="btn-primary text-xs py-2 px-4 shrink-0 w-full sm:w-auto"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Continue Learning</span>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Coursework & Practice Assignments */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#4f8c4c]" />
                Coursework & Practice Assignments
              </h2>
              <span className="text-xs text-gray-500 font-semibold">
                {assignments.length} Projects Assigned
              </span>
            </div>

            {assignments.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 text-center text-xs text-gray-500">
                No active assignments assigned to your cohorts.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="card-elevated p-5 flex flex-col justify-between border-l-4 border-l-[#252c41]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-[#4f8c4c] bg-green-50 px-2 py-0.5 rounded">
                          Max: {asg.maxScore} pts
                        </span>
                        {asg.submission ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              asg.submission.status === 'GRADED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {asg.submission.status === 'GRADED'
                              ? `Score: ${asg.submission.score}/${asg.maxScore}`
                              : 'Under Review'}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                            PENDING
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[#252c41] mb-1">
                        {asg.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mb-3">
                        {asg.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Due: {new Date(asg.dueDate).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/learn/${asg.courseId}`}
                        className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                      >
                        <span>{asg.submission ? 'View Feedback' : 'Submit Solution'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recorded Masterclasses & Topic Revisions */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#4f8c4c]" />
                Recorded Classes & Revision Highlights
              </h2>
              <span className="text-xs text-gray-500 font-semibold">
                {recordings.length} Recordings Available
              </span>
            </div>

            {recordings.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 text-center text-xs text-gray-500">
                No recorded sessions published for your cohorts yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-[#4f8c4c]"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-[#e1f0df] text-[#3a7536] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {rec.batchId}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {Math.round(rec.durationSeconds / 60)} Mins
                        </span>
                        {rec.isDownloadable ? (
                          <span className="text-[10px] font-bold text-[#4f8c4c] bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <Download className="w-2.5 h-2.5" /> Downloadable
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Streaming Only
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-[#252c41] mb-1">{rec.title}</h3>
                      {rec.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 max-w-xl">{rec.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <Link
                        href={`/recordings/${rec.id}`}
                        className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Watch Class</span>
                      </Link>

                      {rec.isDownloadable && (
                        <a
                          href={`/api/recordings/${rec.id}/stream?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 border border-gray-200 hover:border-[#4f8c4c] text-gray-600 hover:text-[#4f8c4c] rounded-lg transition-colors"
                          title="Download MP4"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earned Accreditations & Certificates */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#4f8c4c]" />
                Earned Accreditations & Verified Certificates
              </h2>
            </div>

            {certificates.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 text-center">
                <p className="text-gray-500 text-xs">
                  Pass your official examination simulation with 70%+ score to earn a blockchain-verifiable Zealosh Accreditation Certificate.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="card-elevated p-5 flex flex-col justify-between border-l-4 border-l-[#4f8c4c]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge-green text-[10px]">
                          {cert.certificationType || 'HSE'} CERTIFIED
                        </span>
                        <span className="text-[11px] font-bold text-[#3a7536]">
                          Score: {cert.scorePercent}%
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[#252c41] mb-1">
                        {cert.courseTitle}
                      </h4>
                      <p className="text-[11px] font-mono text-gray-500 mb-3">
                        {cert.certificateCode}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Issued: {new Date(cert.issueDate).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/verify/${encodeURIComponent(cert.certificateCode)}`}
                        className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                      >
                        <span>Verify Credential</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Upcoming Live Classroom & Resources */}
        <div className="lg:col-span-4 space-y-6">
          {/* Live Session Alert Box */}
          <div className="bg-white rounded-xl border-2 border-[#4f8c4c] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                SCHEDULED LIVE CLASS
              </span>
              <span className="text-xs text-gray-500 font-semibold">BigBlueButton</span>
            </div>

            <h3 className="font-bold text-sm text-[#252c41] mb-2 leading-snug">
              Live Workshop: ASP Math & Ventilation Problem-Solving
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Lead Mentor: Vishnu Rajendran • 120 Minutes
            </p>

            <button
              onClick={() => handleJoinLive('sess-asp-01')}
              className="w-full btn-primary text-xs py-2.5 shadow-sm"
            >
              <Video className="w-4 h-4" />
              <span>Join Live Classroom</span>
            </button>
          </div>

          {/* Quick Study Aids */}
          <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-[#252c41] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4f8c4c]" />
              Downloadable Quick Cards
            </h3>
            <ul className="space-y-2.5 text-xs text-gray-700">
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Zealosh ASP Formula Cheat Sheet</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Radiation Inverse Square Law Card</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Industrial Ventilation Equations</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
            </ul>
          </div>

          {/* Tuition Invoices & Payment Receipts */}
          <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-[#252c41] mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#4f8c4c]" />
                Tax Invoices & Receipts
              </span>
              <span className="text-[10px] font-bold bg-[#e1f0df] text-[#3a7536] px-2 py-0.5 rounded-full">
                GST VERIFIED
              </span>
            </h3>

            {invoices.length === 0 ? (
              <p className="text-xs text-gray-400">No payment records found.</p>
            ) : (
              <div className="space-y-2.5">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-xs text-[#252c41]">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-gray-500">{inv.courseTitle} • ₹{inv.totalAmount.toLocaleString()}</div>
                    </div>
                    <Link
                      href={`/invoices/${encodeURIComponent(inv.id)}`}
                      className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
