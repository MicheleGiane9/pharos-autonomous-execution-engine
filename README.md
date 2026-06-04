# Pharos Autonomous Execution Engine

> Intelligent execution layer for AI agents operating onchain on Pharos Network.

Before any onchain action, the agent **analyzes risk, finds the best route, executes safely, and monitors your positions autonomously** — including alerting when your LP position exits its range.

---

## Quick Start (3 steps)

### Step 1 — Install Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```
Verify: `cast --version`

### Step 2 — Install this Skill
```bash
npx skills add https://github.com/YOUR_USERNAME/pharos-autonomous-execution-engine
```

### Step 3 — Set your wallet key
```bash
export PRIVATE_KEY=your_private_key_here
```

---

## Try it now — copy and paste these prompts

### Check price on Pharos
```
What is the current price of WPROS in USDC on Pharos mainnet?
```

### Analyze a swap before executing
```
Analyze this swap on Pharos before executing: swap 100 USDC for WPROS. 
Check gas cost, price impact, and risk score.
```

### Execute a safe swap
```
Execute a swap of 50 USDC for WPROS on Pharos mainnet using Faroswap. 
Use max 0.5% slippage and abort if risk score is above 5.
```

### Monitor your LP position
```
Monitor my WPROS/USDC LP position on Pharos. 
My range is $0.50 to $0.80. Alert me if price approaches the boundary.
```

### Autonomous rebalance agent
```
Every hour, check my WPROS/USDC pool position on Pharos. 
If price is within 10% of my range boundary, alert me. 
If it exits range, automatically remove and rebalance liquidity.
```

### Check if a swap is worth it right now
```
Is now a good time to swap 200 USDC for WPROS on Pharos? 
Check gas, price trend, and LP range health.
```

---

## Networks

| Network | RPC | Chain ID | Symbol |
|---------|-----|----------|--------|
| Pharos Mainnet | https://rpc.pharos.xyz | 1672 | PROS |
| Atlantic Testnet | https://atlantic.dplabs-internal.com | 688689 | PHRS |

## Key Contracts (Mainnet)

| Contract | Address |
|----------|---------|
| Faroswap Router (DODOFeeRouteProxy) | `0xa5ca5fbe34e444f366b373170541ec6902b0f75c` |
| WPROS/USDC Pool (AMM V3, $501K TVL) | `0x912c9ade24d44d8922f0866d8dcb079f1363f647` |
| WPROS Token | `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` |
| USDC Token | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` |

---

## What this skill does

| Module | What it does |
|--------|-------------|
| **Pre-execution Analysis** | Simulates every tx before sending — risk score 1-10, gas estimate, balance check |
| **Route Optimization** | Finds best swap path on Faroswap, calculates price impact |
| **Guarded Execution** | Executes with safety limits — max slippage, max gas, abort on high risk |
| **Autonomous Monitor** | Watches any onchain condition and triggers actions automatically |
| **LP Range Monitor** | Alerts when your LP position approaches or exits its price range |

---

## Requirements

- [Foundry](https://book.getfoundry.sh/) — `cast` and `forge` in PATH
- `$PRIVATE_KEY` environment variable for write operations
- Read-only operations (price checks, analysis) require no key

---

## Built for Pharos Agent Center — Skill Builder Campaign
