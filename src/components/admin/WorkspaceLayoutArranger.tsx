'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  CheckCircle,
  Columns,
} from 'lucide-react';
import { WorkspaceLayout, WorkspaceWidgetConfig } from '@/types';

export function WorkspaceLayoutArranger() {
  const [layout, setLayout] = useState<WorkspaceLayout | null>(null);
  const [widgets, setWidgets] = useState<WorkspaceWidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchLayout();
  }, []);

  async function fetchLayout() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/workspace/layout');
      if (res.ok) {
        const data = await res.json();
        setLayout(data);
        setWidgets(data.widgetsConfig || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load layout', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleToggleVisibility(id: string) {
    setWidgets(
      widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }

  function handleColSpanChange(id: string, colSpan: number) {
    setWidgets(
      widgets.map((w) => (w.id === id ? { ...w, colSpan } : w))
    );
  }

  function handleMove(index: number, direction: 'UP' | 'DOWN') {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const updated = [...widgets];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate order numbers
    const reordered = updated.map((w, idx) => ({ ...w, order: idx + 1 }));
    setWidgets(reordered);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/workspace/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetsConfig: widgets }),
      });
      if (res.ok) {
        const saved = await res.json();
        setLayout(saved);
        setMessage({ text: 'Custom workspace layout saved successfully', type: 'success' });
      } else {
        const d = await res.json();
        setMessage({ text: d.error || 'Failed to save layout', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Are you sure you want to reset workspace layout to default?')) return;
    try {
      const res = await fetch('/api/admin/workspace/layout', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setLayout(data.layout);
        setWidgets(data.layout.widgetsConfig || []);
        setMessage({ text: 'Workspace layout reset to institutional defaults', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-100 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4f8c4c] bg-[#eef7ee] px-2.5 py-1 rounded-full">
            Admin Customization
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#4f8c4c]" />
            Workspace Layout & Widget Arranger
          </h2>
          <p className="text-xs text-slate-500">
            Configure widget visibility, responsive column spans, and display priority for administrative command center.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs py-2 px-4 bg-[#4f8c4c] hover:bg-[#3a7536] text-white font-bold flex items-center gap-1.5 shadow"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Layout...' : 'Save Arrangement'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold underline ml-3">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading workspace layout...</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls List */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Configurable Widgets</h3>
            {widgets.map((w, idx) => (
              <div
                key={w.id}
                className={`p-3.5 rounded-lg border transition ${
                  w.visible ? 'bg-white border-gray-200 shadow-2xs' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">#{w.order}</span>
                    <span className="font-bold text-xs text-slate-900">{w.title}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleVisibility(w.id || w.widgetId || '')}
                      className={`p-1 rounded ${w.visible ? 'text-[#4f8c4c] hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-200'}`}
                      title={w.visible ? 'Hide Widget' : 'Show Widget'}
                    >
                      {w.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'UP')}
                      disabled={idx === 0}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'DOWN')}
                      disabled={idx === widgets.length - 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Columns className="w-3.5 h-3.5 text-gray-400" />
                    <span>Width:</span>
                  </div>
                  <select
                    value={w.colSpan}
                    onChange={(e) => handleColSpanChange(w.id || w.widgetId || '', Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-slate-800"
                  >
                    <option value={4}>4 cols (One Third)</option>
                    <option value={6}>6 cols (Half Width)</option>
                    <option value={8}>8 cols (Two Thirds)</option>
                    <option value={12}>12 cols (Full Width)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Live Preview Grid */}
          <div className="lg:col-span-7 bg-slate-50 border border-dashed border-gray-300 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
              <span>Interactive Live Preview Grid</span>
              <span className="text-[10px] text-gray-400 font-normal">(12-Column Responsive System)</span>
            </h3>

            <div className="grid grid-cols-12 gap-3">
              {widgets
                .filter((w) => w.visible)
                .map((w) => {
                  const colClass =
                    w.colSpan === 12
                      ? 'col-span-12'
                      : w.colSpan === 8
                      ? 'col-span-8'
                      : w.colSpan === 6
                      ? 'col-span-6'
                      : 'col-span-4';

                  return (
                    <div
                      key={w.id}
                      className={`${colClass} bg-white border border-[#e2efe1] rounded-lg p-4 shadow-2xs min-h-[90px] flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">{w.title}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono">
                          {w.colSpan}/12
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">{w.component}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

