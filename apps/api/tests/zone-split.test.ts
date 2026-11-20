import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildZonePair, committeeUser } from './helpers.js';

/**
 * The zone split - handoff §3.
 *
 * `ZONE` decides which routers are mounted, not which links are hidden. An
 * internal path on the public host must be indistinguishable from a typo.
 */
describe('zone split', () => {
  it('does not mount the staff router in the public zone', async () => {
    const { publicApp } = buildZonePair();
    const response = await request(publicApp).get('/api/staff/config');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.headers['x-ada-zone']).toBe('public');
  });

  it('answers 404, not 403, for a valid internal session cookie on the public host', async () => {
    const { publicApp, internalApp, mintCookie } = buildZonePair();
    const internalCookie = await mintCookie('internal', {
      kind: 'staff',
      zone: 'internal',
      userId: committeeUser.id,
      role: 'COMMITTEE',
    });

    // The cookie is real: the intranet app accepts it and only then refuses the
    // action on permissions. So the public 404 below is about the zone, not auth.
    const onInternal = await request(internalApp).get('/api/staff/me').set('Cookie', internalCookie);
    expect(onInternal.status).toBe(200);
    expect(onInternal.body.role).toBe('COMMITTEE');

    const onPublic = await request(publicApp).get('/api/staff/config').set('Cookie', internalCookie);
    expect(onPublic.status).toBe(404);
    expect(onPublic.status).not.toBe(403);
    expect(onPublic.body.error.code).toBe('NOT_FOUND');
  });

  it('has no staff auth surface on the public host either', async () => {
    const { publicApp, mintCookie } = buildZonePair();
    const internalCookie = await mintCookie('internal', {
      kind: 'staff',
      zone: 'internal',
      userId: committeeUser.id,
      role: 'COMMITTEE',
    });

    for (const path of ['/api/staff/me', '/api/staff/auth/me', '/api/staff/auth/logout']) {
      const response = await request(publicApp).get(path).set('Cookie', internalCookie);
      expect(response.status, path).toBe(404);
    }
  });

  it('refuses a public cookie on the intranet host', async () => {
    const { internalApp, mintCookie } = buildZonePair();
    const publicCookie = await mintCookie('public', { kind: 'student', zone: 'public', applicationId: 'app-1' });
    const response = await request(internalApp).get('/api/staff/me').set('Cookie', publicCookie);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('destroys a session whose zone claim does not match the process', async () => {
    const { publicApp, mintCookie } = buildZonePair();
    // A cookie named for the public zone but carrying an internal zone claim.
    const forged = await mintCookie('public', {
      kind: 'staff',
      zone: 'internal',
      userId: committeeUser.id,
      role: 'COMMITTEE',
    });
    const response = await request(publicApp).get('/api/public/application').set('Cookie', forged);
    expect(response.status).toBe(401);
  });

  it('serves the public router on the public host', async () => {
    const { publicApp } = buildZonePair();
    const health = await request(publicApp).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ ok: true, zone: 'public' });
  });
});
