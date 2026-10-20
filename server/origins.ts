/** Keep cross-origin access explicit; never grant every vercel.app project access. */
export function parseAllowedOrigins(value = ''): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const entry of value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error('ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    ) {
      throw new Error(
        'ALLOWED_ORIGINS must contain exact HTTP(S) origins, without paths or wildcards.',
      );
    }
    origins.add(url.origin);
  }
  return origins;
}

export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  // Native clients may omit Origin. This is an origin check, not authentication.
  if (!origin) return true;
  return origin === `http://${host}` || origin === `https://${host}` || allowed.has(origin);
}
