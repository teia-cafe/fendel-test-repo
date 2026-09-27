/* Builds the gallery snapshot.
 *
 * Finds the most recent fully on-chain Tezos mints — tokens whose artifactUri
 * is a `data:` URI, meaning the artwork itself lives in contract storage — then
 * decodes each artifact to a real file under public/mints/ and writes an
 * index.json of metadata beside it.
 *
 * The built site therefore needs no indexer or CDN at runtime.
 *
 * Usage: node scripts/fetch-mints.mjs [--limit 300]
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { platformFor } from '../src/platforms.js';

const OBJKT_API = 'https://data.objkt.com/v3/graphql';
const TZKT_API = 'https://api.tzkt.io/v1';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/mints');
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

const EXTENSIONS = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'text/html': 'html',
  'text/plain': 'txt',
  'application/json': 'json',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

// Generative artifacts paint themselves at runtime, so a still of them has to
// be taken by a real browser. 800px keeps detail without bloating the snapshot.
const THUMB_SIZE = 800;
const THUMB_SETTLE_MS = 700;
const RENDER_CONCURRENCY = 4;

function parseArgs() {
  const i = process.argv.indexOf('--limit');
  const limit = i === -1 ? 300 : Number(process.argv[i + 1]);
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`invalid --limit: ${process.argv[i + 1]}`);
  return { limit };
}

async function objkt(query) {
  const res = await fetch(OBJKT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`objkt ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors) throw new Error(`objkt: ${JSON.stringify(body.errors)}`);
  return body.data;
}

/** Most recent tokens whose artifact is stored on-chain as a data URI. */
async function fetchTokens(limit) {
  const { token } = await objkt(`{
    token(
      where: { artifact_uri: { _like: "data:%" } }
      order_by: { timestamp: desc }
      limit: ${limit}
    ) {
      fa_contract
      token_id
      name
      description
      mime
      timestamp
      supply
      artifact_uri
      fa { name }
      creators { creator_address holder { alias } }
    }
  }`);
  return token;
}

/** Contract code hashes, which identify the minting platform. */
async function fetchTypeHashes(addresses) {
  const hashes = {};
  for (let i = 0; i < addresses.length; i += 50) {
    const batch = addresses.slice(i, i + 50);
    const res = await fetch(
      `${TZKT_API}/contracts?address.in=${batch.join(',')}&select=address,typeHash&limit=${batch.length}`,
    );
    if (!res.ok) throw new Error(`tzkt ${res.status} ${res.statusText}`);
    for (const { address, typeHash } of await res.json()) hashes[address] = typeHash;
  }
  return hashes;
}

/** Decode `data:<mime>[;base64],<payload>` into bytes. */
function decodeDataUri(uri) {
  const comma = uri.indexOf(',');
  if (!uri.startsWith('data:') || comma === -1) throw new Error('not a data URI');

  const header = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  const mime = header.split(';')[0] || 'application/octet-stream';

  if (/;base64$/i.test(header)) return { mime, bytes: Buffer.from(payload, 'base64') };

  // Otherwise percent-encoded text, though some contracts store it raw.
  let text;
  try {
    text = decodeURIComponent(payload);
  } catch {
    text = payload;
  }
  return { mime, bytes: Buffer.from(text, 'utf8') };
}

/* Screenshot the artifacts that draw themselves with script.
 *
 * This is the one place untrusted artifact code runs, and it runs here rather
 * than in a visitor's browser: headless, with every non-local request blocked,
 * so a piece cannot call home or pull anything in. The published site then only
 * ever serves images.
 */
async function renderThumbnails(mints) {
  const scripted = mints.filter((m) => m.scripted);
  if (scripted.length === 0) return;

  console.log(`\nRendering ${scripted.length} generative artifacts...`);
  const browser = await chromium.launch();

  const renderOne = async (context, mint) => {
    const page = await context.newPage();
    try {
      // Artifacts are self-contained; anything reaching outward is not wanted.
      await page.route('**', (route) =>
        route.request().url().startsWith('file://') ? route.continue() : route.abort(),
      );
      await page.goto(`file://${resolve(OUT_DIR, mint.file)}`, {
        waitUntil: 'load',
        timeout: 20000,
      });
      await page.waitForTimeout(THUMB_SETTLE_MS);

      const thumb = `${mint.id}.thumb.jpg`;
      // JPEG: these stills are photographic-looking generative output, and PNG
      // made the grid several times heavier for no visible gain.
      await page.screenshot({ path: resolve(OUT_DIR, thumb), type: 'jpeg', quality: 80 });
      mint.thumb = thumb;
    } catch (err) {
      console.log(`  ! ${mint.id}: ${err.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  };

  const queue = [...scripted];
  await Promise.all(
    Array.from({ length: RENDER_CONCURRENCY }, async () => {
      const context = await browser.newContext({
        viewport: { width: THUMB_SIZE, height: THUMB_SIZE },
        javaScriptEnabled: true,
      });
      while (queue.length) await renderOne(context, queue.shift());
      await context.close();
    }),
  );

  await browser.close();
  const done = scripted.filter((m) => m.thumb).length;
  console.log(`  ${done}/${scripted.length} rendered`);
}

async function main() {
  const { limit } = parseArgs();

  console.log(`Fetching up to ${limit} recent on-chain mints...`);
  const tokens = await fetchTokens(limit);
  console.log(`  ${tokens.length} tokens returned`);

  const contracts = [...new Set(tokens.map((t) => t.fa_contract))];
  console.log(`Resolving platforms for ${contracts.length} contracts...`);
  const typeHashes = await fetchTypeHashes(contracts);

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const mints = [];
  const skipped = [];

  for (const token of tokens) {
    let decoded;
    try {
      decoded = decodeDataUri(token.artifact_uri);
    } catch (err) {
      skipped.push(`${token.fa_contract}/${token.token_id}: ${err.message}`);
      continue;
    }

    if (decoded.bytes.length > MAX_ARTIFACT_BYTES) {
      skipped.push(`${token.fa_contract}/${token.token_id}: ${decoded.bytes.length} bytes too large`);
      continue;
    }

    const mime = token.mime || decoded.mime;
    const file = `${token.fa_contract}_${token.token_id}.${EXTENSIONS[mime] ?? 'bin'}`;
    await writeFile(resolve(OUT_DIR, file), decoded.bytes);

    // Text-based artifacts may paint themselves at runtime instead of holding
    // their image in the markup; those need a rendered still to show statically.
    const isText = mime === 'image/svg+xml' || mime === 'text/html';
    const scripted = isText && /<script[\s>]/i.test(decoded.bytes.toString('utf8'));

    const platform = platformFor(typeHashes[token.fa_contract], token.fa?.name);

    mints.push({
      id: `${token.fa_contract}_${token.token_id}`,
      contract: token.fa_contract,
      tokenId: token.token_id,
      name: token.name || `#${token.token_id}`,
      description: token.description || null,
      collection: token.fa?.name?.trim() || null,
      mime,
      scripted,
      thumb: null,
      mintedAt: token.timestamp,
      supply: token.supply,
      bytes: decoded.bytes.length,
      file,
      platform: platform.name,
      platformUrl: platform.url,
      contractVersion: platform.version,
      creators: token.creators.map((c) => ({
        address: c.creator_address,
        alias: c.holder?.alias || null,
      })),
    });
  }

  await renderThumbnails(mints);

  const index = {
    generatedAt: new Date().toISOString(),
    count: mints.length,
    mints,
  };
  await writeFile(resolve(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

  const totalKb = Math.round(mints.reduce((sum, m) => sum + m.bytes, 0) / 1024);
  const byPlatform = {};
  for (const m of mints) byPlatform[m.platform] = (byPlatform[m.platform] || 0) + 1;

  console.log(`\nWrote ${mints.length} artifacts (${totalKb} KB) to public/mints/`);
  for (const [name, n] of Object.entries(byPlatform).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${name}`);
  }
  if (skipped.length) console.log(`\nSkipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);
}

await main();
