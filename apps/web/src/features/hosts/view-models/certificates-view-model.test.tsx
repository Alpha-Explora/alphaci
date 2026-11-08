import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ApiError } from '@/shared/api/request';
import { useCertificatesViewModel } from './use-certificates-view-model';
import {
  deleteCertificate,
  listCertificates,
  uploadCertificate,
} from '../data/certificates-api';
import type { Certificate } from '../model/address-binding';
jest.mock('../data/certificates-api', () => ({
  listCertificates: jest.fn(),
  uploadCertificate: jest.fn(),
  deleteCertificate: jest.fn(),
}));

let root: Root;
function probe<T>(hook: () => T) {
  let snapshot: T;
  function Probe() {
    snapshot = hook();
    return null;
  }
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  return () => snapshot!;
}
async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
  });
}
/** A browser file with only what the view-model reads. */
function file(name: string, contents: { bytes?: number[]; text?: string }) {
  return {
    name,
    arrayBuffer: async () => new Uint8Array(contents.bytes ?? []).buffer,
    text: async () => contents.text ?? '',
  } as unknown as File;
}
const certificate = (overrides: Partial<Certificate> = {}): Certificate => ({
  id: 'c1',
  name: 'Orders',
  hostnames: ['orders.acme.local'],
  issuer: 'Acme CA',
  notBefore: '2026-01-01T00:00:00Z',
  notAfter: '2099-01-01T00:00:00Z',
  sha256: 'a'.repeat(64),
  createdAt: '2026-11-01T00:00:00Z',
  inUse: 0,
  ...overrides,
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listCertificates).mockResolvedValue([certificate()]);
  jest.mocked(uploadCertificate).mockResolvedValue(certificate());
  jest.mocked(deleteCertificate).mockResolvedValue(undefined);
});
afterEach(() => act(() => root?.unmount()));

it("lists the workspace's certificates", async () => {
  const seen = probe(() => useCertificatesViewModel('w/1', true));
  expect(seen().status).toBe('loading');
  await settle();
  expect(listCertificates).toHaveBeenCalledWith('w/1', expect.any(AbortSignal));
  expect(seen().status).toBe('ready');
  expect(seen().certificates).toEqual([certificate()]);
});

it('uploads a .pfx read in the browser as base64, with its password', async () => {
  const seen = probe(() => useCertificatesViewModel('w', true));
  await settle();
  act(() => seen().startUpload());
  act(() => seen().setName(' Orders '));
  expect(seen().draftProblem).toBe('Choose a .pfx or .p12 file.');
  await act(() => seen().choosePfx(file('orders.pfx', { bytes: [0, 1, 2] })));
  act(() => seen().setPassword('secret'));
  expect(seen().draft).toMatchObject({ fileName: 'orders.pfx' });
  expect(seen().draftProblem).toBeNull();
  await act(() => seen().upload());
  expect(uploadCertificate).toHaveBeenCalledWith('w', {
    name: 'Orders',
    pfxBase64: 'AAEC',
    password: 'secret',
  });
  await settle();
  expect(seen().draft).toBeNull();
  expect(listCertificates).toHaveBeenCalledTimes(2);
});

it('uploads a PEM certificate and key, from text or files', async () => {
  const pem = '-----BEGIN CERTIFICATE-----\nMII\n-----END CERTIFICATE-----';
  const key = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';
  const seen = probe(() => useCertificatesViewModel('w', true));
  await settle();
  act(() => seen().startUpload());
  act(() => seen().setName('Orders'));
  act(() => seen().setFormat('pem'));
  expect(seen().draft).toMatchObject({ format: 'pem', name: 'Orders' });
  act(() => seen().setPem('certificatePem', pem));
  await act(() =>
    seen().choosePemFile('privateKeyPem', file('k.key', { text: key })),
  );
  await act(() => seen().upload());
  expect(uploadCertificate).toHaveBeenCalledWith('w', {
    name: 'Orders',
    certificatePem: pem,
    privateKeyPem: key,
  });
});

it("shows the server's reason when it refuses an upload, and keeps the draft", async () => {
  jest
    .mocked(uploadCertificate)
    .mockRejectedValue(new ApiError('The password is wrong.', 400));
  const seen = probe(() => useCertificatesViewModel('w', true));
  await settle();
  act(() => seen().startUpload());
  act(() => seen().setName('Orders'));
  await act(() => seen().choosePfx(file('o.pfx', { bytes: [1] })));
  await act(() => seen().upload());
  expect(seen().error).toBe('The password is wrong.');
  expect(seen().draft).not.toBeNull();
  expect(seen().busy).toBe(false);
});

it('deletes after a confirmation, and never one in use', async () => {
  const seen = probe(() => useCertificatesViewModel('w', true));
  await settle();
  await act(() => seen().remove(certificate({ inUse: 2 })));
  expect(seen().confirmation).toBeNull();
  await act(() => seen().remove(certificate()));
  expect(seen().confirmation).toBe('c1');
  expect(deleteCertificate).not.toHaveBeenCalled();
  await act(() => seen().remove(certificate()));
  expect(deleteCertificate).toHaveBeenCalledWith('w', 'c1');
  expect(seen().confirmation).toBeNull();
});

it('lets a viewer list but not upload or delete', async () => {
  const seen = probe(() => useCertificatesViewModel('w', false));
  await settle();
  act(() => seen().startUpload());
  act(() => seen().setName('Orders'));
  await act(() => seen().choosePfx(file('o.pfx', { bytes: [1] })));
  await act(() => seen().upload());
  await act(() => seen().remove(certificate()));
  await act(() => seen().remove(certificate()));
  expect(uploadCertificate).not.toHaveBeenCalled();
  expect(deleteCertificate).not.toHaveBeenCalled();
});
