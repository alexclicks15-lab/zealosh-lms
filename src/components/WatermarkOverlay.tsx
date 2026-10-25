'use client';

import React, { useEffect, useState } from 'react';

interface WatermarkOverlayProps {
  userName?: string;
  userEmail?: string;
}

export default function WatermarkOverlay({ userName = 'Arjun Menon', userEmail = 'student@zealosh.com' }: WatermarkOverlayProps) {
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden flex flex-col justify-around select-none opacity-20">
      <div className="flex justify-around transform -rotate-12 space-x-12">
        <div className="text-[11px] font-mono text-white/90 drop-shadow-sm font-semibold tracking-wider">
          ZEALOSH SECURE LMS • {userName} • {userEmail} • {timestamp}
        </div>
        <div className="hidden sm:block text-[11px] font-mono text-white/90 drop-shadow-sm font-semibold tracking-wider">
          ZEALOSH SECURE LMS • {userEmail} • {timestamp}
        </div>
      </div>
      <div className="flex justify-around transform -rotate-12 space-x-12">
        <div className="hidden md:block text-[11px] font-mono text-white/90 drop-shadow-sm font-semibold tracking-wider">
          PROTECTED HSE CONTENT • {userName} • {timestamp}
        </div>
        <div className="text-[11px] font-mono text-white/90 drop-shadow-sm font-semibold tracking-wider">
          ZEALOSH FORENSIC WATERMARK • {userEmail}
        </div>
      </div>
    </div>
  );
}
