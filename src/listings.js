/* Live sale prices.
 *
 * Prices are the one thing that cannot be baked into the build snapshot: a
 * listing can be sold or retracted at any moment, and showing a stale price
 * means offering a purchase that will fail. So this is fetched fresh on load —
 * the artwork itself still comes from the static snapshot.
 */

const OBJKT_API = 'https://data.objkt.com/v3/graphql';

// Listings priced in something other than tez exist; paying for those needs a
// token allowance flow, so only straight tez listings are offered here.
const TEZ_CURRENCY_ID = 1;

const QUERY = `query GalleryListings($filters: [listing_bool_exp!], $limit: Int!) {
  listing(
    where: {
      _or: $filters
      status: { _eq: "active" }
      currency_id: { _eq: ${TEZ_CURRENCY_ID} }
    }
    order_by: { price: asc }
    limit: $limit
  ) {
    fa_contract
    price
    amount_left
    bigmap_key
    seller_address
    token { token_id }
  }
}`;

/**
 * Cheapest active tez listing for each of the given tokens.
 *
 * Asks only about the tokens on display. Querying whole contracts instead
 * returns far more rows than any page limit allows, and the overflow is
 * silently dropped — which looked exactly like "nothing is for sale".
 *
 * @param mints snapshot entries, each with `contract` and `tokenId`
 * @returns Map of "<contract>_<tokenId>" to { askId, priceMutez, seller }
 */
export async function fetchListings(mints) {
  const byContract = new Map();
  for (const { contract, tokenId } of mints) {
    if (!byContract.has(contract)) byContract.set(contract, []);
    byContract.get(contract).push(String(tokenId));
  }

  const filters = [...byContract].map(([contract, tokenIds]) => ({
    fa_contract: { _eq: contract },
    token: { token_id: { _in: tokenIds } },
  }));

  const res = await fetch(OBJKT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      // A token may carry several listings, so allow well over one row each.
      variables: { filters, limit: mints.length * 4 },
    }),
  });
  if (!res.ok) throw new Error(`objkt ${res.status}`);

  const body = await res.json();
  if (body.errors) throw new Error(body.errors[0]?.message ?? 'objkt query failed');

  const cheapest = new Map();
  for (const row of body.data.listing) {
    if (row.amount_left < 1) continue;

    // Rows arrive price-ascending, so the first one seen for a token is its best.
    const id = `${row.fa_contract}_${row.token.token_id}`;
    if (cheapest.has(id)) continue;

    cheapest.set(id, {
      askId: row.bigmap_key,
      priceMutez: row.price,
      seller: row.seller_address,
    });
  }
  return cheapest;
}
