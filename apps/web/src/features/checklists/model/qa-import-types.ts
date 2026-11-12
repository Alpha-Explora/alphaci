export interface ImportSheet {
  name: string;
  headers: string[];
  rows: string[][];
}
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
