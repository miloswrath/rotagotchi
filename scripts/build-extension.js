// @ts-check
const { build } = require('esbuild');
const { mkdirSync, copyFileSync } = require('fs');

const entryPoints = [
  'extension/src/background.ts',
  'extension/src/popup.ts',
  'extension/src/options.ts',
];

async function main() {
  await build({
    entryPoints,
    bundle: true,
    platform: 'browser',
    target: 'chrome88',
    outdir: 'extension/dist',
    format: 'iife',
    logLevel: 'info',
  });

  mkdirSync('extension/dist/animations', { recursive: true });
  for (const name of ['idle', 'angry']) {
    copyFileSync(`rot/${name}.json`, `extension/dist/animations/${name}.json`);
  }
  console.log('✓ Extension built successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
