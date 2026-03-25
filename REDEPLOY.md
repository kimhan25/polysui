# Redeploying Polysui after Table Refactor

The `voters` field was changed from `vector<address>` to `Table<address, u64>`.
This is a **breaking on-chain change** — existing deployed markets use the old struct layout
and are incompatible with the new module. You must redeploy.

## Steps

### 1. Build & verify
```bash
cd move/market
sui move build
```
Make sure there are no compile errors before publishing.

### 2. Publish to testnet
```bash
sui client publish --gas-budget 100000000
```
Copy the `Published to` package ID from the output (looks like `0x...`).

### 3. Update constants.ts
Open `polysui-frontend/src/constants.ts` and replace the package ID:
```ts
export const TESTNET_POLYSUI_PACKAGE_ID = "<YOUR_NEW_PACKAGE_ID>";
```

### 4. Rebuild the frontend
```bash
cd polysui-frontend
npm run build
```

### 5. Redeploy frontend (if hosted)
Push to your hosting provider (Vercel, Netlify, etc.) or serve the `dist/` folder.

## What changed on-chain

| Field | Before | After |
|---|---|---|
| `voters` type | `vector<address>` | `Table<address, u64>` |
| `has_voted` check | O(n) vector scan | O(1) table lookup |
| `vote()` write | `vector::push_back` | `table::add` |
| `total_votes()` | `vector::length` | `table::length` |
| New function | — | `get_vote(addr)` — returns option chosen |

## Why this matters

With a vector, every vote costs more gas as the market grows (scanning all previous voters).
With a Table, the `has_voted` check is always O(1) regardless of how many people voted.
For markets with 1000+ voters this is a significant gas saving.
