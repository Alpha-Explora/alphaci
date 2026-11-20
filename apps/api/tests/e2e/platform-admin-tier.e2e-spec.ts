import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { startApplication, type E2eApplication } from './support/application';

const MIGRATION = join(
  __dirname,
  '../../supabase/migrations/identity-access/20261120000000_platform_admin_super_only.sql',
);

/**
 * The Admin tier is app_role 'admin'; identity.platform_admins holds only the
 * super-admin. Failure mode: a bare platform 'admin' row made /auth/me and the
 * team and project gates say admin while the Admin Console answered 403.
 */
describe('Platform admin tier', () => {
  let e2e: E2eApplication;

  beforeAll(async () => {
    e2e = await startApplication();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('turns a legacy platform admin row into the Admin app role, with Console access', async () => {
    const { agent, userId } = await e2e.signIn('lead');
    // A row as the old two-tier table allowed it.
    await e2e.query(
      'ALTER TABLE identity.platform_admins DROP CONSTRAINT platform_admins_role_check',
    );
    await e2e.query(
      "ALTER TABLE identity.platform_admins ADD CONSTRAINT platform_admins_role_check CHECK (role IN ('admin', 'super_admin'))",
    );
    await e2e.query(
      "INSERT INTO identity.platform_admins (user_id, role) VALUES ($1, 'admin')",
      [userId],
    );

    await e2e.query(readFileSync(MIGRATION, 'utf8'));

    const [user] = await e2e.query<{
      app_role: string;
      app_role_source: string;
    }>(
      'SELECT app_role, app_role_source FROM identity.app_users WHERE id = $1',
      [userId],
    );
    expect(user).toEqual({ app_role: 'admin', app_role_source: 'manual' });
    expect(
      await e2e.query(
        'SELECT 1 FROM identity.platform_admins WHERE user_id = $1',
        [userId],
      ),
    ).toHaveLength(0);
    await expect(
      e2e.query(
        "INSERT INTO identity.platform_admins (user_id, role) VALUES ($1, 'admin')",
        [userId],
      ),
    ).rejects.toThrow(/platform_admins_role_check/);

    const me = (await agent.get('/api/v1/auth/me').expect(200)).body as {
      appRole: string;
    };
    expect(me.appRole).toBe('admin');
    await agent.get('/api/v1/admin/users').expect(200);
  });

  it('grants only the super-admin tier through the platform role route', async () => {
    const { agent, userId } = await e2e.signIn('admin');
    await e2e.query(
      `INSERT INTO identity.platform_admins (user_id, role) VALUES ($1, 'super_admin')
       ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'`,
      [userId],
    );
    const targetId = randomUUID();
    await e2e.query(
      `INSERT INTO identity.app_users (id, login, github_user_id)
       VALUES ($1::uuid, $1::text, $1::text)`,
      [targetId],
    );

    try {
      await agent
        .post(`/api/v1/admin/users/${targetId}/role`)
        .send({ role: 'admin' })
        .expect(400);
    } finally {
      await e2e.query(
        'DELETE FROM identity.platform_admins WHERE user_id = $1',
        [userId],
      );
    }
  });
});
