// @ts-check
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(root, 'patches/focus-scope-fix1');
const ledger = JSON.parse(
  fs.readFileSync(path.join(artifactRoot, 'radix-focus-scope-artifact.json'), 'utf8'),
);
const tarball = path.join(artifactRoot, ledger.filename);
const bytes = fs.readFileSync(tarball);
const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
if (integrity !== ledger.integrity || bytes.length !== ledger.bytes) {
  throw new Error('Frozen artifact integrity mismatch');
}
/** @param {string} file */
const packed = (file) => execFileSync('tar', ['-xOzf', tarball, 'package/' + file]);
const manifest = JSON.parse(packed('package.json').toString('utf8'));
const provenance = JSON.parse(packed('PROVENANCE.json').toString('utf8'));
if (
  manifest.name !== ledger.patchedPackage.name ||
  manifest.version !== ledger.patchedPackage.version ||
  provenance.sourceCommit !== ledger.sourceCommit
) {
  throw new Error('Frozen artifact identity/provenance mismatch');
}
if (!packed('LICENSE').equals(fs.readFileSync(path.join(root, 'LICENSE')))) {
  throw new Error('Frozen artifact license mismatch');
}
for (const file of [
  'src/index.ts',
  'src/focus-scope.tsx',
  'src/focus-scope.test.tsx',
  'tsconfig.json',
]) {
  const archived = packed(file);
  const committed = execFileSync(
    'git',
    ['show', ledger.sourceCommit + ':packages/react/focus-scope/' + file],
    { cwd: root },
  );
  if (
    !archived.equals(committed) ||
    createHash('sha256').update(archived).digest('hex') !== provenance.sourceSha256[file]
  ) {
    throw new Error('Frozen artifact source mismatch: ' + file);
  }
}
// CI builds with the original Radix builder immediately before this comparison.
// A stale or substituted dist is rejected even when source provenance is valid.
for (const file of ['index.js', 'index.mjs', 'index.d.ts', 'index.d.mts']) {
  if (
    !packed('dist/' + file).equals(
      fs.readFileSync(path.join(root, 'packages/react/focus-scope/dist', file)),
    )
  ) {
    throw new Error('Frozen artifact differs from original builder output: ' + file);
  }
}
console.log(
  JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    sourceCommit: ledger.sourceCommit,
    integrity,
    bytes: bytes.length,
    verified: true,
  }),
);
