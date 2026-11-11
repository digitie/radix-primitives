// @ts-check
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages/react/focus-scope');
const output = path.resolve(
  process.argv[2] ?? path.join(os.tmpdir(), 'radix-focus-scope-artifacts'),
);
fs.mkdirSync(output, { recursive: true });

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
execFileSync(
  'git',
  ['diff', '--exit-code', 'HEAD', '--', 'packages/react/focus-scope', 'internal/builder'],
  { cwd: root, stdio: 'inherit' },
);
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (
  manifest.name !== '@radix-ui/react-focus-scope' ||
  manifest.version !== '1.3.1+kortravel.fix.1'
) {
  throw new Error('Unexpected patched package identity');
}
const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'radix-focus-scope-pack-'));
const stage = path.join(stagingRoot, 'package');
fs.mkdirSync(stage);
for (const item of ['dist', 'src', 'README.md', 'tsconfig.json']) {
  fs.cpSync(path.join(packageRoot, item), path.join(stage, item), {
    recursive: true,
    dereference: true,
  });
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
/** @type {Record<string, string>} */
const dependencies = {};
for (const name of Object.keys(manifest.dependencies)) {
  const dependencyRoot = path.join(root, 'packages/react', name.replace('@radix-ui/react-', ''));
  dependencies[name] = JSON.parse(
    fs.readFileSync(path.join(dependencyRoot, 'package.json'), 'utf8'),
  ).version;
}
const published = {
  ...manifest,
  ...manifest.publishConfig,
  dependencies,
  packageManager: 'pnpm@11.5.0',
  files: [...manifest.files, 'BUILDING.md'],
};
delete published.publishConfig;
delete published.source;
delete published.devDependencies;
delete published.scripts;
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(published, null, 2) + '\n');

/** @type {Record<string, string>} */
const sourceSha256 = {};
for (const file of [
  'src/index.ts',
  'src/focus-scope.tsx',
  'src/focus-scope.test.tsx',
  'tsconfig.json',
]) {
  sourceSha256[file] = createHash('sha256')
    .update(fs.readFileSync(path.join(stage, file)))
    .digest('hex');
}
const provenance = {
  sourceRepository: 'https://github.com/digitie/radix-primitives',
  upstreamRepository: 'https://github.com/radix-ui/primitives',
  upstreamCommit: 'eb3a2b7091293e27df8f9ba906632d8daa3d81a3',
  upstreamPackage: { name: '@radix-ui/react-focus-scope', version: '1.3.1' },
  patchedPackage: { name: manifest.name, version: manifest.version },
  sourceCommit,
  license: 'MIT',
  packageManager: 'pnpm@11.5.0',
  sourceSha256,
};
fs.writeFileSync(path.join(stage, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
fs.writeFileSync(
  path.join(stage, 'BUILDING.md'),
  [
    '# Reproducing the patched FocusScope package',
    '',
    'This is an unreleased downstream source fix, not an official Radix release.',
    'The public fork/PR records the source commit below; the upstream and full source hashes are in PROVENANCE.json.',
    '',
    'Source commit: ' + sourceCommit,
    'Upstream: https://github.com/radix-ui/primitives/tree/' + provenance.upstreamCommit,
    '',
    'Use Node 24 and pnpm 11.5.0 in the full source checkout:',
    '',
    '    pnpm install --frozen-lockfile',
    '    pnpm --filter @radix-ui/react-focus-scope... build',
    '    pnpm exec vitest run packages/react/focus-scope',
    '    pnpm exec playwright test e2e/focus-scope.spec.ts',
    '    node scripts/pack-focus-scope-fix.mjs /tmp/radix-focus-scope-artifacts',
    '',
    'Normal consumers keep their common/Radix imports. Only the central dependency policy selects this exact engine tarball.',
    '',
  ].join('\n'),
);
const filename = 'radix-ui-react-focus-scope-' + manifest.version + '.tgz';
const tarball = path.join(output, filename);
if (fs.existsSync(tarball)) {
  throw new Error('Refusing to overwrite an existing candidate tarball');
}
// pnpm's manifest normalizer strips semver build metadata, so archive the verified
// publish manifest directly. Dependencies are still installed and built using pnpm.
for (const file of ['dist/index.js', 'dist/index.mjs', 'dist/index.d.ts', 'dist/index.d.mts']) {
  if (!fs.existsSync(path.join(stage, file))) {
    throw new Error('Missing public export target: ' + file);
  }
}
const tar = execFileSync(
  'tar',
  [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-cf',
    '-',
    '-C',
    stagingRoot,
    'package',
  ],
  { maxBuffer: 4 * 1024 * 1024 },
);
fs.writeFileSync(tarball, gzipSync(tar));
const packedManifest = JSON.parse(
  execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }),
);
if (packedManifest.name !== manifest.name || packedManifest.version !== manifest.version) {
  throw new Error('Packed package identity differs from source');
}
const bytes = fs.readFileSync(tarball);
const result = {
  ...provenance,
  filename,
  bytes: bytes.length,
  integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
fs.writeFileSync(
  path.join(output, 'radix-focus-scope-artifact.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
