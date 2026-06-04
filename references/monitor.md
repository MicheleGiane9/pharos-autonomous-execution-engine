# Autonomous Monitor & Trigger

## Purpose

Watch onchain conditions on Pharos and autonomously execute actions when conditions are met. This is the core of autonomous agent behavior — set it and let it run.

## Agent Guidelines

> This module runs in a polling loop. Check conditions using read-only `cast call` operations. When a condition is met, invoke `references/execute.md` with the configured action. Always log each check cycle. Never execute without first running `references/analyze.md`.

---

## Condition Types

### 1 — Price Condition

```bash
# Get token price from DEX (read reserve ratio)
cast call <dex_pair_address> \
  "getReserves()(uint112,uint112,uint32)" \
  --rpc-url <rpc_url>

# Calculate price from reserves
# price = reserve1 / reserve0 (adjusted for decimals)
```

**Example condition:** `PROS_price < 0.95 * entry_price` → trigger buy

---

### 2 — Balance / Portfolio Condition

```bash
# Check portfolio balance ratio
TOKEN_A_BAL=$(cast call <token_a> "balanceOf(address)(uint256)" <wallet> --rpc-url <rpc>)
TOKEN_B_BAL=$(cast call <token_b> "balanceOf(address)(uint256)" <wallet> --rpc-url <rpc>)

# Agent calculates ratio and compares to target
```

**Example condition:** `PROS_balance / total_portfolio < 0.45` → rebalance

---

### 3 — Liquidation Risk Condition

```bash
# Check health factor from lending protocol
cast call <lending_protocol> \
  "getUserHealthFactor(address)(uint256)" \
  <wallet_address> \
  --rpc-url <rpc_url>
```

**Example condition:** `health_factor < 1.3` → add collateral or repay

---

### 4 — Time-based Condition

No cast command needed — use timestamp comparison:

```
current_unix_timestamp > target_unix_timestamp
```

**Example:** `every Friday 00:00 UTC` → rebalance portfolio

---

## Monitor Loop Structure

The agent runs this loop:

```
LOOP every [interval]:
  1. Read condition from chain using cast call
  2. Evaluate: is condition met?
     → NO: log "condition not met, next check in [interval]"
     → YES: 
        a. Run analyze.md (pre-execution analysis)
        b. If risk = LOW or MEDIUM: run execute.md
        c. If risk = HIGH: alert calling agent, pause monitor
  3. Wait [interval]
  4. Repeat
```

---

## Monitor Configuration Format

```
MONITOR CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Condition Type:   [price/balance/health/time]
Check Interval:   [30s / 1min / 5min / 1hour]
Condition:        [PROS price < $X]
Action:           [buy 100 USDC worth of PROS]
Guardrails:       max_slippage=0.5%, max_gas=0.05 PROS
Max Executions:   [1 / unlimited / N times]
Stop After:       [condition met once / date / never]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Monitor Log Format

Each cycle, log to calling agent:

```
[2026-06-04 14:32:01] MONITOR CHECK
  Condition: PROS price < $0.90
  Current:   $0.94
  Status:    NOT MET — waiting
  Next:      5 minutes

[2026-06-04 14:37:01] MONITOR CHECK
  Condition: PROS price < $0.90
  Current:   $0.88
  Status:    ✅ TRIGGERED
  Action:    Executing buy 100 USDC → PROS
  Analysis:  Risk LOW (score 2/10)
  TX:        0xabc...
```

---

## Stop Conditions

The monitor stops when:
1. `max_executions` reached
2. `stop_after` date/time passed
3. Calling agent sends stop signal
4. Risk stays HIGH for 3+ consecutive checks (safety pause)
5. Balance insufficient to execute action

---

## Error Reference

| Error | Cause | Action |
|-------|-------|--------|
| RPC timeout | Network issue | Retry after 30s, log warning |
| Price feed unavailable | DEX has no liquidity | Pause monitor, alert agent |
| Health factor call fails | Protocol changed ABI | Alert agent, stop monitor |
| Repeated HIGH risk | Market conditions dangerous | Pause 1 hour, alert agent |
