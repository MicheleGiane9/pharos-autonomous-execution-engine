# Pharos Autonomous Execution Engine

## Skill Identity

- **Name:** pharos-autonomous-execution-engine
- **Version:** 1.0.0
- **Triggers:** "pharos", "PROS", "PHRS", "WPROS", "faroswap", "swap on pharos", "analyze tx", "best route", "LP range", "out of range", "monitor position", "atlantic-testnet", "pacific-ocean", "rebalance"
- **Dependencies:** `cast` and `forge` (Foundry toolkit), `node` (for price calculations)
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
Agent: "Swap 100 USDC to PROS with best execution"
Skill: → analyze route → compare DEXs → check gas → execute best path

Agent: "Monitor PROS price, buy 50 USDC when it drops 10%"  
Skill: → set up condition monitor → execute when triggered

Agent: "Is it safe to borrow 500 USDC against my PROS collateral?"
Skill: → check collateral ratio → calculate liquidation price → return risk score
```
