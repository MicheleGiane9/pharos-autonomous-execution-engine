# Pharos Autonomous Execution Engine

> Intelligent execution layer for AI agents on Pharos Network.

This skill lets AI agents **analyze, optimize, and execute** onchain actions on Pharos safely — before spending any gas, the agent checks risk, compares routes, and monitors your positions autonomously.

---

## What problems does it solve?

| Problem | What this skill does |
|---------|---------------------|
| "Is this swap safe right now?" | Simulates the tx, scores risk 1-10, estimates gas before executing |
| "Am I getting the best price?" | Compares routes on Faroswap to find the optimal path |
| "Is my LP position still earning fees?" | Monitors your price range and alerts when you're about to exit |
| "I want an agent to rebalance automatically" | Watches conditions and executes when triggered — no human needed |

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
Expected output:
```
  1 WPROS  =  $0.63 USDC
  Gas:        10 gwei
  Block:      9384429
```

**Analyze any wallet:**
```bash
node scripts/pharos.js wallet 0xYOUR_WALLET_ADDRESS
```
> Replace `0xYOUR_WALLET_ADDRESS` with any Pharos wallet (e.g. from MetaMask)

Expected output:
```
  PROS:   41.02   (~$25.93)
  WPROS:   1.08   (~$0.69)
  USDC:    0.00
  Total:  ~$26.62 USD
```

**Monitor LP position:**
```bash
node scripts/pharos.js lp 0xYOUR_WALLET_ADDRESS MIN_PRICE MAX_PRICE
```

**Compare Faroswap vs Jumper (best option to convert PROS):**
```bash
node scripts/pharos.js compare 40
```
Expected output:
```
  FAROSWAP (stays on Pharos)
  40 PROS → 25.15 USDC
  Time: instant  | Gas: ~$0.001 | Network: Pharos

  JUMPER BRIDGE (moves to other chain)
  Base       25.19 USDC | 1080s | gas $0.006 | Polymer (Standard)
  Arbitrum   25.19 USDC | 1080s | gas $0.006 | Polymer (Standard)
  Ethereum   25.19 USDC | 1080s | gas $0.006 | Polymer (Standard)

  BEST PRICE:  JUMPER → Base
  DIFFERENCE:  0.04 USDC
  VERDICT: Bridge to Base for better rate
```

**Bridge only (Jumper routes):**
```bash
node scripts/pharos.js bridge 40
```
> Replace `MIN_PRICE` and `MAX_PRICE` with your LP range.
> Find these in Faroswap → Pool → your position → "Min price" and "Max price"

Example:
```bash
node scripts/pharos.js lp 0x34e0...9680 0.32 1.29
```
Expected output:
```
  Status:       ✅  IN_RANGE — earning fees
  Price now:    $0.63 USDC/WPROS
  To lower:     48.5% of range
  Alert if drops 49% → exits range
```

---

## Use with Claude Code (AI agent mode)

```bash
# Step 1 — Install base skill engine
npx skills add https://github.com/PharosNetwork/pharos-skill-engine

# Step 2 — Install this skill
npx skills add https://github.com/MicheleGiane9/pharos-autonomous-execution-engine
```

Then open Claude Code and just talk:

```
"What is the current price of WPROS on Pharos?"
```
```
"Analyze my wallet 0xYOUR_ADDRESS on Pharos"
```
```
"Monitor my LP position on Pharos. Range: min $0.32 max $1.29"
```
```
"Swap 50 USDC for WPROS on Pharos using best route, max 0.5% slippage"
```
```
"Alert me if my LP position exits its range"
```

---

## Glossary (for new users)

| Term | Meaning |
|------|---------|
| **WPROS** | Wrapped PROS — the main token of Pharos Network |
| **USDC** | USD Coin — a stablecoin pegged to $1 |
| **LP position** | Liquidity you added to a trading pool to earn fees |
| **LP range** | The price range where your liquidity is active and earning |
| **Out of range** | When price moves outside your range — you stop earning fees |
| **Faroswap** | The main DEX (exchange) on Pharos Network |
| **AMM V3** | Concentrated liquidity model used by Faroswap pools |

---

## Skill modules

| Module | Reference | Description |
|--------|-----------|-------------|
| Pre-execution Analysis | `references/analyze.md` | Risk score, gas estimate, balance check before any tx |
| Route Optimization | `references/route.md` | Find best swap path on Faroswap |
| Guarded Execution | `references/execute.md` | Execute with slippage + gas guardrails |
| Autonomous Monitor | `references/monitor.md` | Watch onchain conditions, trigger actions |
| LP Range Monitor | `references/lp-range-monitor.md` | Alert when LP exits price range |

---

## Live contracts (Mainnet — Chain 1672)

| Contract | Address |
|----------|---------|
| Faroswap Router (DODOFeeRouteProxy) | `0xa5ca5fbe34e444f366b373170541ec6902b0f75c` |
| WPROS/USDC Pool — 0.01% fee | `0x912c9ade24d44d8922f0866d8dcb079f1363f647` |
| WPROS/USDC Pool — 0.30% fee | `0x4146d192da6428c9e1c243d2a953c625b5765623` |
| WPROS Token | `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` |
| USDC Token | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` |

---

## Networks

| Network | RPC | Chain ID | Symbol |
|---------|-----|----------|--------|
| Pharos Mainnet | https://rpc.pharos.xyz | 1672 | PROS |
| Atlantic Testnet | https://atlantic.dplabs-internal.com | 688689 | PHRS |

---

## Requirements

| What you want to do | What you need |
|--------------------|--------------|
| Check price, balances, LP range | Node.js v18+ (already in VSCode) |
| Execute swaps onchain | Foundry + `$PRIVATE_KEY` |

**Install Foundry** (only needed for executing transactions):
```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

---

## Built for Pharos Agent Center — Skill Builder Campaign
