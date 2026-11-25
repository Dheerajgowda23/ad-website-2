import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminUser, buildZonePair, committeeUser, hardInternalFlags } from './helpers.js';

/**
 * Role guard - handoff §2 and §1.6.
 *
 * The role is resolved from the server-side session and the user row, never
 * from the payload. A COMMITTEE account is a legitimate intranet user with no
 * configuration rights, so the answer is 403 - on a route that exists.
 */
describe('role guard', () => {
  const staffSession = async (userId: string, role: 'COMMITTEE' | 'ADMIN_HR') => {
    const pair = buildZonePair({ flags: hardInternalFlags() });
    const cookie = await pair.mintCookie('internal', {
      kind: 'staff',
      zone: 'internal',
      userId,
      role,
    });
    return { ...pair, cookie };
  };

  it('gives a COMMITTEE account 403 on a configuration route', async () => {
    const { internalApp, cookie } = await staffSession(committeeUser.id, 'COMMITTEE');

    const response = await request(internalApp).get('/api/staff/config').set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
    expect(response.body.error.message).toContain('config:read');
  });

  it('gives a COMMITTEE account 403 on a configuration write', async () => {
    const { internalApp, cookie } = await staffSession(committeeUser.id, 'COMMITTEE');

    const response = await request(internalApp)
      .put('/api/staff/config/flags/open_application_form')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5174')
      .send({ zonePublic: true, zoneInternal: true });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('ignores a role sent by the client', async () => {
    const { internalApp, cookie } = await staffSession(committeeUser.id, 'COMMITTEE');

    const response = await request(internalApp)
      .put('/api/staff/config/flags/open_application_form')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5174')
      .send({ role: 'ADMIN_HR', zonePublic: true, zoneInternal: true, permissions: ['config:write'] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('lets ADMIN_HR read configuration and keeps the hard-internal flag off the public zone', async () => {
    const { internalApp, cookie } = await staffSession(adminUser.id, 'ADMIN_HR');

    const read = await request(internalApp).get('/api/staff/config').set('Cookie', cookie);
    expect(read.status).toBe(200);
    const flag = read.body.flags.find((row: { key: string }) => row.key === 'staff_config_ui');
    expect(flag.effectivePublic).toBe(false);

    const write = await request(internalApp)
      .put('/api/staff/config/flags/staff_config_ui')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5174')
      .send({ zonePublic: true, zoneInternal: true });

    expect(write.status).toBe(409);
    expect(write.body.error.code).toBe('HARD_INTERNAL_FLAG');
  });

  it('rejects a mutation from a foreign origin', async () => {
    const { internalApp, cookie } = await staffSession(adminUser.id, 'ADMIN_HR');

    const response = await request(internalApp)
      .put('/api/staff/config/flags/committee_scoring')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ zonePublic: false, zoneInternal: true });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FOREIGN_ORIGIN');
  });

  it('accepts a mutation whose origin is the host that served the page', async () => {
    const { internalApp, cookie } = await staffSession(adminUser.id, 'ADMIN_HR');

    // The containers serve their own built SPA, so the browser's Origin is the
    // API host, which is not one of the Vite dev origins in the allowlist.
    const response = await request(internalApp)
      .put('/api/staff/config/flags/committee_scoring')
      .set('Cookie', cookie)
      .set('Host', 'portal.ada.internal:4001')
      .set('Origin', 'http://portal.ada.internal:4001')
      .send({ zonePublic: false, zoneInternal: true });

    expect(response.status).toBe(200);
  });

  it('reports the permission set the session actually holds', async () => {
    const { internalApp, cookie } = await staffSession(committeeUser.id, 'COMMITTEE');

    const response = await request(internalApp).get('/api/staff/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('COMMITTEE');
    expect(response.body.permissions).toContain('committee:score');
    expect(response.body.permissions).not.toContain('config:read');
  });
});
