// @ts-check
const { build } = require('esbuild');
const { mkdirSync, copyFileSync, readFileSync } = require('fs');
const path = require('path');

/** Parse a .env file that may use `export X=Y` syntax. */
function loadEnvFile(filepath) {
  try {
    const lines = readFileSync(filepath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
      const match = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (match) env[match[1]] = match[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

const localEnv = loadEnvFile(path.join(__dirname, '..', '.env.local'));

const entryPoints = [
  'extension/src/background.ts',
  'extension/src/popup.ts',
  'extension/src/options.ts',
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  await build({
    entryPoints,
    bundle: true,
    platform: 'browser',
    target: 'chrome88',
    outdir: 'extension/dist',
    format: 'iife',
    logLevel: 'info',
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  });

  // Always copy manifest so dist/ stays in sync with the source manifest.
  copyFileSync('extension/manifest.json', 'extension/dist/manifest.json');

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
