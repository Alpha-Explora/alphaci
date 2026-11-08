import type { AssignmentConfig } from '#kernel/ports/onprem-assignment.port';
import { addressBindingOrder } from './onprem-machines.repository';

const CERTIFICATE = '3f0e8a52-6b1c-4d1e-9a51-0b7f6c2d9e10';
const row = (ingress: AssignmentConfig['ingress']) => ({
  id: 'assignment',
  project_id: 'project',
  environment_id: 'env',
  assignment_config: {
    ports: [
      { slot: 'backend' as const, hostPort: 8081, containerPort: 4000 },
      { slot: 'frontend' as const, hostPort: 8080, containerPort: 3000 },
    ],
    health: [],
    ingress,
  },
});
const binding = (tls: Record<string, string>) =>
  ({
    mode: 'bound',
    publicUrl: 'https://orders.acme.local',
    binding: { hostname: 'orders.acme.local', listenAddress: null, tls },
  }) as AssignmentConfig['ingress'];

describe('addressBindingOrder', () => {
  it("serves the frontend's host port with the certificate's hash", () => {
    expect(
      addressBindingOrder(
        row(binding({ kind: 'certificate', certificateId: CERTIFICATE })),
        'a'.repeat(64),
      ),
    ).toEqual([
      {
        assignmentId: 'assignment',
        projectId: 'project',
        environmentId: 'env',
        hostPort: 8080,
        hostname: 'orders.acme.local',
        listenAddress: null,
        tls: {
          kind: 'certificate',
          certificateId: CERTIFICATE,
          sha256: 'a'.repeat(64),
        },
      },
    ]);
  });
  it('orders nothing for a deleted certificate or another mode', () => {
    expect(
      addressBindingOrder(
        row(binding({ kind: 'certificate', certificateId: CERTIFICATE })),
        null,
      ),
    ).toEqual([]);
    expect(
      addressBindingOrder(row({ mode: 'direct', publicUrl: null }), null),
    ).toEqual([]);
  });
  it('passes acme and internal through', () => {
    expect(
      addressBindingOrder(row(binding({ kind: 'acme' })), null)[0]?.tls,
    ).toEqual({ kind: 'acme' });
  });
});
