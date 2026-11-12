/* One sheet of a file the import preview read; declared in @alphaci/api-contracts. */
export type { ImportSheet } from '@/shared/api/contracts';
export type ImportMode = 'requirements' | 'test-cases';
export interface ImportMapping {
  group: number;
  title: number;
  details: number;
}
export interface ImportRow {
  row: number;
  group: string;
  title: string;
  details: string;
}
export interface ImportStory {
  requirementId: string;
  itemId: string;
  label: string;
}
