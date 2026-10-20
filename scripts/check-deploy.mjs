import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { multiplayerBuildEndpoint } from '../src/core/deployment.ts';

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
  // Use the same resolver and Vite environment loading as the actual build.
  multiplayerBuildEndpoint(
    loadEnv('production', process.cwd(), 'VITE_MULTIPLAYER_URL').VITE_MULTIPLAYER_URL,
    true,
  );
}
console.log(
  `Deployment check passed: ${count} public game files; no source maps, private files, or recognized credential patterns.`,
);
