-- ============================================================================
-- Zealosh LMS Platform — Moodle Learning Engine Database Provisioning
-- Isolates Moodle (mdl_*) schema and tables from Zealosh Core Hub
-- Compatible with PostgreSQL 16 Enterprise Database
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'zealosh_moodle_user') THEN
        CREATE ROLE zealosh_moodle_user WITH LOGIN PASSWORD 'zealosh_moodle_secure_pass_2026';
    END IF;
END
$$;

SELECT 'CREATE DATABASE zealosh_moodle OWNER zealosh_moodle_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zealosh_moodle')\gexec

GRANT ALL PRIVILEGES ON DATABASE zealosh_moodle TO zealosh_moodle_user;

\c zealosh_moodle
GRANT ALL ON SCHEMA public TO zealosh_moodle_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zealosh_moodle_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zealosh_moodle_user;
