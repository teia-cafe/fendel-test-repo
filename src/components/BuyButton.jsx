import { useState } from 'react';

import { formatTez } from '../format.js';
import { buyListing, connect } from '../tezos.js';

/* Purchases go to objkt.com's marketplace contract, which holds the listing and
 * pays the seller and the artist's royalties. Nothing here custodies funds. */
export default function BuyButton({ listing, address, onConnected }) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);

  if (!listing) return <p className="buy-none">Not currently listed for sale.</p>;

  const price = formatTez(listing.priceMutez);

  const handleConnect = async () => {
    setState('connecting');
    try {
      onConnected(await connect());
      setState('idle');
    } catch {
      setState('idle');
    }
  };

  const handleBuy = async () => {
    setState('buying');
    setResult(null);
    try {
      setResult(await buyListing(listing.askId, listing.priceMutez));
      setState('done');
    } catch (err) {
      setResult(err.message ?? 'Transaction failed');
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="buy">
        <p className="buy-done">Bought for {price}</p>
        <a href={`https://tzkt.io/${result}`} target="_blank" rel="noreferrer">
          View transaction
        </a>
      </div>
    );
  }

  return (
    <div className="buy">
      {address ? (
        <button className="buy-action" type="button" onClick={handleBuy} disabled={state === 'buying'}>
          {state === 'buying' ? 'Confirm in your wallet…' : `Buy for ${price}`}
        </button>
      ) : (
        <button
          className="buy-action"
          type="button"
          onClick={handleConnect}
          disabled={state === 'connecting'}
        >
          Connect wallet to buy · {price}
        </button>
      )}

      <p className="buy-note">
        Sold by its holder through objkt.com&apos;s marketplace contract. This site takes no fee
        and never holds your funds.
      </p>

      {state === 'error' && <p className="buy-error">{result}</p>}
    </div>
  );
}
