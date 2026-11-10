// ==============================================================================
// Zealosh LMS — Production/Staging PM2 Process Supervisor Ecosystem
// Path: /opt/zealosh/current/ecosystem.config.js
// NOTE: Systemd is the Authoritative Host Supervisor for production/staging (ADR-004).
// PM2 is provided as an optional application-level process manager for local/dev use.
// Never run both Systemd worker timer and PM2 worker concurrently.
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'zealosh-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      cwd: '/opt/zealosh/current',
      instances: 2, // 2 cluster workers for web requests
      exec_mode: 'cluster',
      env_file: '/opt/zealosh/shared/.env.staging',
      max_memory_restart: '1500M',
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
      watch: false,
    },
    {
      name: 'zealosh-outbox-worker',
      script: 'deploy/worker-runner.mjs',
      cwd: '/opt/zealosh/current',
      instances: 1, // STRICT INVARIANT: Exactly 1 worker instance to prevent duplicate dispatch
      exec_mode: 'fork',
      env_file: '/opt/zealosh/shared/.env.staging',
      env: {
        ZEALOSH_WORKER_SUPERVISOR: 'pm2',
      },
      max_memory_restart: '800M',
      restart_delay: 10000,
      autorestart: true,
      watch: false,
    },
  ],
};

