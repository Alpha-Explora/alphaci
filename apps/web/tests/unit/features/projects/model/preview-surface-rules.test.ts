import {
  previewHostLabel,
  previewProviderLabel,
  previewSurface,
} from '../../../../../src/features/projects/model/projects-rules';

describe('preview surface rules', () => {
  it('shows logs only when the backend says so, and the page otherwise', () => {
    expect(previewSurface({ surface: 'logs' })).toBe('logs');
    expect(previewSurface({ surface: 'page' })).toBe('page');
    // An older backend omits the field.
    expect(previewSurface({} as Parameters<typeof previewSurface>[0])).toBe(
      'page',
    );
  });

  it("labels the host from the backend's descriptor, else from the provider id", () => {
    expect(
      previewHostLabel({
        provider: 'render',
        providerLabel: 'Render (Oregon)',
      }),
    ).toBe('Render (Oregon)');
    // An older backend sends no providerLabel.
    expect(
      previewHostLabel({ provider: 'vercel' } as Parameters<
        typeof previewHostLabel
      >[0]),
    ).toBe('Vercel');
    expect(previewHostLabel({ provider: 'render', providerLabel: '' })).toBe(
      'Render',
    );
    expect(
      previewHostLabel({ provider: 'onprem-compose', providerLabel: '' }),
    ).toBe('On-prem host (Docker Compose)');
  });

  it('names every provider the backend registers', () => {
    expect(previewProviderLabel('vercel')).toBe('Vercel');
    expect(previewProviderLabel('render')).toBe('Render');
    expect(previewProviderLabel('gcp')).toBe('Google Cloud Platform');
    expect(previewProviderLabel('onprem-compose')).toBe(
      'On-prem host (Docker Compose)',
    );
  });

  it("never calls an unknown provider by another provider's name", () => {
    expect(previewProviderLabel('fly-io')).toBe('Fly Io');
    expect(previewProviderLabel('azure_container_apps')).toBe(
      'Azure Container Apps',
    );
    expect(previewProviderLabel('netlify')).toBe('Netlify');
    expect(previewProviderLabel('')).toBe('Hosting provider');
  });
});
