import type { NotFoundException } from '@nestjs/common';
import { notFound } from '#kernel/http/coded-errors';

/**
 * The "no such row" answers of the hierarchy. Each is a distinct code so the
 * web app can tell a missing Group from a missing Project without reading the
 * sentence.
 */
export const groupNotFound = (): NotFoundException =>
  notFound('GROUP_NOT_FOUND', 'Group not found');

export const memberNotFound = (): NotFoundException =>
  notFound('MEMBER_NOT_FOUND', 'Member not found');

export const systemNotFound = (): NotFoundException =>
  notFound('SYSTEM_NOT_FOUND', 'System not found');

export const deliveryProjectNotFound = (): NotFoundException =>
  notFound('DELIVERY_PROJECT_NOT_FOUND', 'Delivery project not found');

export const repositoryNotFound = (): NotFoundException =>
  notFound('REPOSITORY_NOT_FOUND', 'Repository not found');

export const assignmentNotFound = (): NotFoundException =>
  notFound('ASSIGNMENT_NOT_FOUND', 'Assignment not found');
