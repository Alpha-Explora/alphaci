import {
  Controller,
  Get,
  Param,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CapabilityGuard,
  RequiresCapability,
} from '#kernel/composition/index.js';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard';
import { QueryString } from '#kernel/http/query-string.decorator';
import { QaHistoryService } from '../application/qa-checklists/qa-history.service';
import { QA_REPORT_XLSX_CONTENT_TYPE } from '../application/qa-runs/qa-report.workbook';
import { requireUserId } from './qa-runs.controller';

@Controller('delivery-projects/:deliveryProjectId/qa-history')
@UseGuards(SessionAuthGuard, CapabilityGuard)
@RequiresCapability('projects.qa-checklists')
export class QaHistoryController {
  constructor(private readonly history: QaHistoryService) {}

  /** The Dev and QA audit trail as an Excel workbook (Iteration filter optional). */
  @Get('export')
  async export(
    @Req() req: Request,
    @Param('deliveryProjectId') projectId: string,
    @QueryString('iterationId') iterationId?: string,
  ): Promise<StreamableFile> {
    const file = await this.history.exportWorkbook(
      projectId,
      requireUserId(req),
      iterationId !== undefined ? { iterationId } : {},
    );
    return new StreamableFile(file.content, {
      type: QA_REPORT_XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Get()
  list(
    @Req() req: Request,
    @Param('deliveryProjectId') projectId: string,
    @QueryString('itemId') itemId?: string,
    @QueryString('iterationId') iterationId?: string,
    @QueryString('before') before?: string,
  ) {
    return this.history.list(projectId, requireUserId(req), {
      ...(itemId !== undefined ? { itemId } : {}),
      ...(iterationId !== undefined ? { iterationId } : {}),
      ...(before !== undefined ? { before } : {}),
    });
  }
}
