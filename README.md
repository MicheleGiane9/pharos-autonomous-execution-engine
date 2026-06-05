# Pharos Autonomous Execution Engine

> Intelligent execution layer for AI agents on Pharos Network.

This skill lets AI agents **analyze, optimize, and execute** onchain actions on Pharos safely — before spending any gas, the agent checks risk, compares routes, monitors positions, and acts autonomously when conditions are met.

---

## What problems does it solve?

| Problem | What this skill does |
|---------|---------------------|
| "Is this swap safe right now?" | Scores risk 1-10, estimates gas, checks balance before executing |
| "Am I getting the best price?" | Compares Faroswap (2 pools) vs Jumper (5 chains) — picks the winner |
| "Is my LP position still earning fees?" | Monitors price range and alerts before you go out of range |
| "Buy WPROS when price drops to $0.55" | Watches price every 30s and auto-executes when triggered |
| "What should I do with my portfolio?" | Analyzes wallet and gives a concrete recommendation |

---

## Quick test — no install needed

Only requires **Node.js** (already included in VSCode):

```bash
git clone https://github.com/MicheleGiane9/pharos-autonomous-execution-engine
cd pharos-autonomous-execution-engine
```

**Check live price:**
```bash
node scripts/pharos.js price
```
```
  1 WPROS  =  $0.6115 USDC
  Gas:        10 gwei
  Block:      9415000
```

**Analyze any wallet:**
```bash
node scripts/pharos.js wallet 0xYOUR_WALLET_ADDRESS
```
```
  PROS:   41.02   (~$25.09)
  WPROS:   1.08   (~$0.66)
  USDC:    0.00
  Total:  ~$25.75 USD

  ── AGENT RECOMMENDATION ──────────────
  ⚠️  95% of portfolio is PROS/WPROS
     Suggestion: swap ~12.63 WPROS → USDC to diversify
     node scripts/pharos.js swap 12.63 WPROS USDC
  💡 Gas is very low — ideal time to execute transactions
```

**Compare Faroswap vs Jumper (5 chains):**
```bash
node scripts/pharos.js compare 40
```
```
  FAROSWAP — Onchain (stays on Pharos)
  Pool 0.01%   24.46 USDC  instant  gas ~$0.001  ← best onchain
  Pool 0.30%   24.40 USDC  instant  gas ~$0.001

  JUMPER BRIDGE — Cross-chain (moves to other network)
  Base        24.30 USDC   1080s   gas $0.006  Polymer (Standard)
  Arbitrum    24.30 USDC   1080s   gas $0.006  Polymer (Standard)
  ...

  BEST PRICE:   Faroswap 0.01%
  YOU RECEIVE:  24.46 USDC
  VERDICT:      Stay on Pharos — best rate + instant + cheapest gas
```

**Swap tokens (analyze + execute):**
```bash
# Show analysis only (no key needed — safe to run)
node scripts/pharos.js swap 10 WPROS USDC

# Execute on-chain (needs PRIVATE_KEY)
export PRIVATE_KEY=0x...
node scripts/pharos.js swap 10 WPROS USDC
```
```
  PRE-EXECUTION ANALYSIS — Pharos Network
  Action:      Swap 10 WPROS → USDC
  Best route:  Faroswap pool 0.01%
  Est. output: ~6.1152 USDC
  Min output:  6.0847 USDC (0.5% slippage)
  Gas price:   10 gwei
  Risk score:  2/10 — LOW ✅

  Step 1/2: Approving SwapRouter...  ✅
  Step 2/2: Executing swap...
  TX hash:   0x...
  SWAP SUCCESS ✅
```

**Autonomous monitor — watch + auto-execute:**
```bash
# Alert only (no key needed)
node scripts/pharos.js watch price-below 0.55

# Auto-execute when triggered
export PRIVATE_KEY=0x...
node scripts/pharos.js watch price-below 0.55 10 USDC WPROS
```
```
  AUTONOMOUS MONITOR — Pharos Network
  Watching:   WPROS price drops below $0.55
  Action:     Swap 10 USDC → WPROS
  Execution:  AUTO ✅  (PRIVATE_KEY set)
  Interval:   every 30s  |  Press Ctrl+C to stop

  👁  [14:32:01]  WPROS $0.6115 ↓  gas 10 gwei  10.27% away  (#1)
  👁  [14:32:31]  WPROS $0.6093 ↓  gas 10 gwei  10.78% away  (#2)
  🚨  [14:33:01]  WPROS $0.5488 ↓  gas 10 gwei  TRIGGERED    (#3)

  🚨 CONDITION MET — price crossed threshold!
  Step 1/2: Approving SwapRouter...  ✅
  Step 2/2: Executing swap...
  SWAP SUCCESS ✅  Received: 18.22 WPROS
```

**Monitor LP position:**
```bash
node scripts/pharos.js lp 0xYOUR_WALLET 0.32 1.29
```
```
  Status:       ✅  IN_RANGE — earning fees
  Price now:    $0.61 USDC/WPROS
  To lower:     44.1% of range
  Alert if drops 44% → exits range
```

**Bridge only (Jumper routes):**
```bash
node scripts/pharos.js bridge 40
```

---

## Use with Claude Code (AI agent mode)

```bash
npx skills add https://github.com/MicheleGiane9/pharos-autonomous-execution-engine
```

> **Optional:** Install the Pharos base skill engine for native `cast`/`forge` commands:
> ```bash
> npx skills add https://github.com/PharosNetwork/pharos-skill-engine
> ```

Then open Claude Code and just talk:

```
"What is the current price of WPROS on Pharos?"
"Analyze my wallet 0xYOUR_ADDRESS — what should I do?"
"Compare routes: swap 50 PROS to USDC on Pharos"
"Swap 10 WPROS to USDC with 0.5% slippage"
"Watch the price and buy 20 USDC of WPROS when it drops below $0.55"
"Alert me if my LP position exits its range"
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `node scripts/pharos.js price` | Live WPROS/USDC price from Faroswap |
| `node scripts/pharos.js wallet <addr>` | Balances + USD total + agent recommendation |
| `node scripts/pharos.js lp <addr> <min> <max>` | LP range status + out-of-range alerts |
| `node scripts/pharos.js compare <amount>` | Faroswap (2 pools) vs Jumper (5 chains) — best verdict |
| `node scripts/pharos.js bridge <amount>` | Bridge routes via Jumper across 5 chains |
| `node scripts/pharos.js swap <amount> <from> <to>` | Pre-execution analysis, then execute swap |
| `node scripts/pharos.js watch <condition> <price> [amount from to]` | Autonomous monitor — executes when triggered |

### Watch conditions
| Condition | Description |
|-----------|-------------|
| `price-below <N>` | Triggers when WPROS drops below $N |
| `price-above <N>` | Triggers when WPROS rises above $N |

---

## Skill modules (Claude Code)

| Module | Reference | Description |
|--------|-----------|-------------|
| Pre-execution Analysis | `references/analyze.md` | Risk score, gas estimate, balance check before any tx |
| Route Optimization | `references/route.md` | Find best swap path on Faroswap |
| Guarded Execution | `references/execute.md` | Execute with slippage + gas guardrails |
| Autonomous Monitor | `references/monitor.md` | Watch onchain conditions, trigger actions |
| LP Range Monitor | `references/lp-range-monitor.md` | Alert when LP exits price range |

---

## Requirements

| What you want to do | What you need |
|--------------------|--------------|
| Check price, balances, LP range, compare routes | Node.js v18+ (already in VSCode) |
| Execute swaps, watch + auto-execute | `npm install ethers` + `.env` file with `PRIVATE_KEY` |

## Security — private key setup

**NEVER type your private key in a chat or AI conversation.**

Store it in a local `.env` file:

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env and paste your key (MetaMask → Account Details → Show Private Key)
# PRIVATE_KEY=0xYOUR_KEY_HERE

# 3. The script loads it automatically — no export needed
node scripts/pharos.js swap 10 WPROS USDC
```

The `.env` file is listed in `.gitignore` — it will never be pushed to GitHub.

---

## Live contracts (Mainnet — Chain 1672)

| Contract | Address |
|----------|---------|
| Faroswap SwapRouter | `0xf38d34c8382b9079b0f85309578b43b8479Cd875` |
| Faroswap Router (DODOFeeRouteProxy) | `0xa5ca5fbe34e444f366b373170541ec6902b0f75c` |
| WPROS/USDC Pool — 0.01% fee | `0x912c9ade24d44d8922f0866d8dcb079f1363f647` |
| WPROS/USDC Pool — 0.30% fee | `0x4146d192da6428c9e1c243d2a953c625b5765623` |
| AMM V3 Factory | `0x2c90ccb0b989afa2433f499698451a25744a552b` |
| WPROS Token | `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` |
| USDC Token | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` |

> All addresses discovered by decoding on-chain bytecode — not copied from docs.

---

## Networks

| Network | RPC | Chain ID | Symbol |
|---------|-----|----------|--------|
| Pharos Mainnet | https://rpc.pharos.xyz | 1672 | PROS |
| Atlantic Testnet | https://atlantic.dplabs-internal.com | 688689 | PHRS |

---

## Glossary

| Term | Meaning |
|------|---------|
| **WPROS** | Wrapped PROS — the main token of Pharos Network |
| **USDC** | USD Coin — a stablecoin pegged to $1 |
| **LP position** | Liquidity you added to a trading pool to earn fees |
| **LP range** | The price range where your liquidity is active and earning |
| **Out of range** | When price moves outside your range — you stop earning fees |
| **Faroswap** | The main DEX (exchange) on Pharos Network |
| **AMM V3** | Concentrated liquidity model used by Faroswap pools |
| **Autonomous monitor** | Agent watches price and executes automatically when condition is met |

---

## Built for Pharos Agent Center — Skill Builder Campaign
