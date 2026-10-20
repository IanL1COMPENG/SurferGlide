import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const publicFiles = [
  /^index\.html$/,
  /^favicon\.svg$/,
  /^assets\/[\w-]+\.(js|css)$/,
  /^models\/(board|rider)-[\w-]+\.glb$/,
  /^previews\/(board|rider)-[\w-]+\.png$/,
];
const credentials =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16}/;
let count = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    assert.ok(!entry.isSymbolicLink(), `Deployment cannot contain symlinks: ${relative}`);
    if (entry.isDirectory()) {
      assert.ok(
        ['assets', 'models', 'previews'].includes(relative),
        `Unexpected deployment directory: ${relative}`,
      );
      await inspect(absolute);
      continue;
    }
    assert.ok(
      publicFiles.some(pattern => pattern.test(relative)),
      `Unexpected public file: ${relative}`,
    );
    if (/\.(html|js|css|svg)$/.test(entry.name)) {
      assert.ok(
        !credentials.test(await readFile(absolute, 'utf8')),
        `Possible credential in public file: ${relative}`,
      );
    }
    count++;
  }
}
await inspect(root);
assert.ok(count >= 25, 'Missing production bundles or game assets. Run npm run build first.');

if (process.env.VERCEL === '1') {
  assert.ok(
    process.env.VITE_MULTIPLAYER_URL,
    'Set the public VITE_MULTIPLAYER_URL in Vercel to preserve multiplayer.',
  );
  let endpoint;
  try {
    endpoint = new URL(process.env.VITE_MULTIPLAYER_URL);
  } catch {
    throw new Error('VITE_MULTIPLAYER_URL must be a valid public wss:// address.');
  }
  assert.equal(endpoint.protocol, 'wss:', 'Public multiplayer must use a secure wss:// URL.');
  assert.ok(
    !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash,
    'Multiplayer URLs must never contain credentials.',
  );
}
console.log(
  `Deployment check passed: ${count} public game files; no source maps, private files, or recognized credential patterns.`,
);
