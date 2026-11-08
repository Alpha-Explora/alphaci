import type { Server } from 'node:http';

import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { CapabilityGuard } from '../../src/kernel/composition/capability.guard';
import { CAPABILITY_RESOLVER } from '../../src/kernel/composition/capability-resolver.port';
import { REQUIRED_CAPABILITIES } from '../../src/kernel/composition/requires-capability.decorator';
import { SessionAuthGuard } from '../../src/kernel/auth/session-auth.guard';
import { SubscriptionGuard } from '../../src/kernel/auth/subscription.guard';
import { EnvironmentReleasesController } from '../../src/modules/runtime/api/environment-releases.controller';
import { DeliveryProjectIterationsController } from '../../src/modules/projects/api/project-iterations.controller';
import { ProjectIterationsService } from '../../src/modules/projects/application/qa-checklists/project-iterations.service';
import { ProjectIterationStartService } from '../../src/modules/projects/application/qa-runs/project-iteration-start.service';
import { QaProjectDeliveryService } from '../../src/modules/projects/application/qa-runs/qa-project-delivery.service';
import {
  ProjectQaPromotionController,
  DeliveryProjectPromotionController,
} from '../../src/modules/projects/api/qa-runs.controller';
import { DeliveryProjectQaRunsController } from '../../src/modules/projects/api/qa-project-runs.controller';
import { OnpremAgentController } from '../../src/modules/runtime/api/onprem-agent.controller';
import { OnpremEnrollmentController } from '../../src/modules/runtime/api/onprem-enrollment.controller';
import { ReleaseRegistryService } from '../../src/modules/runtime/application/release-registry.service';
import { OnpremHostsService } from '../../src/modules/runtime/application/onprem/onprem-hosts.service';
import { OnpremCertificatesService } from '../../src/modules/runtime/application/onprem/onprem-certificates.service';

describe('separated capability boundaries', () => {
  it('denies the environment-scoped host token endpoint while leaving shared deployment reads available', async () => {
    const createHost = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [EnvironmentReleasesController],
      providers: [
        Reflector,
        CapabilityGuard,
        {
          provide: CAPABILITY_RESOLVER,
          useValue: { for: () => new Set(['runtime.env-provisioning']) },
        },
        {
          provide: ReleaseRegistryService,
          useValue: { createHost, listEnvironmentDeployments: () => [] },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = module.createNestApplication();
    app.use((req: { session?: unknown }, _res: unknown, next: () => void) => {
      req.session = { user: { id: 'user' } };
      next();
    });
    await app.init();
    try {
      const base =
        '/projects/project/environments/11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer() as Server)
        .get(base + '/deployments')
        .expect(200);
      await request(app.getHttpServer() as Server)
        .post(base + '/hosts')
        .send({ name: 'host' })
        .expect(404);
      expect(createHost).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('leaves iteration reads shared while denying governance writes', async () => {
    const start = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [DeliveryProjectIterationsController],
      providers: [
        Reflector,
        CapabilityGuard,
        {
          provide: CAPABILITY_RESOLVER,
          useValue: { for: () => new Set(['projects.qa-checklists']) },
        },
        {
          provide: ProjectIterationsService,
          useValue: { listForProject: () => [] },
        },
        { provide: ProjectIterationStartService, useValue: { start } },
        { provide: QaProjectDeliveryService, useValue: {} },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = module.createNestApplication();
    app.use((req: { session?: unknown }, _res: unknown, next: () => void) => {
      req.session = { user: { id: 'user' } };
      next();
    });
    await app.init();
    try {
      await request(app.getHttpServer() as Server)
        .get('/delivery-projects/project/iterations')
        .expect(200);
      await request(app.getHttpServer() as Server)
        .post('/delivery-projects/project/iterations')
        .send({})
        .expect(404);
      expect(start).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('protects every governance mutation independently of shared QA reads', () => {
    const reflector = new Reflector();
    for (const handler of [
      DeliveryProjectIterationsController.prototype.start,
      ProjectQaPromotionController.prototype.merge,
      DeliveryProjectPromotionController.prototype.mergeAll,
      DeliveryProjectQaRunsController.prototype.acceptItem,
    ]) {
      expect(reflector.get(REQUIRED_CAPABILITIES, handler)).toEqual([
        'projects.release-governance',
      ]);
    }
  });

  it('denies machine bootstrap and agent calls without consuming credentials or calling services', async () => {
    const enroll = jest.fn();
    const heartbeat = jest.fn();
    const hostAssignments = jest.fn().mockResolvedValue([]);
    const reportHostStatus = jest.fn();
    const certificate = jest.fn();
    const allowed = new Set<string>();
    const module = await Test.createTestingModule({
      controllers: [OnpremAgentController, OnpremEnrollmentController],
      providers: [
        Reflector,
        CapabilityGuard,
        { provide: CAPABILITY_RESOLVER, useValue: { for: () => allowed } },
        {
          provide: ReleaseRegistryService,
          useValue: { hostAssignments, reportHostStatus },
        },
        {
          provide: OnpremHostsService,
          useValue: { consumeEnrollment: enroll, heartbeat },
        },
        {
          provide: OnpremCertificatesService,
          useValue: { forMachine: certificate },
        },
        { provide: ConfigService, useValue: { get: () => 'true' } },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer() as Server)
        .get('/onprem/assignments')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
      await request(app.getHttpServer() as Server)
        .post('/onprem/enroll')
        .send({ code: 'test' })
        .expect(404);
      await request(app.getHttpServer() as Server)
        .post('/onprem/heartbeat')
        .send({})
        .expect(404);
      await request(app.getHttpServer() as Server)
        .get('/onprem/installer/test')
        .expect(404);
      await request(app.getHttpServer() as Server)
        .post('/onprem/deployments/test/status')
        .send({})
        .expect(404);
      await request(app.getHttpServer() as Server)
        .get('/onprem/certificates/3f0e8a52-6b1c-4d1e-9a51-0b7f6c2d9e10')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
      expect(certificate).not.toHaveBeenCalled();
      expect(hostAssignments).not.toHaveBeenCalled();
      expect(enroll).not.toHaveBeenCalled();
      expect(heartbeat).not.toHaveBeenCalled();
      expect(reportHostStatus).not.toHaveBeenCalled();
      allowed.add('runtime.managed-host-delivery');
      await request(app.getHttpServer() as Server)
        .get('/onprem/assignments')
        .set('Authorization', 'Bearer test-token')
        .expect(200);
      expect(hostAssignments).toHaveBeenCalledWith('test-token');
    } finally {
      await app.close();
    }
  });
});
