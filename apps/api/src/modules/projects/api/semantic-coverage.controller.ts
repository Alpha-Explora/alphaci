import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  CapabilityGuard,
  RequiresCapability,
} from '#kernel/composition/index.js';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard';
import { QaSemanticCoverageService } from '../application/qa-checklists/qa-semantic-coverage.service';
import { requireUserId } from './qa-runs.controller';

/** Semantic test coverage: acceptance criteria against QA test cases, read-only. */
@Controller('delivery-projects/:deliveryProjectId/semantic-coverage')
@UseGuards(SessionAuthGuard, CapabilityGuard)
@RequiresCapability('projects.qa-checklists')
export class SemanticCoverageController {
  constructor(private readonly coverage: QaSemanticCoverageService) {}

  @Get()
  get(
    @Req() req: Request,
    @Param('deliveryProjectId') deliveryProjectId: string,
  ) {
    return this.coverage.forProject(deliveryProjectId, requireUserId(req));
  }
}
