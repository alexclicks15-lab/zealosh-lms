// tests/workspace-layout-customization.test.ts
// Vitest suite for Workspace Widget Layout Arranger & Customization

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { WorkspaceWidgetConfig } from '@/types';

describe('Workspace Layout Customization & Widget Arranger', () => {
  const userId = `usr-layout-${Date.now()}`;
  const role = 'STUDENT';

  beforeEach(() => {
    (db as any).workspaceLayouts?.clear();
  });

  it('returns default layout configuration when user has no customized arrangement', async () => {
    const layout = await db.getWorkspaceLayout(userId, role);

    expect(layout.userId).toBe(userId);
    expect(layout.role).toBe('STUDENT');
    expect(layout.isDefault).toBe(true);
    expect(layout.widgets.length).toBeGreaterThan(0);

    // Verify key student widgets exist by default
    const widgetIds = layout.widgets.map((w) => w.widgetId);
    expect(widgetIds).toContain('ENROLLED_COURSES');
    expect(widgetIds).toContain('NEXT_LIVE_CLASS');
  });

  it('saves custom widget configuration and persists user preferences', async () => {
    const customWidgets: WorkspaceWidgetConfig[] = [
      {
        widgetId: 'EXAM_PREPARATION',
        column: 1,
        order: 0,
        enabled: true,
        collapsed: false,
        size: 'FULL',
      },
      {
        widgetId: 'SCHEDULED_OFFICE_HOURS',
        column: 2,
        order: 1,
        enabled: true,
        collapsed: false,
        size: 'HALF',
      },
    ];

    const saved = await db.saveWorkspaceLayout(userId, role, customWidgets);
    expect(saved.isDefault).toBe(false);
    expect(saved.widgets).toHaveLength(2);
    expect(saved.widgets[0].widgetId).toBe('EXAM_PREPARATION');

    // Fetch again and verify persistence
    const fetched = await db.getWorkspaceLayout(userId, role);
    expect(fetched.isDefault).toBe(false);
    expect(fetched.widgets).toHaveLength(2);
    expect(fetched.widgets[0].widgetId).toBe('EXAM_PREPARATION');
  });

  it('resets custom layout and restores institutional default arrangement', async () => {
    // Save custom layout first
    await db.saveWorkspaceLayout(userId, role, [
      {
        widgetId: 'SINGLE_WIDGET',
        column: 1,
        order: 0,
        enabled: true,
        collapsed: false,
        size: 'FULL',
      },
    ]);

    // Verify custom is active
    let layout = await db.getWorkspaceLayout(userId, role);
    expect(layout.isDefault).toBe(false);

    // Reset layout
    await db.resetWorkspaceLayout(userId, role);

    // Verify default is restored
    layout = await db.getWorkspaceLayout(userId, role);
    expect(layout.isDefault).toBe(true);
    expect(layout.widgets.length).toBeGreaterThanOrEqual(4);
  });
});

