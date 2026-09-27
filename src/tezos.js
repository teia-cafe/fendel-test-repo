/* Tezos wallet connection and purchases.
 *
 * Buying goes through objkt.com's existing marketplace contract rather than one
 * of our own: the pieces in this gallery belong to other people and are already
 * listed there, so this UI fulfils those listings. Sellers and artists are paid
 * by that contract exactly as they would be on objkt itself.
 *
 * Taquito and Beacon together outweigh the rest of the site several times over,
 * and most visitors only ever look. So the SDK is imported on demand — when
 * someone connects, or when a previous session needs restoring.
 */

// tzkt's node, which tracked the chain head closest to live when checked.
const RPC = 'https://rpc.tzkt.io/mainnet';

// objkt.com marketplace v4. Verified on-chain: `fulfill_ask` takes
// { ask_id, amount, proxy_for, condition_extra, referrers } and asks live in
// its `asks` bigmap, keyed by the same id the objkt API calls `bigmap_key`.
export const MARKETPLACE = 'KT1SwbTqhSKF6Pdokiu1K4Fpi17ahPPzmt1X';

const NETWORK = { type: 'mainnet' };

// Where the Beacon SDK records the account it is currently paired with.
const BEACON_ACTIVE_ACCOUNT = 'beacon:active-account';

let loading = null;

/** Load the wallet SDK once, and wire the toolkit to Beacon. */
function loadSdk() {
  loading ??= (async () => {
    // Beacon reaches for Node's Buffer, which browsers do not provide. Supplying
    // it here rather than in the entry point keeps it out of the main bundle.
    const { Buffer } = await import('buffer');
    globalThis.Buffer ??= Buffer;

    const [{ BeaconWallet }, taquito] = await Promise.all([
      import('@taquito/beacon-wallet'),
      import('@taquito/taquito'),
    ]);

    const tezos = new taquito.TezosToolkit(RPC);
    const wallet = new BeaconWallet({ name: 'Fully On-Chain', network: NETWORK });
    tezos.setWalletProvider(wallet);

    return { tezos, wallet, MichelsonMap: taquito.MichelsonMap };
  })();

  return loading;
}

/**
 * Address of an already-paired wallet, without prompting.
 *
 * Checks Beacon's own storage key first so that a visitor who has never
 * connected does not download the SDK just to be told they have no wallet.
 */
export async function restoreConnection() {
  if (!localStorage.getItem(BEACON_ACTIVE_ACCOUNT)) return null;

  const { wallet } = await loadSdk();
  const account = await wallet.client.getActiveAccount();
  return account?.address ?? null;
}

export async function connect() {
  const { wallet } = await loadSdk();
  // The network belongs to the BeaconWallet constructor; passing it here too is
  // rejected outright by current Beacon versions.
  await wallet.requestPermissions();
  return wallet.getPKH();
}

export async function disconnect() {
  const { wallet } = await loadSdk();
  await wallet.disconnect();
}

/**
 * Fulfil an objkt listing.
 *
 * @param askId      listing id (the API's `bigmap_key`)
 * @param priceMutez price of one edition, in mutez
 * @returns the operation hash, once the transaction is included in a block
 */
export async function buyListing(askId, priceMutez) {
  const { tezos, MichelsonMap } = await loadSdk();
  const contract = await tezos.wallet.at(MARKETPLACE);

  const op = await contract.methodsObject
    .fulfill_ask({
      ask_id: Number(askId),
      amount: 1,
      proxy_for: null,
      condition_extra: null,
      // No referral cut is claimed; the contract expects the map regardless.
      referrers: new MichelsonMap(),
    })
    .send({ amount: Number(priceMutez), mutez: true });

  await op.confirmation(1);
  return op.opHash;
}
