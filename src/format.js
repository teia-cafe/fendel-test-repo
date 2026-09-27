/* Formatting helpers, kept apart from tezos.js so that showing a price does not
 * drag the wallet SDK into the initial bundle. */

export const formatTez = (mutez) => {
  const tez = Number(mutez) / 1_000_000;
  return `ꜩ${tez.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export const shortAddress = (address) => `${address.slice(0, 5)}…${address.slice(-4)}`;
