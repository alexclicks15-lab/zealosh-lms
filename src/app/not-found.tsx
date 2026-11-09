import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-[#3a7536] mb-6 font-bold text-2xl border border-emerald-200">
        404
      </div>
      <h1 className="text-3xl font-extrabold text-[#252c41] tracking-tight sm:text-4xl">
        Page Not Found
      </h1>
      <p className="mt-4 text-base text-gray-600 max-w-md">
        The requested page could not be found, is unpublished, or you do not have permission to view it.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#4f8c4c] hover:bg-[#3a7536] transition-colors shadow-sm"
        >
          Return Home
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-[#252c41] bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Browse Courses
        </Link>
      </div>
    </div>
  );
}

