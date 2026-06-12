/** Normalize an on-disk path to a WebView/Image file URI. */
export function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

/** Build a data URI from a native file payload. */
export function toDataUri(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}
