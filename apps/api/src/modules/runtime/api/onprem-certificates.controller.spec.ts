import { BadRequestException } from '@nestjs/common';
import { uploadInput } from './onprem-certificates.controller';

describe('certificate upload forms', () => {
  it('takes a .pfx with its password, or an empty password', () => {
    expect(
      uploadInput({ name: 'A', pfxBase64: 'AA==', password: 'p' }),
    ).toEqual({ name: 'A', pfxBase64: 'AA==', password: 'p' });
    expect(uploadInput({ name: 'A', pfxBase64: 'AA==' })).toHaveProperty(
      'password',
      '',
    );
  });
  it('takes a PEM certificate with its key', () => {
    expect(
      uploadInput({ name: 'A', certificatePem: 'c', privateKeyPem: 'k' }),
    ).toEqual({ name: 'A', certificatePem: 'c', privateKeyPem: 'k' });
  });
  it.each([
    { name: 'A' },
    { name: 'A', certificatePem: 'c' },
    { name: 'A', pfxBase64: 'AA==', certificatePem: 'c', privateKeyPem: 'k' },
  ])('refuses %j', (body) => {
    expect(() => uploadInput(body)).toThrow(BadRequestException);
  });
});
