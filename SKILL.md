# Pharos Autonomous Execution Engine

## Skill Identity

- **Name:** pharos-autonomous-execution-engine
- **Version:** 1.0.0
- **Triggers:** "pharos", "PROS", "PHRS", "WPROS", "faroswap", "swap on pharos", "analyze tx", "best route", "LP range", "out of range", "monitor position", "rebalance", "watch price", "when price drops", "when price rises", "auto-execute", "autonomous", "buy the dip", "portfolio"
- **Dependencies:** `node` v18+ (for all read operations); `npm install ethers` + `PRIVATE_KEY` (for swap execution)
- **Networks:** Pharos Mainnet (Chain 1672), Atlantic Testnet (Chain 688689)

## What This Skill Does

This skill gives autonomous AI agents the intelligence layer to execute onchain actions on Pharos safely and optimally. Instead of blindly executing transactions, agents using this skill will:

1. **Analyze** every action before execution (risk, cost, alternatives)
2. **Optimize** the execution path (best route, best timing, lowest gas)
3. **Execute** with guardrails (max slippage, max gas, risk limits)
4. **Monitor** onchain conditions and trigger actions autonomously

This skill is designed to be called by other agents as a module — not directly by humans.

## Capabilities

| Module | Reference File | Purpose |
|--------|---------------|---------|
| Pre-execution Analysis | `references/analyze.md` | Simulate and assess risk before any tx |
| Route Optimization | `references/route.md` | Find best DEX path for swaps |
| Guarded Execution | `references/execute.md` | Execute with safety guardrails |
| Autonomous Monitor | `references/monitor.md` | Watch conditions, trigger actions |
| LP Range Monitor | `references/lp-range-monitor.md` | Alert when LP position exits price range |

## Network Configuration

Network configs are stored in `assets/networks.json`.
Token list is stored in `assets/tokens.json`.

Default network is **Atlantic Testnet** unless user specifies mainnet.

## Pre-execution Requirements

Before ANY write operation:
1. Verify Foundry is installed: `which cast`
2. Confirm network (testnet vs mainnet) with user
3. Verify wallet balance covers tx + gas
4. Run simulation before broadcasting
5. Report estimated cost to agent before executing

## Agent Guidelines

> This skill is invoked when an autonomous agent needs to interact with Pharos blockchain. Always run analysis before execution. Never skip guardrails. Always confirm network before write operations. Report results in structured format so calling agents can parse them.

## Example Invocations

```
Agent: "What is the current WPROS price and gas on Pharos?"
Skill: → node scripts/pharos.js price

Agent: "Analyze my wallet 0x... on Pharos — what should I do?"
Skill: → node scripts/pharos.js wallet 0x... → return balances + recommendation

Agent: "Swap 50 WPROS to USDC using best route"
Skill: → node scripts/pharos.js swap 50 WPROS USDC → pre-analysis → execute

Agent: "Watch price and buy 20 USDC of WPROS when it drops below $0.55"
Skill: → node scripts/pharos.js watch price-below 0.55 20 USDC WPROS → monitor + auto-execute

Agent: "Compare: should I swap on Faroswap or bridge to Base?"
Skill: → node scripts/pharos.js compare 40 → return verdict

Agent: "Is my LP position still earning fees? Range: $0.32 — $1.29"
Skill: → node scripts/pharos.js lp 0x... 0.32 1.29 → return status + alert level
```

## Autonomous Execution Flow

```
watch command lifecycle:
  1. Parse condition (price-below | price-above) + threshold
  2. Poll getPoolSlot0() every 30s for live price
  3. Show live feed: price, trend, gas, distance to threshold
  4. When condition triggered:
     a. If PRIVATE_KEY set → run cmdSwap() automatically
     b. If no key → alert with ready-to-execute command
  5. Stop after execution (one-shot) or continue monitoring
```
