export function notePathToSegments(vaultPath: string): string[] {
  return vaultPath.split('/').filter(Boolean);
}

export function segmentsToNotePath(segments: string | string[] | undefined): string | null {
  if (!segments) return null;
  const parts = Array.isArray(segments) ? segments : [segments];
  const joined = parts.filter(Boolean).join('/');
  return joined || null;
}
