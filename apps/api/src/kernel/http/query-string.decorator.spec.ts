import type { Server } from 'node:http';

import {
  Controller,
  Get,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';

import { QueryString } from './query-string.decorator';

@Controller('probe')
class ProbeController {
  @Get()
  read(@QueryString('branch') branch?: string, @QueryString('path') path = '') {
    return { branch: branch ?? null, path };
  }
}

describe('QueryString', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    // As in main.ts, so the decorator is proven next to the real global pipe.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  const read = (query: string) =>
    request(app.getHttpServer() as Server)
      .get(`/probe${query}`)
      .expect(200);

  it('reads one string', async () => {
    const response = await read('?branch=main&path=src/app.ts');
    expect(response.body).toEqual({ branch: 'main', path: 'src/app.ts' });
  });

  it('reads an absent parameter as undefined, so a default applies', async () => {
    expect((await read('')).body).toEqual({ branch: null, path: '' });
  });

  it('drops a repeated parameter instead of joining it', async () => {
    expect((await read('?branch=a&branch=b')).body.branch).toBeNull();
  });

  it('drops a nested parameter', async () => {
    expect((await read('?branch[x]=1')).body.branch).toBeNull();
  });

  it('keeps the parameter in the Swagger document', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const parameters = document.paths['/probe']?.get?.parameters ?? [];
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'branch',
          in: 'query',
          required: false,
        }),
        expect.objectContaining({ name: 'path', in: 'query', required: false }),
      ]),
    );
  });
});
