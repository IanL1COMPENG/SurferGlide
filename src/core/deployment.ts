/** This is a public server address, never a credential or API key. */
export function multiplayerEndpoint(pageAddress: string, configured = ''): URL {
  const page = new URL(pageAddress);
  let endpoint: URL;
  try {
    endpoint = configured.trim() ? new URL(configured.trim()) : new URL('/ws', page);
  } catch {
    throw new Error('VITE_MULTIPLAYER_URL must be a valid public WebSocket URL.');
  }
  if (endpoint.protocol === 'https:') endpoint.protocol = 'wss:';
  if (endpoint.protocol === 'http:') endpoint.protocol = 'ws:';
  if (
    !['ws:', 'wss:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error(
      'VITE_MULTIPLAYER_URL must be a public WebSocket URL without credentials or query parameters.',
    );
  }
  if (page.protocol === 'https:' && endpoint.protocol !== 'wss:') {
    throw new Error('HTTPS deployments require a secure wss:// multiplayer server.');
  }
  if (endpoint.pathname === '/') endpoint.pathname = '/ws';
  return endpoint;
}

/** A sleeping free host may return HTML or 503 before the Node app is ready. */
export async function warmMultiplayer(endpoint: URL, timeoutMs = 90_000, retryMs = 1500) {
  const health = new URL('/healthz', endpoint);
  health.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(health, {
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))),
      });
      if (
        response.ok &&
        response.headers.get('content-type')?.includes('application/json') &&
        (await response.json()).game === 'Surfer Glide'
      )
        return;
    } catch {
      // During spin-up the hosting proxy can fail before CORS headers exist.
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(retryMs, remaining)));
  }
  throw new Error(
    'Could not reach multiplayer. Check the server address and its ALLOWED_ORIGINS setting, then try again.',
  );
}
