# Fully On-Chain

A gallery of recent Tezos mints whose artwork lives entirely in contract storage — no IPFS,
no CDN, no external host. The site serves the same bytes the chain holds.

## How it works

`npm run fetch` builds a snapshot:

1. Asks [objkt's GraphQL API](https://data.objkt.com/v3/graphql) for the most recent tokens whose
   `artifact_uri` is a `data:` URI. That single condition is what "fully on-chain" means in
   practice, and it finds every platform at once rather than a hand-maintained list.
2. Asks [TzKT](https://api.tzkt.io) for each contract's `typeHash` — the hash of the contract
   code, which is stable across every collection deployed from the same template and so is the
   reliable way to tell platforms apart. `src/platforms.js` maps those hashes to names.
3. Decodes each artifact into a real file under `public/mints/` and writes `index.json` beside it.

The built site has no runtime dependency on any indexer. Artifacts average about 8 KB, so the
whole gallery is a couple of megabytes of static files.

## Platforms

Labels come from the contract code hash, falling back to the collection name for platforms not
yet in the registry. Recognised so far:

| Platform | Identified by |
| --- | --- |
| [ZeroUnbound](https://zerounbound.art) | 13 ZeroContract hashes (v1–v4e), from the project's own [hashMatrix.json](https://github.com/jams2blues/zerounbound/blob/master/src/data/hashMatrix.json) |
| [bootloader](https://bootloader.art) | `-805560551` |
| TWENFIDDY | `191857048` |

To add one, find its `typeHash` and add it to `PLATFORMS_BY_TYPE_HASH`:

```bash
curl "https://api.tzkt.io/v1/contracts?address.in=KT1...&select=address,typeHash"
```

## Why nothing is rendered in an iframe

Artifacts are arbitrary code written by strangers, and about a third of them are generative —
they paint themselves with `<script>` at runtime rather than storing a finished image.

Rendering those live would mean framing them, and Chrome only executes script inside an SVG
document when the frame carries `allow-same-origin`. Because artifacts are served from this
site's own origin, granting that would let any minted artwork script this page — read and write
its storage, rewrite its DOM, and put whatever it liked in front of a visitor. On a site aimed at
a Tezos audience, a convincing fake wallet prompt is the obvious abuse.

So the browser never runs artifact code. Generative pieces are screenshotted at build time by
headless Chromium with all non-local requests blocked, and the site serves the resulting still.
Everything else is a static file in an `<img>`.

The honest cost: animated and interactive pieces appear as a single frame. Each detail view links
to objkt and to the raw on-chain file for the live version.

If you later want live rendering, the fix is to serve `public/mints/` from a **separate origin**
and frame it with `sandbox="allow-scripts allow-same-origin"`. The artwork then gets its own
origin to play in and still cannot reach this one. That needs a second domain, which GitHub Pages
alone cannot provide.

## Wallet and buying

Connect a Tezos wallet (Kukai, Temple, Umami, or anything Beacon supports) and buy pieces that
their holders have listed. There is **no marketplace contract of our own**: the art here belongs
to other people and is already listed on objkt.com, so a purchase fulfils that listing through
objkt's marketplace contract [`KT1SwbTqhSKF6Pdokiu1K4Fpi17ahPPzmt1X`](https://tzkt.io/KT1SwbTqhSKF6Pdokiu1K4Fpi17ahPPzmt1X).
Sellers and artists are paid exactly as they would be on objkt; this site takes no fee and never
holds funds.

The `fulfill_ask` parameters were verified against the live contract schema before shipping, and
the listing id the objkt API calls `bigmap_key` is the contract's own `ask_id`.

Prices are the one thing not baked into the snapshot — a listing can sell or be retracted at any
moment, and a stale price offers a purchase that will fail. They are fetched live on load. Only
tez-denominated listings are offered; other currencies would need a token allowance flow.

Note that roughly a quarter of the gallery is purchasable at any time (85 of 300 when last
checked, median ꜩ6), and very little of it is among the newest mints — freshly minted pieces are
usually listed later, if at all. A piece with no listing says so.

The wallet SDK is loaded on demand rather than up front: Taquito and Beacon together outweigh the
rest of the site many times over, and most visitors only ever look. The initial bundle is about
73 KB gzipped; the wallet chunks arrive only when someone connects.

## Running it

```bash
npm install
npx playwright install chromium
npm run fetch
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run fetch` | Rebuild the snapshot. `-- --limit 500` for more mints (default 300) |
| `npm run dev` | Dev server |
| `npm run build` | Static build into `dist/` |
| `npm run lint` | oxlint |

`public/mints/` is generated and git-ignored; the workflow rebuilds it on every deploy.

## Deployment

`.github/workflows/deploy.yml` refreshes the snapshot and publishes to GitHub Pages on push, every
six hours, and on demand. Enable it under **Settings → Pages → Source → GitHub Actions**.

The site is built for `https://<org>.github.io/fendel-test-repo/`. Hosting at a domain root instead
needs `BASE_PATH=/`.

## Known gaps

- **TWENFIDDY** is identified from its contract name; `twinenfiddy.xyz` does not resolve, so no site
  URL is recorded. Correct it in `src/platforms.js` if the real domain differs.
- Artifacts over 2 MB are skipped, and the snapshot only covers what objkt has indexed.
