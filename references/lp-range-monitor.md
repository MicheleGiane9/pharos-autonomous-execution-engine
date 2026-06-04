# LP Range Monitor — Out-of-Range Alert

## Purpose

Monitor liquidity provider (LP) positions in AMM V3 pools on Pharos. When the token price moves toward or outside the LP's price range, alert the agent immediately. Out-of-range positions stop earning fees — every minute out of range is lost income.

## Agent Guidelines

> This module runs continuously alongside `references/monitor.md`. Check current tick against LP position range on every cycle. Alert at 3 levels: WARNING (approaching), CRITICAL (very close), OUT_OF_RANGE (already outside). When OUT_OF_RANGE, suggest rebalance action.

---

## Key Concepts

In AMM V3 (concentrated liquidity), every LP position has:
- `tickLower` — minimum tick of the range
- `tickUpper` — maximum tick of the range
- If current tick is between tickLower and tickUpper → **IN RANGE** (earning fees)
- If current tick is outside → **OUT OF RANGE** (not earning fees)

---

## Step 1 — Get Current Tick from Pool

```bash
# slot0 returns: sqrtPriceX96, currentTick, ...
cast call <pool_address> \
  "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" \
  --rpc-url https://rpc.pharos.xyz
```

**WPROS/USDC Pool (0x912c9ade24d44d8922f0866d8dcb079f1363f647):**
```bash
cast call 0x912c9ade24d44d8922f0866d8dcb079f1363f647 \
  "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" \
  --rpc-url https://rpc.pharos.xyz
# Returns: sqrtPriceX96, currentTick, ...
# currentTick is the second value
```

---

## Step 2 — Get LP Position Range

### Option A — Auto-detect (if Position Manager address is known)

```bash
# Step 2a: Count how many LP positions this wallet has
cast call <nft_position_manager> \
  "balanceOf(address)(uint256)" \
  <wallet_address> \
  --rpc-url https://rpc.pharos.xyz

# Step 2b: Get each position token ID
cast call <nft_position_manager> \
  "tokenOfOwnerByIndex(address,uint256)(uint256)" \
  <wallet_address> <index> \
  --rpc-url https://rpc.pharos.xyz

# Step 2c: Read position data (tickLower=6th, tickUpper=7th value)
cast call <nft_position_manager> \
  "positions(uint256)(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)" \
  <token_id> \
  --rpc-url https://rpc.pharos.xyz
```

**Pharos Position Manager:** Check `assets/dexs.json` for current address.
If not set, fall back to Option B.

### Option B — User provides range (fallback)

If Position Manager is not found, ask the user:
> "What is the min and max price of your LP range? (Find it in Faroswap → Pool → your position)"

Convert prices to ticks:
```
tickLower = round( log(minPrice / 10^12) / log(1.0001) )
tickUpper = round( log(maxPrice / 10^12) / log(1.0001) )
```

**Example:**
```
minPrice = $0.322535  →  tickLower = -287640
maxPrice = $1.289674  →  tickUpper = -273780
```

---

## Step 3 — Calculate Price from Tick

Convert tick to human-readable price:

```
price_raw = 1.0001 ^ tick
price_USDC_per_WPROS = price_raw * (10^18) / (10^6)
```

**Example with current tick -280889:**
```
price_raw = 1.0001 ^ (-280889) ≈ 6.26e-13
price = 6.26e-13 * 10^12 = $0.626 USDC per WPROS
```

---

## Step 4 — Calculate Range Status

```
distance_to_lower = currentTick - tickLower   (positive = above lower)
distance_to_upper = tickUpper - currentTick   (positive = below upper)
range_width = tickUpper - tickLower
pct_to_lower = distance_to_lower / range_width * 100
pct_to_upper = distance_to_upper / range_width * 100
```

**Alert Thresholds:**

| Status | Condition | Action |
|--------|-----------|--------|
| IN_RANGE | currentTick between tickLower and tickUpper | Monitor only |
| WARNING | < 10% of range remaining on either side | Alert agent |
| CRITICAL | < 5% of range remaining on either side | Urgent alert |
| OUT_OF_RANGE | currentTick outside [tickLower, tickUpper] | Alert + suggest rebalance |

---

## Step 5 — Alert Format

```
LP RANGE ALERT — WPROS/USDC Pool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status:          ⚠️ WARNING — approaching lower bound
Current Price:   $0.626 USDC per WPROS
Current Tick:    -280889

Your Range:      $0.580 — $0.720 USDC
Lower Bound:     $0.580 (tick -284100)
Upper Bound:     $0.720 (tick -277600)

Distance to lower:  8.3% of range remaining
Distance to upper:  67.4% of range remaining

Trend:           Price down 3.2% in last hour
At current pace: Exits range in ~4.2 hours

⚠️  ACTION SUGGESTED:
  Option A: Rebalance now — move range down to $0.540—$0.680
  Option B: Add more liquidity at lower range to extend coverage
  Option C: Continue monitoring (risk: fees stop if exits range)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 6 — Out-of-Range Alert

```
LP OUT OF RANGE ALERT — WPROS/USDC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status:          🚨 OUT OF RANGE — NOT EARNING FEES

Current Price:   $0.571 USDC per WPROS
Your Range:      $0.580 — $0.720 USDC

Time out of range:   ~23 minutes
Estimated fees lost: ~$0.43 (based on pool volume)

IMMEDIATE ACTION OPTIONS:
  A: Remove liquidity and re-add in new range
  B: Wait for price to recover into range
  C: Set stop-loss and exit position

Autonomous execution available:
  "Remove liquidity from position #[tokenId] and rebalance"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Monitor Loop for LP Range

```
LOOP every 5 minutes:
  1. cast call pool slot0() → get currentTick
  2. Calculate currentPrice from tick
  3. Compare with tickLower and tickUpper
  4. Calculate % distance to each bound
  5. Evaluate alert level
     → IN_RANGE + >10% margin: log "in range, monitoring"
     → WARNING (<10%): alert agent immediately
     → CRITICAL (<5%): urgent alert, prepare rebalance tx
     → OUT_OF_RANGE: alert + estimate fees lost + suggest action
  6. Track price trend (last 3 readings)
  7. Project time to exit range at current pace
```

---

## Error Reference

| Error | Cause | Action |
|-------|-------|--------|
| slot0 reverts | Pool address wrong | Verify pool address |
| Position not found | Wrong tokenId | Ask user for correct tokenId |
| No liquidity | Position already removed | Stop monitoring, alert |
