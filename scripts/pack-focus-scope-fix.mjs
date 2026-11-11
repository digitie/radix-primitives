// @ts-check
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frozenRoot = path.join(root, 'patches/focus-scope-fix2');
const ledgerPath = path.join(frozenRoot, 'radix-focus-scope-artifact.json');
if (!fs.existsSync(ledgerPath)) {
  throw new Error('Frozen fix.2 ledger is required; never re-create this version');
}
const frozen = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
if (
  frozen.patchedPackage?.name !== '@radix-ui/react-focus-scope' ||
  frozen.patchedPackage?.version !== '1.3.1+kortravel.fix.2'
) {
  throw new Error('Unexpected frozen package identity');
}
const source = path.join(frozenRoot, frozen.filename);
if (!fs.existsSync(source)) {
  throw new Error('Frozen fix.2 tarball is required; never re-create this version');
}
execFileSync(
  'git',
  [
    'diff',
    '--exit-code',
    'HEAD',
    '--',
    'packages/react/focus-scope',
    'internal/builder',
    'scripts/pack-focus-scope-fix.mjs',
    'scripts/verify-focus-scope-fix.mjs',
    'patches/focus-scope-fix2',
  ],
  { cwd: root, stdio: 'inherit' },
);
// Rebuild in the original workspace context, then verify the frozen payload.
execFileSync(
  'corepack',
  [
    'pnpm',
    '--filter',
    '@radix-ui/react-focus-scope',
    'exec',
    'node',
    '../../../internal/builder/radix-build.js',
  ],
  {
    cwd: root,
    env: { ...process.env, pnpm_config_verify_deps_before_run: 'false' },
    stdio: 'inherit',
  },
);
execFileSync(process.execPath, [path.join(root, 'scripts/verify-focus-scope-fix.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
const output = path.resolve(
  process.argv[2] ?? path.join(os.tmpdir(), 'radix-focus-scope-artifacts'),
);
fs.mkdirSync(output, { recursive: true });
const destination = path.join(output, frozen.filename);
if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(fs.readFileSync(source))) {
  throw new Error('Refusing to overwrite different bytes for a frozen version');
}
fs.copyFileSync(source, destination);
fs.copyFileSync(ledgerPath, path.join(output, 'radix-focus-scope-artifact.json'));
console.log(JSON.stringify({ ...frozen, copiedFrozenArtifact: true }));
