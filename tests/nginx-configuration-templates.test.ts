// ==============================================================================
// Zealosh LMS — Nginx Configuration Templates Validation Suite
// ==============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Zealosh LMS — Nginx Configuration Templates & Security Directives', () => {
  const lmsNginxPath = path.resolve(import.meta.dirname, '../deploy/nginx/zealosh-lms.nginx.conf');
  const vcNginxPath = path.resolve(import.meta.dirname, '../deploy/nginx/zealosh-vc.nginx.conf');

  it('1. should verify Server 1 (LMS Core) Nginx template directives', () => {
    expect(fs.existsSync(lmsNginxPath)).toBe(true);
    const content = fs.readFileSync(lmsNginxPath, 'utf8');

    // Directives
    expect(content).toContain('upstream zealosh_nextjs_cluster');
    expect(content).toContain('server 127.0.0.1:3000');
    expect(content).toContain('listen 443 ssl http2');
    expect(content).toContain('ssl_protocols TLSv1.2 TLSv1.3');

    // Security Headers
    expect(content).toContain('add_header X-Frame-Options "SAMEORIGIN" always;');
    expect(content).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(content).toContain('add_header Strict-Transport-Security');

    // Cloudflare Trusted Proxies (Both IPv4 and IPv6)
    expect(content).toContain('real_ip_header CF-Connecting-IP;');
    expect(content).toContain('set_real_ip_from 173.245.48.0/20;');
    expect(content).toContain('set_real_ip_from 104.16.0.0/13;');
    expect(content).toContain('set_real_ip_from 2400:cb00::/32;');
    expect(content).toContain('set_real_ip_from 2606:4700::/32;');

    // Rate Limiting
    expect(content).toContain('limit_req_zone');
    expect(content).toContain('zone=zealosh_login_limit');
    expect(content).toContain('zone=zealosh_api_limit');

    // WebSocket Upgrade
    expect(content).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(content).toContain('proxy_set_header Connection');

    // Prohibit insecure SSL
    expect(content).not.toContain('SSLv3');
    expect(content).not.toContain('TLSv1.0');
    expect(content).not.toContain('TLSv1.1');
  });

  it('2. should verify Server 2 (VC Media Node) Nginx template directives', () => {
    expect(fs.existsSync(vcNginxPath)).toBe(true);
    const content = fs.readFileSync(vcNginxPath, 'utf8');

    // Directives
    expect(content).toContain('server_name vc.${ZEALOSH_DOMAIN}');
    expect(content).toContain('listen 443 ssl http2');
    expect(content).toContain('ssl_protocols TLSv1.2 TLSv1.3');

    // Endpoints
    expect(content).toContain('/bigbluebutton/api/');
    expect(content).toContain('/html5client/');
    expect(content).toContain('/bbb-webrtc-sfu/');

    // Security Headers
    expect(content).toContain('add_header X-Frame-Options "SAMEORIGIN"');
    expect(content).toContain('add_header X-Content-Type-Options "nosniff"');
  });
});

