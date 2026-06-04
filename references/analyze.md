# Pre-Execution Analysis

## Purpose

Before ANY transaction is executed on Pharos, the agent MUST run this analysis module. This prevents bad trades, unexpected costs, and dangerous positions.

## Agent Guidelines

> Always run pre-execution analysis before broadcasting any transaction. Return a structured risk report to the calling agent. Never skip this step for write operations.

---

## Step 1 — Simulate the Transaction

Use `cast call` to dry-run without broadcasting:

```bash
cast call <contract_address> \
  "<function_sig>(<param_types>)(<return_types>)" \
  [args...] \
  --rpc-url <rpc_url>
```

**For Mainnet:**
```bash
cast call <contract> "<sig>" [args] --rpc-url https://rpc.pharos.xyz
```

**For Testnet:**
```bash
cast call <contract> "<sig>" [args] --rpc-url https://atlantic.dplabs-internal.com
```

If simulation reverts, **abort execution** and report the revert reason to the calling agent.

---

## Step 2 — Estimate Gas Cost

```bash
cast estimate <contract_address> \
  "<function_sig>(<param_types>)" \
  [args...] \
  --rpc-url <rpc_url>
```

Then get current gas price:
```bash
cast gas-price --rpc-url <rpc_url>
```

**Calculate total cost:**
```
total_gas_cost_wei = gas_units * gas_price_wei
total_gas_cost_PROS = total_gas_cost_wei / 10^18
```

**Guardrail:** If gas cost > 5% of transaction value, warn the calling agent.

---

## Step 3 — Check Wallet Balance

```bash
# Native balance (PROS/PHRS)
cast balance <wallet_address> --ether --rpc-url <rpc_url>

# ERC20 balance
cast call <token_address> \
  "balanceOf(address)(uint256)" \
  <wallet_address> \
  --rpc-url <rpc_url>
```

**Guardrail:** Abort if balance < (transaction amount + estimated gas).

---

## Step 4 — Risk Score Calculation

Calculate a risk score from 1 (safe) to 10 (dangerous):

| Factor | Low Risk | High Risk | Points |
|--------|----------|-----------|--------|
| Gas cost vs tx value | < 1% | > 5% | +1 to +3 |
| Simulation result | Success | Revert | +5 |
| Balance after tx | > 20% remaining | < 5% remaining | +1 to +3 |
| Contract verified | Yes | No | +2 |
| Token in known list | Yes | Unknown | +1 |

**Risk Levels:**
- Score 1-3: `LOW` — proceed
- Score 4-6: `MEDIUM` — warn calling agent, proceed with confirmation  
- Score 7-10: `HIGH` — abort, report reason

---

## Step 5 — Output Report

Return structured report to calling agent:

```
PHAROS EXECUTION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━
Action:          [swap/transfer/contract call]
Network:         [Mainnet / Testnet]
Simulation:      [SUCCESS / REVERT: reason]
Estimated Gas:   [X PROS/PHRS] (~$X USD)
Gas % of Value:  [X%]
Balance After:   [X PROS/PHRS]
Risk Score:      [1-10] — [LOW/MEDIUM/HIGH]
Recommendation:  [EXECUTE / WARN / ABORT]
━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Reference

| Error | Cause | Action |
|-------|-------|--------|
| `execution reverted` | Bad params or logic error | Abort, report revert reason |
| `insufficient funds` | Balance too low | Abort, show deficit amount |
| `gas estimation failed` | Contract might not exist | Verify contract address |
| `connection refused` | RPC unavailable | Retry or switch RPC |
