'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, Download, CheckCircle2, X } from 'lucide-react';

export default function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Service Worker Registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => {
            console.log('[Zealosh PWA] ServiceWorker registered with scope:', reg.scope);
          },
          (err) => {
            console.warn('[Zealosh PWA] ServiceWorker registration failed:', err);
          }
        );
      });
    }

    // 2. Connectivity Listeners
    const handleOnline = () => {
      setIsOffline(false);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // 3. PWA Installability Prompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  return (
    <>
      {/* Offline Status Bar */}
      {isOffline && (
        <div className="bg-[#1e481c] text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between sticky top-0 z-50 shadow-md border-b border-amber-500/30">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Offline Mode:</strong> Learning session active. Progress will automatically synchronize once connectivity is restored.
            </span>
          </div>
        </div>
      )}

      {/* Reconnected Toast */}
      {reconnected && (
        <div className="bg-[#3a7536] text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <Wifi className="w-4 h-4 text-white" />
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>Connection restored. Offline study records synchronized successfully.</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 right-4 z-40 bg-white border border-[#e2efe1] p-4 rounded-xl shadow-xl max-w-sm flex items-start gap-3">
          <div className="p-2 bg-[#e1f0df] rounded-lg text-[#3a7536] flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-900">Install Zealosh LMS App</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Install for instant access, offline mock exam preparation, and class notifications.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleInstallClick}
                className="bg-[#4f8c4c] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#3a7536] transition-colors"
              >
                Install Now
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
