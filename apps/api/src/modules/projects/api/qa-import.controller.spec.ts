import type { Request } from 'express';

import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import type { QaAccessService } from '../application/qa-checklists/qa-access.service';
import type { QaProjectContextService } from '../application/qa-checklists/qa-project-context.service';
import { QaImportController } from './qa-import.controller';

function setup(qaRole: PlatformAppRole) {
  const context = {
    requireProject: jest.fn().mockResolvedValue({ deliveryProjectId: 'dp-1' }),
  } as unknown as QaProjectContextService;
  const access = {
    findQaRole: jest.fn().mockResolvedValue(qaRole),
  } as unknown as QaAccessService;
  return new QaImportController(context, access);
}

const req = { session: { userId: 'user-1' } } as unknown as Request;

describe('QaImportController preview', () => {
  it('lets a Developer holding qa_release (QA role) read the file', async () => {
    // No file: past the role check, the parser refuses it.
    await expect(
      setup('qa').preview(req, 'dp-1', undefined),
    ).rejects.toMatchObject({
      response: { code: 'QA_IMPORT_FILE_EMPTY' },
    });
  });

  it('refuses a plain Developer with QA_IMPORT_FORBIDDEN', async () => {
    await expect(
      setup('member').preview(req, 'dp-1', undefined),
    ).rejects.toMatchObject({
      response: { code: 'QA_IMPORT_FORBIDDEN' },
    });
  });
});
