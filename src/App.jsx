import { useEffect, useMemo, useState } from 'react';

import TokenCard from './components/TokenCard.jsx';
import TokenDetail from './components/TokenDetail.jsx';
import WalletButton from './components/WalletButton.jsx';
import { fetchListings } from './listings.js';
import { restoreConnection } from './tezos.js';

const PAGE = 48;

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(null);
  const [address, setAddress] = useState(null);
  const [listings, setListings] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}mints/index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setSnapshot)
      .catch((err) => setError(err.message));
  }, []);

  // Pick up a wallet the visitor already paired, without prompting them.
  useEffect(() => {
    restoreConnection().then(setAddress).catch(() => {});
  }, []);

  // Prices must be live: a snapshot price would offer purchases that fail.
  // Failing to load them leaves the gallery browsable, just without prices.
  useEffect(() => {
    if (!snapshot) return;
    fetchListings(snapshot.mints)
      .then(setListings)
      .catch(() => setListings(new Map()));
  }, [snapshot]);

  const platforms = useMemo(() => {
    if (!snapshot) return [];
    const counts = new Map();
    for (const mint of snapshot.mints) {
      counts.set(mint.platform, (counts.get(mint.platform) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [snapshot]);

  const visible = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLowerCase();
    return snapshot.mints.filter((mint) => {
      if (platform !== 'all' && mint.platform !== platform) return false;
      if (!needle) return true;
      return (
        mint.name.toLowerCase().includes(needle) ||
        mint.creators.some((c) => (c.alias || c.address).toLowerCase().includes(needle))
      );
    });
  }, [snapshot, platform, query]);

  if (error) {
    return (
      <main className="state">
        <p>Could not load the snapshot: {error}</p>
        <p className="hint">Run `npm run fetch` to generate it.</p>
      </main>
    );
  }

  if (!snapshot) return <main className="state">Loading on-chain mints…</main>;

  return (
    <>
      <header className="header">
        <div className="header-top">
          <h1>Fully On-Chain</h1>
          <WalletButton address={address} onChange={setAddress} />
        </div>
        <p className="tagline">
          Recent Tezos mints whose artwork lives entirely in contract storage — no IPFS, no CDN.
          These {snapshot.count} pieces are served from this site as the bytes the chain holds.
        </p>

        <div className="controls">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search title or artist"
            aria-label="Search title or artist"
          />
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setShown(PAGE);
            }}
            aria-label="Platform"
          >
            <option value="all">All platforms ({snapshot.count})</option>
            {platforms.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
        </div>
      </header>

      <main>
        {visible.length === 0 ? (
          <p className="state">Nothing matches that filter.</p>
        ) : (
          <div className="grid">
            {visible.slice(0, shown).map((mint) => (
              <TokenCard
                key={mint.id}
                mint={mint}
                listing={listings?.get(mint.id)}
                onOpen={setSelected}
              />
            ))}
          </div>
        )}

        {shown < visible.length && (
          <button className="more" onClick={() => setShown((n) => n + PAGE)} type="button">
            Show more ({visible.length - shown} remaining)
          </button>
        )}
      </main>

      <footer className="footer">
        Snapshot taken {new Date(snapshot.generatedAt).toLocaleString()} · indexed via{' '}
        <a href="https://data.objkt.com" target="_blank" rel="noreferrer">
          objkt
        </a>{' '}
        and{' '}
        <a href="https://tzkt.io" target="_blank" rel="noreferrer">
          TzKT
        </a>
      </footer>

      {selected && (
        <TokenDetail
          mint={selected}
          listing={listings?.get(selected.id)}
          address={address}
          onConnected={setAddress}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
