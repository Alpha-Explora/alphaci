import {
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  CapabilityGuard,
  RequiresCapability,
} from '#kernel/composition/index.js';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard';
import { forbidden } from '#kernel/http/coded-errors';
import { QaAccessService } from '../application/qa-checklists/qa-access.service';
import { QaProjectContextService } from '../application/qa-checklists/qa-project-context.service';
import {
  parseQaImportFile,
  type QaImportFile,
} from '../application/qa-checklists/qa-import-file';
import { requireUserId } from './qa-runs.controller';

@Controller('delivery-projects/:deliveryProjectId/qa-import-preview')
@UseGuards(SessionAuthGuard, CapabilityGuard)
@RequiresCapability('projects.qa-checklists')
export class QaImportController {
  constructor(
    private readonly context: QaProjectContextService,
    private readonly access: QaAccessService,
  ) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async preview(
    @Req() req: Request,
    @Param('deliveryProjectId') projectId: string,
    @UploadedFile() file: QaImportFile | undefined,
  ) {
    await this.authorize(req, projectId);
    return parseQaImportFile(file);
  }

  private async authorize(req: Request, projectId: string): Promise<void> {
    const userId = requireUserId(req);
    await this.context.requireProject(projectId, userId);
    // findQaRole: a Developer holding qa_release imports test cases as QA, the
    // same rule saving them uses.
    const role = await this.access.findQaRole(userId);
    if (role !== 'lead' && role !== 'qa' && role !== 'admin')
      throw forbidden(
        'QA_IMPORT_FORBIDDEN',
        'Import is available to Product owners and QA.',
      );
  }
}
