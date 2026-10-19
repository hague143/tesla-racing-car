import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');

// Keep the root bundle available for local play and standalone HTML exports.
await build({
  absWorkingDir: root,
  entryPoints: ['src/game.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'game.js',
  logLevel: 'info',
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js', 'assets', 'THIRD_PARTY_LICENSES.txt']) {
  await cp(resolve(root, file), resolve(output, file), { recursive: true });
}
console.log('Static site ready in public/');
