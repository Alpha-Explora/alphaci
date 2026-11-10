import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CapabilityGuard,
  RequiresCapability,
} from '#kernel/composition/index.js';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard';
import {
  CreateProjectTodoDto,
  UpdateProjectTodoDto,
} from '../application/qa-checklists/dto/project-todo.dto';
import { ProjectTodosService } from '../application/qa-checklists/project-todos.service';
import { actorContext, requireUserId } from './qa-runs.controller';

/** Team to-dos of a Project: everyone on the team reads, adds and ticks them. */
@Controller('delivery-projects/:deliveryProjectId/todos')
@UseGuards(SessionAuthGuard, CapabilityGuard)
@RequiresCapability('projects.qa-checklists')
export class ProjectTodosController {
  constructor(private readonly todos: ProjectTodosService) {}

  @Get()
  list(
    @Req() req: Request,
    @Param('deliveryProjectId') deliveryProjectId: string,
  ) {
    return this.todos.list(deliveryProjectId, requireUserId(req));
  }

  @Post()
  create(
    @Req() req: Request,
    @Param('deliveryProjectId') deliveryProjectId: string,
    @Body() body: CreateProjectTodoDto,
  ) {
    const actor = actorContext(req);
    return this.todos.create(
      deliveryProjectId,
      { userId: actor.userId, userLogin: actor.userLogin },
      body,
    );
  }

  @Patch(':todoId')
  update(
    @Req() req: Request,
    @Param('deliveryProjectId') deliveryProjectId: string,
    @Param('todoId') todoId: string,
    @Body() body: UpdateProjectTodoDto,
  ) {
    const actor = actorContext(req);
    return this.todos.update(
      deliveryProjectId,
      todoId,
      { userId: actor.userId, userLogin: actor.userLogin },
      body,
    );
  }

  @Delete(':todoId')
  @HttpCode(204)
  async remove(
    @Req() req: Request,
    @Param('deliveryProjectId') deliveryProjectId: string,
    @Param('todoId') todoId: string,
  ): Promise<void> {
    await this.todos.remove(deliveryProjectId, todoId, requireUserId(req));
  }
}
