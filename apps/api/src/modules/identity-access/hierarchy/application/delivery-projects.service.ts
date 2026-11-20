import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { deliveryProjectNotFound } from './hierarchy.errors';

import { AuditEventPublisher } from '#kernel/events/platform-event-publisher.js';
import {
  DELIVERY_PROJECT_DATA_CLEANUP,
  type DeliveryProjectDataCleanupPort,
} from '#kernel/ports/delivery-project-data-cleanup.port';
import {
  PROJECT_LIFECYCLE_PORT,
  type ProjectLifecyclePort,
} from '#kernel/ports/project-lifecycle.port';
import { HierarchyAccessService } from './hierarchy-access.service';
import { HIERARCHY_EVENT_CODES } from '../domain/hierarchy.types';
import {
  DeliveryProjectsRepository,
  type DeliveryProjectRecord,
} from '../infrastructure/delivery-projects.repository';
import { RepositoriesRepository } from '../infrastructure/repositories.repository';
import {
  SystemsRepository,
  type SystemRecord,
} from '../infrastructure/systems.repository';
import type { CreateDeliveryProjectDto } from '../api/dto/create-delivery-project.dto';
import type { DeleteDeliveryProjectDto } from '../api/dto/delete-delivery-project.dto';
import type { UpdateDeliveryProjectDto } from '../api/dto/update-delivery-project.dto';

export interface DeleteDeliveryProjectRepositoryResult {
  repositoryId: string;
  name: string;
  projectId: string | null;
  githubRepoDeleted: boolean;
}

export interface DeleteDeliveryProjectResult {
  deliveryProjectId: string;
  name: string;
  deletedRepositories: DeleteDeliveryProjectRepositoryResult[];
}

/** Strips disconnectProject's own "kept so you can try again" clause so the
 * outer 409 message can restate it one level up, about the Project (folder)
 * rather than the individual AlphaCI project. */
const KEPT_CLAUSE_RE = /the project was kept so you can try again\.?$/i;

function stripKeptClause(message: string): string {
  return message.replace(KEPT_CLAUSE_RE, '').trim();
}

/** Best-effort `{ code, message }` extraction from a failure raised partway
 * through a delivery-project delete, so the 409 response can surface the
 * underlying reason (e.g. disconnectProject's 'missing_scope',
 * 'provider_delete_failed', 'sonar_delete_failed') instead of a generic one. */
function describeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      const code =
        typeof body.code === 'string'
          ? body.code
          : 'DELIVERY_PROJECT_DELETE_PARTIAL';
      const message =
        typeof body.message === 'string' ? body.message : error.message;
      return { code, message: stripKeptClause(message) };
    }
    return {
      code: 'DELIVERY_PROJECT_DELETE_PARTIAL',
      message: stripKeptClause(error.message),
    };
  }
  return {
    code: 'DELIVERY_PROJECT_DELETE_PARTIAL',
    message: stripKeptClause(
      error instanceof Error ? error.message : String(error),
    ),
  };
}

@Injectable()
export class DeliveryProjectsService {
  private readonly logger = new Logger(DeliveryProjectsService.name);

  constructor(
    private readonly deliveryProjectsRepository: DeliveryProjectsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly systemsRepository: SystemsRepository,
    private readonly accessService: HierarchyAccessService,
    private readonly auditEventsService: AuditEventPublisher,
    @Inject(PROJECT_LIFECYCLE_PORT)
    private readonly projectLifecyclePort: ProjectLifecyclePort,
    @Inject(DELIVERY_PROJECT_DATA_CLEANUP)
    private readonly deliveryProjectDataCleanup: DeliveryProjectDataCleanupPort,
  ) {}

  /**
   * Creates a Project under an existing System (POST
   * /systems/:id/delivery-projects). Same unique-name rule as every other
   * caller-named Project: 409 PROJECT_NAME_TAKEN.
   */
  async createDeliveryProject(
    systemId: string,
    userId: string,
    dto: CreateDeliveryProjectDto,
  ): Promise<DeliveryProjectRecord> {
    const { groupId } = await this.accessService.assertCanCreateUnderSystem(
      systemId,
      userId,
    );
    const deliveryProject =
      await this.deliveryProjectsRepository.withUniqueName(
        groupId,
        dto.name,
        (tx) =>
          this.deliveryProjectsRepository.create(
            {
              systemId,
              groupId,
              name: dto.name,
              description: dto.description ?? null,
              managerId: userId,
            },
            tx,
          ),
      );
    await this.recordCreated(deliveryProject, userId);
    return deliveryProject;
  }

  /**
   * Creates a System and its Project, both named `name`, in one transaction
   * under the team's unique-name rule, so a taken name leaves no orphan
   * System. The caller has already checked who may create here.
   */
  async createWithSystem(
    groupId: string,
    userId: string,
    input: { name: string; description?: string | null },
  ): Promise<{ system: SystemRecord; deliveryProject: DeliveryProjectRecord }> {
    const created = await this.deliveryProjectsRepository.withUniqueName(
      groupId,
      input.name,
      async (tx) => {
        const system = await this.systemsRepository.create(
          {
            groupId,
            name: input.name,
            description: input.description ?? null,
            ownerId: userId,
          },
          tx,
        );
        const deliveryProject = await this.deliveryProjectsRepository.create(
          {
            systemId: system.id,
            groupId,
            name: input.name,
            description: input.description ?? null,
            managerId: userId,
          },
          tx,
        );
        return { system, deliveryProject };
      },
    );
    await this.auditEventsService.recordProjectEvent({
      workspaceId: groupId,
      actorUserId: userId,
      eventCode: HIERARCHY_EVENT_CODES.systemCreated,
      message: `System "${created.system.name}" created`,
      metadata: { groupId, systemId: created.system.id },
    });
    await this.recordCreated(created.deliveryProject, userId);
    return created;
  }

  private async recordCreated(
    deliveryProject: DeliveryProjectRecord,
    userId: string,
  ): Promise<void> {
    await this.auditEventsService.recordProjectEvent({
      workspaceId: deliveryProject.groupId,
      actorUserId: userId,
      eventCode: HIERARCHY_EVENT_CODES.deliveryProjectCreated,
      message: `Delivery project "${deliveryProject.name}" created`,
      metadata: {
        groupId: deliveryProject.groupId,
        systemId: deliveryProject.systemId,
        deliveryProjectId: deliveryProject.id,
      },
    });
  }

  async listDeliveryProjects(
    systemId: string,
    userId: string,
  ): Promise<DeliveryProjectRecord[]> {
    await this.accessService.assertSystemMembership(systemId, userId);
    return this.deliveryProjectsRepository.listBySystem(systemId);
  }

  async getDeliveryProject(
    deliveryProjectId: string,
    userId: string,
  ): Promise<DeliveryProjectRecord> {
    await this.accessService.assertDeliveryProjectMembership(
      deliveryProjectId,
      userId,
    );
    const deliveryProject =
      await this.deliveryProjectsRepository.findById(deliveryProjectId);
    if (!deliveryProject) {
      throw deliveryProjectNotFound();
    }
    return deliveryProject;
  }

  async updateDeliveryProject(
    deliveryProjectId: string,
    userId: string,
    dto: UpdateDeliveryProjectDto,
  ): Promise<DeliveryProjectRecord> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      userId,
    );
    // A rename keeps the team's unique-name rule; a description-only edit
    // needs no lock.
    const deliveryProject =
      dto.name === undefined
        ? await this.deliveryProjectsRepository.update(deliveryProjectId, dto)
        : await this.deliveryProjectsRepository.withUniqueName(
            groupId,
            dto.name,
            (tx) =>
              this.deliveryProjectsRepository.update(
                deliveryProjectId,
                dto,
                tx,
              ),
            deliveryProjectId,
          );
    if (!deliveryProject) {
      throw deliveryProjectNotFound();
    }

    await this.auditEventsService.recordProjectEvent({
      workspaceId: groupId,
      actorUserId: userId,
      eventCode: HIERARCHY_EVENT_CODES.deliveryProjectUpdated,
      message: `Delivery project "${deliveryProject.name}" updated`,
      metadata: { groupId, deliveryProjectId },
    });

    return deliveryProject;
  }

  async archiveDeliveryProject(
    deliveryProjectId: string,
    userId: string,
  ): Promise<DeliveryProjectRecord> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      userId,
    );
    const deliveryProject =
      await this.deliveryProjectsRepository.archive(deliveryProjectId);
    if (!deliveryProject) {
      throw deliveryProjectNotFound();
    }

    await this.auditEventsService.recordProjectEvent({
      workspaceId: groupId,
      actorUserId: userId,
      eventCode: HIERARCHY_EVENT_CODES.deliveryProjectArchived,
      message: `Delivery project "${deliveryProject.name}" archived`,
      metadata: { groupId, deliveryProjectId },
    });

    return deliveryProject;
  }

  async reopenDeliveryProject(
    deliveryProjectId: string,
    userId: string,
  ): Promise<DeliveryProjectRecord> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      userId,
    );
    const current =
      await this.deliveryProjectsRepository.findById(deliveryProjectId);
    if (!current) throw deliveryProjectNotFound();
    if (current.status === 'active') return current;

    const reopened = await this.deliveryProjectsRepository.reopen(current);
    const project =
      await this.deliveryProjectsRepository.findById(deliveryProjectId);
    if (!project) throw deliveryProjectNotFound();
    if (project.status !== 'active') {
      throw new ConflictException({
        code: 'PROJECT_REOPEN_CONFLICT',
        message:
          'The Project changed while it was being reopened. Reload and try again.',
      });
    }
    if (reopened) {
      await this.auditEventsService.recordProjectEvent({
        workspaceId: groupId,
        actorUserId: userId,
        eventCode: HIERARCHY_EVENT_CODES.deliveryProjectReopened,
        message: `Project "${project.name}" reopened`,
        metadata: { groupId, deliveryProjectId },
      });
    }
    return project;
  }

  /**
   * Deletes a Project (delivery project / "folder") together with every
   * repository inside it. Each repository is handled sequentially:
   *   - linked (provisionedProjectId set): its AlphaCI project is
   *     disconnected via PROJECT_LIFECYCLE_PORT (reuses disconnectProject's
   *     GitHub/Render/Vercel/Sonar teardown — not reimplemented here). An
   *     already-gone project (NotFoundException) is treated as success.
   *   - ghost (provisionedProjectId null): only the hierarchy row is
   *     removed.
   * The first repository that fails to go stops the whole operation: the
   * delivery project (and every repository not yet processed) is kept, and
   * the failure is reported as 409 alongside what was already deleted, so a
   * retry does not repeat completed work. Only once every repository is
   * gone are the delivery project row, and then its system if now empty,
   * removed.
   */
  async deleteDeliveryProject(
    deliveryProjectId: string,
    userId: string,
    dto: DeleteDeliveryProjectDto,
    githubAccessToken?: string | null,
  ): Promise<DeleteDeliveryProjectResult> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      userId,
    );
    const deliveryProject =
      await this.deliveryProjectsRepository.findById(deliveryProjectId);
    if (!deliveryProject) {
      throw deliveryProjectNotFound();
    }

    if (dto.confirmName !== deliveryProject.name) {
      this.logger.warn(
        `Delete rejected for delivery project ${deliveryProjectId}: confirmName did not match "${deliveryProject.name}".`,
      );
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DELIVERY_PROJECT_NAME_MISMATCH',
        message: `confirmName does not match this Project's name ("${deliveryProject.name}"). Nothing was deleted.`,
      });
    }

    const options = {
      deleteGithubRepos: dto.deleteGithubRepos === true,
      deleteProviderResources: dto.deleteProviderResources === true,
      deleteSonarProjects: dto.deleteSonarProjects === true,
    };

    const repositories =
      await this.repositoriesRepository.listByDeliveryProjectForManager(
        deliveryProjectId,
      );
    this.logger.log(
      `Deleting delivery project ${deliveryProjectId} ("${deliveryProject.name}") with ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'}.`,
    );

    const deletedRepositories: DeleteDeliveryProjectRepositoryResult[] = [];
    for (const repository of repositories) {
      try {
        let githubRepoDeleted = false;

        if (repository.provisionedProjectId) {
          try {
            const result = await this.projectLifecyclePort.disconnectProject(
              repository.provisionedProjectId,
              userId,
              {
                deleteGithubRepo: options.deleteGithubRepos,
                deleteProviderResources: options.deleteProviderResources,
                deleteSonarProject: options.deleteSonarProjects,
              },
              githubAccessToken,
            );
            githubRepoDeleted = result.githubRepoDeleted;
          } catch (error) {
            if (!(error instanceof NotFoundException)) {
              throw error;
            }
            this.logger.log(
              `Project ${repository.provisionedProjectId} behind repository "${repository.name}" (${repository.id}) was already gone; treating as deleted.`,
            );
          }
        }

        const rowDeleted = await this.repositoriesRepository.deleteById(
          repository.id,
        );
        if (!rowDeleted) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'REPOSITORY_ALREADY_DELETED',
            message: `Repository "${repository.name}" was already removed by another request.`,
          });
        }

        deletedRepositories.push({
          repositoryId: repository.id,
          name: repository.name,
          projectId: repository.provisionedProjectId,
          githubRepoDeleted,
        });
        this.logger.log(
          `Deleted repository "${repository.name}" (${repository.id}) from delivery project ${deliveryProjectId}.`,
        );
      } catch (error) {
        const { code, message } = describeFailure(error);
        this.logger.error(
          `Delivery project ${deliveryProjectId} delete stopped at repository "${repository.name}" (${repository.id}): ${message}`,
        );
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code,
          message: `${message} The Project was kept so you can try again.`,
          deletedRepositories,
          failedRepository: {
            repositoryId: repository.id,
            name: repository.name,
          },
        });
      }
    }

    // The Project's QA requirements go with it. Before the row is deleted, so a
    // failure here keeps the Project and the delete can be retried; QA runs
    // stay as history because each carries its own snapshot.
    await this.deliveryProjectDataCleanup.purgeDeliveryProject(
      deliveryProjectId,
    );

    const deliveryProjectDeleted =
      await this.deliveryProjectsRepository.deleteById(deliveryProjectId);
    if (!deliveryProjectDeleted) {
      throw deliveryProjectNotFound();
    }

    const remainingDeliveryProjects =
      await this.deliveryProjectsRepository.countBySystem(
        deliveryProject.systemId,
      );
    if (remainingDeliveryProjects === 0) {
      await this.systemsRepository.deleteById(deliveryProject.systemId);
      this.logger.log(
        `System ${deliveryProject.systemId} had no remaining delivery projects; deleted.`,
      );
    }

    await this.auditEventsService.recordProjectEvent({
      workspaceId: groupId,
      actorUserId: userId,
      eventCode: HIERARCHY_EVENT_CODES.deliveryProjectDeleted,
      message: `Delivery project "${deliveryProject.name}" deleted`,
      metadata: {
        groupId,
        deliveryProjectId,
        repositories: deletedRepositories.map((repo) => repo.name),
        options,
      },
    });

    return {
      deliveryProjectId,
      name: deliveryProject.name,
      deletedRepositories,
    };
  }
}
