import { startApplication, type E2eApplication } from './support/application';

/**
 * Deleting an account ends every session of it, not only the one that asked.
 * Failure mode: a second browser, signed in before the deletion, kept acting
 * as the archived account because the session guard trusted the session's
 * cached copy of the user.
 */
describe('Account deletion and other sessions', () => {
  let e2e: E2eApplication;

  beforeAll(async () => {
    e2e = await startApplication();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('signs out every session of the deleted account', async () => {
    const first = await e2e.signIn();
    const second = await e2e.signIn();
    expect(second.userId).toBe(first.userId);
    await second.agent.get('/api/v1/auth/me').expect(200);

    await first.agent.delete('/api/v1/auth/account').expect(200);

    await first.agent.get('/api/v1/auth/me').expect(401);
    await second.agent.get('/api/v1/auth/me').expect(401);
    await second.agent.get('/api/v1/me/groups').expect(401);
  });
});
