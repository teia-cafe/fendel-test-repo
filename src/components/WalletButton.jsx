import { useState } from 'react';

import { shortAddress } from '../format.js';
import { connect, disconnect } from '../tezos.js';

// Beacon reports a dismissed dialog as an error like any other; that one is the
// visitor changing their mind, so it should not be shown back to them.
const isDismissal = (message = '') =>
  /abort|reject|closed|cancel/i.test(message);

export default function WalletButton({ address, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      // A dismissed dialog surfaces as an error carrying nothing useful, so
      // only report failures that actually say what went wrong.
      const message = err?.message;
      if (message && !isDismissal(message)) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wallet-slot">
      {address ? (
        <button
          className="wallet wallet-connected"
          type="button"
          disabled={busy}
          title={address}
          onClick={() => run(async () => {
            await disconnect();
            return null;
          })}
        >
          {shortAddress(address)}
          <span className="wallet-hint">Disconnect</span>
        </button>
      ) : (
        <button className="wallet" type="button" disabled={busy} onClick={() => run(connect)}>
          {busy ? 'Connecting…' : 'Connect wallet'}
        </button>
      )}

      {error && <p className="wallet-error">{error}</p>}
    </div>
  );
}
