import { describe, it, expect } from 'vitest';

/**
 * Synthetic Test Suite for Moodle Exact Schema-State Classification Gate
 * Tests prefix validation, escaped pattern generation, project collision defense,
 * and 3-state classification: CLEAN, INSTALLED, and PARTIAL_OR_UNEXPECTED.
 *
 * STATUS: SIMULATED (Unit tests testing schema evaluation logic against synthetic database catalogs).
 */

export function isValidPrefix(prefix: string): boolean {
  return /^[a-z][a-z0-9_]*_$/.test(prefix);
}

export function escapeSqlLikePattern(prefix: string): string {
  return prefix.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
}

export interface SchemaEvaluationInput {
  allPublicTables: string[];
  prefix: string;
  configVersion?: string | null;
  configRelease?: string | null;
}

export type SchemaClassification = 'CLEAN' | 'INSTALLED' | 'PARTIAL_OR_UNEXPECTED' | 'INVALID_PREFIX';

export function evaluateSchemaState(input: SchemaEvaluationInput): SchemaClassification {
  const { allPublicTables, prefix, configVersion } = input;

  // 1. Prefix format validation
  if (!isValidPrefix(prefix)) {
    return 'INVALID_PREFIX';
  }

  const totalPublicTables = allPublicTables.length;
  const prefixTables = allPublicTables.filter((t) => t.startsWith(prefix));
  const totalPrefixTables = prefixTables.length;
  const nonPrefixTables = allPublicTables.filter((t) => !t.startsWith(prefix));
  const totalNonPrefixTables = nonPrefixTables.length;

  const requiredCoreTables = [
    prefix + 'config',
    prefix + 'config_plugins',
    prefix + 'course',
    prefix + 'course_categories',
    prefix + 'user',
    prefix + 'modules',
    prefix + 'context',
    prefix + 'role',
    prefix + 'capabilities',
    prefix + 'event',
  ];

  const missingCore = requiredCoreTables.filter((req) => !prefixTables.includes(req));

  // A. CLEAN: 0 tables in public schema
  if (totalPublicTables === 0) {
    return 'CLEAN';
  }

  // B. Project Collision Defense: Non-prefix tables exist (e.g. Core Hub Project 1), but 0 prefix tables found!
  if (totalPrefixTables === 0 && totalNonPrefixTables > 0) {
    return 'PARTIAL_OR_UNEXPECTED';
  }

  // C. INSTALLED: Required core tables present, >= 150 tables, valid numeric version in config
  if (totalPrefixTables >= 150 && missingCore.length === 0) {
    if (configVersion && !isNaN(Number(configVersion)) && Number(configVersion) > 0) {
      return 'INSTALLED';
    }
    return 'PARTIAL_OR_UNEXPECTED';
  }

  // D. Any other state is partial or unexpected
  return 'PARTIAL_OR_UNEXPECTED';
}

describe('[SIMULATED] Moodle Schema-State Classification Gate', () => {
  describe('Prefix Format Validation', () => {
    it('should approve valid standard lowercase prefixes ending in underscore', () => {
      expect(isValidPrefix('mdl_')).toBe(true);
      expect(isValidPrefix('moodle_')).toBe(true);
      expect(isValidPrefix('z_mdl_')).toBe(true);
      expect(isValidPrefix('zealosh2026_')).toBe(true);
    });

    it('should reject invalid prefixes with missing trailing underscore or unsupported characters', () => {
      expect(isValidPrefix('mdl')).toBe(false); // Missing trailing underscore
      expect(isValidPrefix('_mdl_')).toBe(false); // Cannot start with underscore
      expect(isValidPrefix('1mdl_')).toBe(false); // Cannot start with digit
      expect(isValidPrefix('MDL_')).toBe(false); // Uppercase not allowed
      expect(isValidPrefix('mdl-test_')).toBe(false); // Hyphens not allowed
      expect(isValidPrefix("mdl_'; DROP TABLE users;--")).toBe(false); // SQL injection rejected
    });
  });

  describe('SQL LIKE Pattern Escaping', () => {
    it('should escape underscore characters to prevent SQL single-character wildcards', () => {
      const escaped = escapeSqlLikePattern('mdl_');
      expect(escaped).toBe('mdl\\_%');
      expect(escaped).not.toBe('mdl_%'); // Unescaped 'mdl_%' would match 'mdlx', 'mdly', etc.
    });
  });

  describe('3-State Schema Classification & Project Collision Defense', () => {
    const validPrefix = 'mdl_';

    it('should classify completely empty public schema as CLEAN', () => {
      const result = evaluateSchemaState({
        allPublicTables: [],
        prefix: validPrefix,
      });
      expect(result).toBe('CLEAN');
    });

    it('should fail-closed as PARTIAL_OR_UNEXPECTED when non-Moodle tables exist (Supabase Project 1 Collision)', () => {
      // Simulating accidental connection to Core Hub Project 1 database
      const coreHubTables = [
        'courses',
        'batches',
        'enrollments',
        'users',
        'certificates',
        'exam_blueprints',
        'exam_questions',
        'audit_logs',
      ];
      const result = evaluateSchemaState({
        allPublicTables: coreHubTables,
        prefix: validPrefix,
      });
      expect(result).toBe('PARTIAL_OR_UNEXPECTED');
    });

    it('should classify full Moodle schema with core tables and version record as INSTALLED', () => {
      const fullMoodleTables: string[] = [
        'mdl_config',
        'mdl_config_plugins',
        'mdl_course',
        'mdl_course_categories',
        'mdl_user',
        'mdl_modules',
        'mdl_context',
        'mdl_role',
        'mdl_capabilities',
        'mdl_event',
      ];
      // Generate 160 dummy tables to reach standard Moodle table count
      for (let i = 0; i < 160; i++) {
        fullMoodleTables.push(`mdl_dummy_table_${i}`);
      }

      const result = evaluateSchemaState({
        allPublicTables: fullMoodleTables,
        prefix: validPrefix,
        configVersion: '2024100700',
        configRelease: '5.3.0 (Build: 20241007)',
      });
      expect(result).toBe('INSTALLED');
    });

    it('should classify partial Moodle installation (< 150 tables) as PARTIAL_OR_UNEXPECTED', () => {
      const partialTables = ['mdl_config', 'mdl_course', 'mdl_user'];
      const result = evaluateSchemaState({
        allPublicTables: partialTables,
        prefix: validPrefix,
        configVersion: '2024100700',
      });
      expect(result).toBe('PARTIAL_OR_UNEXPECTED');
    });

    it('should classify schema missing core tables as PARTIAL_OR_UNEXPECTED even if count is high', () => {
      const manyTablesWithoutCourse: string[] = ['mdl_config', 'mdl_user'];
      for (let i = 0; i < 200; i++) {
        manyTablesWithoutCourse.push(`mdl_plugin_${i}`);
      }
      const result = evaluateSchemaState({
        allPublicTables: manyTablesWithoutCourse,
        prefix: validPrefix,
        configVersion: '2024100700',
      });
      expect(result).toBe('PARTIAL_OR_UNEXPECTED');
    });

    it('should classify schema with unreadable/empty version record as PARTIAL_OR_UNEXPECTED', () => {
      const fullTables: string[] = [
        'mdl_config',
        'mdl_config_plugins',
        'mdl_course',
        'mdl_course_categories',
        'mdl_user',
        'mdl_modules',
        'mdl_context',
        'mdl_role',
        'mdl_capabilities',
        'mdl_event',
      ];
      for (let i = 0; i < 160; i++) {
        fullTables.push(`mdl_table_${i}`);
      }
      const result = evaluateSchemaState({
        allPublicTables: fullTables,
        prefix: validPrefix,
        configVersion: '', // Empty version record
      });
      expect(result).toBe('PARTIAL_OR_UNEXPECTED');
    });
  });
});
