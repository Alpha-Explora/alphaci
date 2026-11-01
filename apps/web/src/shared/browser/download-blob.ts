/* Save an in-memory Blob as a file, the way a download link would.
 *
 * Domain-free: the caller names the file and builds the Blob. A temporary
 * anchor with `download` is the only cross-browser way to name the saved file;
 * it is attached for the click (Firefox ignores clicks on detached anchors) and
 * removed straight after. The object URL is revoked on the next task, not
 * synchronously — Safari can cancel a download whose URL is revoked in the same
 * tick as the click. */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
