/** One sheet of an uploaded file: its header row and the rows under it, as text. */
export interface ImportSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

/** `POST /delivery-projects/:id/qa-import-preview`: read in memory, nothing stored. */
export interface QaImportPreviewResponse {
  sheets: ImportSheet[];
}
