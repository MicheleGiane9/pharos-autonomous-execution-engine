# Route Optimization

## Purpose

Find the best execution path for swaps on Pharos. Query available DEXs, compare output amounts, and return the optimal route to the calling agent.

## Agent Guidelines

> Query all known DEXs in assets/dexs.json. Use cast call (read-only) to simulate swap outputs without spending gas. Always return a ranked comparison. Update assets/dexs.json when new DEXs are discovered on Pharos.

---

## Faroswap Contracts (Mainnet — Chain 1672)

| Contract | Address | Protocol |
|----------|---------|---------|
| DODOFeeRouteProxy | `0xa5ca5fbe34e444f366b373170541ec6902b0f75c` | DODO V2 |

> Faroswap uses **DODO protocol** (not Uniswap V2). Functions are different.

---

## Step 1 — Query Price from DODO Pool

DODO pools expose `querySellBase` and `querySellQuote` for price simulation:

```bash
# Query how much quoteToken you get for selling baseToken
cast call <dodo_pool_address> \
  "querySellBase(address,uint256)(uint256,uint256)" \
  <trader_address> <amount_in_wei> \
  --rpc-url https://rpc.pharos.xyz

# Query how much baseToken you get for selling quoteToken
cast call <dodo_pool_address> \
  "querySellQuote(address,uint256)(uint256,uint256)" \
  <trader_address> <amount_in_wei> \
  --rpc-url https://rpc.pharos.xyz
```

```bash
# Uniswap V3 style — quote exact input
cast call <quoter_address> \
  "quoteExactInputSingle(address,address,uint24,uint256,uint160)(uint256)" \
  <token_in> <token_out> <fee_tier> <amount_in> 0 \
  --rpc-url <rpc_url>
```

---

## Step 2 — Query Multi-Hop Routes

For token pairs with no direct pool, try routing through PROS or USDC:

```bash
# A → PROS → B
cast call <dex_router> \
  "getAmountsOut(uint256,address[])(uint256[])" \
  <amount_in> "[<token_a>,<PROS_address>,<token_b>]" \
  --rpc-url <rpc_url>
```

---

## Step 3 — Compare and Rank

Collect all quotes and rank by output amount:

```
ROUTE COMPARISON — Swap 100 USDC → PROS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#1 DEX_B  (direct)      → 901.4 PROS  ← BEST
#2 DEX_A  (via USDC)    → 891.2 PROS  (-1.1%)
#3 DEX_A  (direct)      → 847.3 PROS  (-5.9%)

Best route saves: 54.1 PROS vs worst option
Gas difference:   ~0.002 PROS extra for multi-hop
Net winner:       DEX_B direct (+54.1 PROS, -0 extra gas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 4 — Price Impact Check

```
price_impact = (spot_price - execution_price) / spot_price * 100
```

| Price Impact | Status |
|-------------|--------|
| < 0.1% | Excellent |
| 0.1% - 0.5% | Good |
| 0.5% - 1% | Acceptable |
| 1% - 3% | High — warn agent |
| > 3% | Very High — abort |

---

## Step 5 — Slippage Protection

Calculate `min_amount_out` before executing:

```
min_amount_out = best_quoted_amount * (1 - max_slippage / 100)
```

Pass this to `references/execute.md` as the execution parameter.

---

## Output to Calling Agent

```
ROUTE OPTIMIZATION RESULT
━━━━━━━━━━━━━━━━━━━━━━━━━
Input:          100 USDC
Output Token:   PROS
Best DEX:       [DEX name]
Best Route:     [direct / via TOKEN]
Expected Out:   [X PROS]
Min Out (0.5%): [X PROS]
Price Impact:   [X%] — [status]
Gas Extra:      [+X PROS vs direct]
Recommendation: [EXECUTE / HIGH_IMPACT_WARNING / ABORT]
━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Adding New DEXs

When a new DEX is found on Pharos, add to `assets/dexs.json`:

```json
{
  "name": "DEX Name",
  "type": "v2 or v3",
  "router": "0x...",
  "factory": "0x...",
  "quoter": "0x...",
  "fee_tiers": [500, 3000, 10000],
  "network": "mainnet or testnet"
}
```
