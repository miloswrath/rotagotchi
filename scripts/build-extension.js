// @ts-check
const { build } = require('esbuild');
const { mkdirSync, copyFileSync, readFileSync, writeFileSync } = require('fs');
const zlib = require('zlib');
const path = require('path');

/**
 * Generate a minimal valid PNG (RGB, no alpha) filled with a solid colour.
 * Uses only Node built-ins (zlib for deflate, no canvas dependency).
 */
function createSolidPng(width, height, r, g, b) {
  const crcTable = (() => {
    const t = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const crc = u32(crc32(Buffer.concat([t, data])));
    return Buffer.concat([u32(data.length), t, data, crc]);
  };

  // Raw pixel data: one filter byte (0 = none) per row, then RGB triples.
  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  for (let x = 0; x < width; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array(height).fill(row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])])),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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
  for (const name of ['idle', 'angry', 'excited', 'starving', 'death']) {
    copyFileSync(`rot/${name}.json`, `extension/dist/animations/${name}.json`);
  }

  // Notification icons — Chrome requires a real PNG, not a JSON/SVG.
  writeFileSync('extension/dist/icon-hunger.png', createSolidPng(48, 48, 239, 68, 68));   // #ef4444 red
  writeFileSync('extension/dist/icon-satiated.png', createSolidPng(48, 48, 34, 197, 94)); // #22c55e green

  console.log('✓ Extension built successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
