'use client';

// Zealosh LMS — Frontend React Error Boundary
// Path: src/components/diagnostics/ErrorBoundary.tsx
// Captures uncaught component crashes, generates correlation IDs, reports to diagnostics API,
// and displays a calm, user-friendly recovery screen matching Zealosh brand identity.

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  correlationId: string | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Re-throw Next.js internal control-flow exceptions so Next.js handles 404 and redirect status codes
    if (
      (error as any)?.digest === 'NEXT_NOT_FOUND' ||
      error?.message === 'NEXT_NOT_FOUND' ||
      (error as any)?.digest?.startsWith?.('NEXT_REDIRECT') ||
      error?.message?.startsWith?.('NEXT_REDIRECT')
    ) {
      throw error;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 10);
    const correlationId = `corr-${dateStr}-${rand}`;
    return { hasError: true, error, correlationId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Do not report Next.js internal control flow as runtime bugs
    if (
      (error as any)?.digest === 'NEXT_NOT_FOUND' ||
      error?.message === 'NEXT_NOT_FOUND' ||
      (error as any)?.digest?.startsWith?.('NEXT_REDIRECT') ||
      error?.message?.startsWith?.('NEXT_REDIRECT')
    ) {
      return;
    }

    this.setState({ errorInfo });

    const correlationId = this.state.correlationId;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const route = typeof window !== 'undefined' ? window.location.pathname : '';

    // Asynchronously dispatch error report to backend diagnostics
    try {
      fetch('/api/diagnostics/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId || '',
        },
        body: JSON.stringify({
          category: 'FRONTEND_RUNTIME',
          severity: 'HIGH',
          name: error.name || 'ComponentCrash',
          message: error.message || 'React render crash',
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          route,
          url,
          correlationId,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch((reportErr) => {
        console.warn('Diagnostics report dispatch failed:', reportErr);
      });
    } catch (e) {
      // Ignore background reporting error
    }
  }

  handleCopyCorrelation = () => {
    if (this.state.correlationId && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.state.correlationId).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: null,
      copied: false,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const { error, correlationId, copied, showDetails } = this.state;

      return (
        <div className="min-h-[360px] w-full flex items-center justify-center p-6 bg-[#f4f9f3]">
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-md rounded-2xl border border-[#e2efe1] shadow-sm p-8 text-center">
            {/* Brand Header Icon */}
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-5 text-amber-600">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {fallbackTitle || 'Something went wrong'}
            </h2>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {fallbackMessage ||
                'An unexpected error occurred while rendering this view. Our operational monitoring system has recorded this incident for investigation.'}
            </p>

            {/* Incident Reference / Correlation ID */}
            {correlationId && (
              <div className="mb-6 bg-slate-50 border border-[#e2efe1] rounded-lg p-3 inline-flex items-center justify-center gap-3 max-w-full">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Incident Reference:
                </span>
                <code className="text-xs font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-[#e2efe1]">
                  {correlationId}
                </code>
                <button
                  type="button"
                  onClick={this.handleCopyCorrelation}
                  className="text-xs text-slate-600 hover:text-[#4f8c4c] flex items-center gap-1 transition-colors"
                  title="Copy Reference ID"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="neomorphic-button px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4f8c4c] hover:bg-[#3a7536] transition-colors shadow-sm flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => typeof window !== 'undefined' && window.location.reload()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-[#e2efe1] hover:bg-slate-50 transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Technical Details Toggle */}
            {error && (
              <div className="mt-8 pt-4 border-t border-slate-100 text-left">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 mx-auto"
                >
                  <span>{showDetails ? 'Hide Technical Details' : 'View Technical Details'}</span>
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDetails && (
                  <div className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                    <p className="text-rose-400 font-bold mb-1">{error.name}: {error.message}</p>
                    {error.stack && <p className="text-slate-400">{error.stack}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

