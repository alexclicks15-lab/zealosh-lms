// Zealosh LMS — Classroom Subsystem Module Exports
// Provides the authoritative classroomProvider singleton, interfaces, error types, and branding configurations.

import { BbbApiClassroomProvider, ClassroomProvider } from './classroom-provider';
import { bbbAdapter } from '@/lib/adapters/bbb-adapter';

export * from './classroom-provider';
export * from './branding';
export * from './live-quiz-contract';

export const bbbClassroomProvider = new BbbApiClassroomProvider(bbbAdapter);

// Default authoritative classroom provider
export const classroomProvider: ClassroomProvider = bbbClassroomProvider;

