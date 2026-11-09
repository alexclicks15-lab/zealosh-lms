'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { MaintenanceMode } from '@/types';

interface MaintenanceStatus {
  enabled: boolean;
  mode: MaintenanceMode;
  maintenanceMessage: string;
  publicExplanation?: string;
  scheduledEndTime?: string;
}

export function MaintenanceBanner() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const res = await fetch('/api/maintenance/status');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStatus(data);
          }
        }
      } catch {
        // Silently skip if offline
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // 1 minute poll
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!status || !status.enabled || status.mode === 'NORMAL') {
    return null;
  }

  const isReadOnly = status.mode === 'READ_ONLY';

  return (
    <div
      role="alert"
      className={`w-full py-3 px-4 text-sm font-medium flex items-center justify-between border-b shadow-sm ${
        isReadOnly
          ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-red-50 text-red-900 border-red-200'
      }`}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center gap-3">
        {isReadOnly ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
        )}
        <div className="flex-1">
          <span className="font-bold uppercase tracking-wider text-xs mr-2 px-2 py-0.5 rounded bg-white/60">
            {isReadOnly ? 'Read-Only Mode' : 'Full Maintenance'}
          </span>
          <span>
            {status.maintenanceMessage ||
              (isReadOnly
                ? 'Platform is in Read-Only Maintenance mode. Learning materials remain accessible, but new submissions are paused.'
                : 'Platform undergoing scheduled maintenance.')}
          </span>
        </div>
        {status.scheduledEndTime && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-80 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Expected: {new Date(status.scheduledEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

