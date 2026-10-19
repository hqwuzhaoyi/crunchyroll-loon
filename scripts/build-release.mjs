import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await import('./build-translate.mjs');
const destination = path.join(root, 'dist');
const files = ['Crunchyroll.Chinese.plugin', 'Crunchyroll.OfficialCN.plugin', 'Crunchyroll.OfficialCN.js', 'Crunchyroll.Translate.js', 'README.md', 'LICENSE'];
await mkdir(destination, { recursive: true });
const checksums = [];
for (const filename of files) {
  const bytes = await readFile(path.join(root, filename));
  await writeFile(path.join(destination, filename), bytes);
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${filename}`);
}
await writeFile(path.join(destination, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
console.log(`Built ${files.length} release files and SHA256SUMS in dist/`);
