import { GoogleCloudRuntimeAdapter } from './google-cloud-runtime.adapter';

const labels = {
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  environment: 'prod' as const,
};

describe('GoogleCloudRuntimeAdapter', () => {
  it('creates a missing Artifact Registry repository through authenticated REST calls', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'not found' } }), {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: true })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'projects/shared/locations/asia-southeast1/repositories/alphaci',
          }),
        ),
      );
    const adapter = new GoogleCloudRuntimeAdapter(
      {
        getClient: jest.fn().mockResolvedValue({
          // The real client returns a fetch Headers object, not a plain one.
          getRequestHeaders: jest
            .fn()
            .mockResolvedValue(new Headers({ Authorization: 'Bearer test' })),
        }),
      },
      fetchFn,
    );

    await expect(
      adapter.ensureArtifactRegistry({
        gcpProjectId: 'shared',
        region: 'asia-southeast1',
        repository: 'alphaci',
        labels,
      }),
    ).resolves.toMatchObject({
      repositoryUri: 'asia-southeast1-docker.pkg.dev/shared/alphaci',
    });
    expect(fetchFn.mock.calls[1]?.[0]).toContain(
      'repositories?repositoryId=alphaci',
    );
    const init = fetchFn.mock.calls[1]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    const sent = new Headers(init.headers);
    expect(sent.get('authorization')).toBe('Bearer test');
    expect(sent.get('content-type')).toBe('application/json');
  });

  it('returns an existing Cloud Run service without making a mutation', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'projects/shared/locations/asia-southeast1/services/orders',
          uri: 'https://orders.example.run',
          latestReadyRevision: 'orders-00001',
        }),
      ),
    );
    const adapter = new GoogleCloudRuntimeAdapter(
      {
        getClient: jest.fn().mockResolvedValue({
          getRequestHeaders: jest.fn().mockResolvedValue(new Headers()),
        }),
      },
      fetchFn,
    );

    await expect(
      adapter.ensureCloudRunService({
        gcpProjectId: 'shared',
        region: 'asia-southeast1',
        serviceName: 'orders',
        imageName: 'asia-southeast1-docker.pkg.dev/shared/alphaci/orders:main',
        runtimeServiceAccountEmail: 'runtime@shared.iam.gserviceaccount.com',
        labels,
      }),
    ).resolves.toMatchObject({
      serviceUrl: 'https://orders.example.run',
      revision: 'orders-00001',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('uses bounded backoff while waiting for an asynchronous operation', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'operations/repo-1' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: true })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'repositories/alphaci' })),
      );
    const delay = jest.fn().mockResolvedValue(undefined);
    const adapter = new GoogleCloudRuntimeAdapter(
      {
        getClient: jest.fn().mockResolvedValue({
          getRequestHeaders: jest.fn().mockResolvedValue(new Headers()),
        }),
      },
      fetchFn,
      delay,
    );

    await adapter.ensureArtifactRegistry({
      gcpProjectId: 'shared',
      region: 'asia-southeast1',
      repository: 'alphaci',
      labels,
    });

    expect(delay).toHaveBeenCalledWith(1_000);
  });
});
