import { vercelCiSecretNames } from './workflow-fragment.port';

describe('vercelCiSecretNames', () => {
  it('names a legacy target by its slot alone', () => {
    expect(vercelCiSecretNames('frontend')).toEqual({
      token: 'VERCEL_FRONTEND_TOKEN',
      orgId: 'VERCEL_FRONTEND_ORG_ID',
      projectId: 'VERCEL_FRONTEND_PROJECT_ID',
    });
    expect(vercelCiSecretNames('frontend', null)).toEqual(
      vercelCiSecretNames('frontend'),
    );
  });

  it('adds the environment to the name', () => {
    expect(vercelCiSecretNames('frontend', 'qa')).toEqual({
      token: 'VERCEL_FRONTEND_QA_TOKEN',
      orgId: 'VERCEL_FRONTEND_QA_ORG_ID',
      projectId: 'VERCEL_FRONTEND_QA_PROJECT_ID',
    });
  });

  it('turns hyphens into underscores, so the name is valid for GitHub', () => {
    const { token } = vercelCiSecretNames('frontend', 'pre-prod-2');

    expect(token).toBe('VERCEL_FRONTEND_PRE_PROD_2_TOKEN');
    expect(token).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('gives every environment of a slot its own names', () => {
    const slugs = ['dev', 'qa', 'staging', 'pre-prod', 'main'];
    const tokens = slugs.map(
      (slug) => vercelCiSecretNames('frontend', slug).token,
    );

    expect(new Set(tokens).size).toBe(slugs.length);
  });
});
