/* Platform identification for fully on-chain Tezos mints.
 *
 * A contract's `typeHash` (from TzKT) identifies its code, so every contract
 * deployed from the same template shares one hash. That makes typeHash the
 * reliable way to label a platform — contract addresses differ per collection.
 */

// ZeroContract code hashes -> version, taken from ZeroUnbound's own hashMatrix.json
// https://github.com/jams2blues/zerounbound/blob/master/src/data/hashMatrix.json
export const ZERO_CONTRACT_VERSIONS = {
  '-543526052': 'v1',
  '-1889653220': 'v2a',
  '943737041': 'v2b',
  '-1513923773': 'v2c',
  '-1835576114': 'v2d',
  '1529857708': 'v2e',
  '862045731': 'v3',
  '-255216182': 'v4',
  '-1665803695': 'v4a',
  '617511430': 'v4b',
  '-1275828732': 'v4c',
  '-2032598074': 'v4d',
  '2058538150': 'v4e',
};

// Platforms identified by the code hash of the contracts they deploy.
export const PLATFORMS_BY_TYPE_HASH = {
  '-805560551': { name: 'bootloader', url: 'https://bootloader.art' },
  // Confirmed by contract name "TWENFIDDY"; the twinenfiddy.xyz domain does
  // not currently resolve, so no site URL is recorded.
  '191857048': { name: 'TWENFIDDY', url: null },
};

export const ZERO_UNBOUND = { name: 'ZeroUnbound', url: 'https://zerounbound.art' };

/** Label the platform behind a contract. Falls back to the collection name. */
export function platformFor(typeHash, faName) {
  const key = String(typeHash);

  const version = ZERO_CONTRACT_VERSIONS[key];
  if (version) return { ...ZERO_UNBOUND, version };

  const known = PLATFORMS_BY_TYPE_HASH[key];
  if (known) return { ...known, version: null };

  return { name: faName?.trim() || 'Unknown', url: null, version: null };
}
