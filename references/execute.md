# Guarded Execution

## Purpose

Execute onchain transactions on Pharos with safety guardrails. This module is called AFTER pre-execution analysis returns `LOW` or `MEDIUM` risk.

## Agent Guidelines

> Always run `references/analyze.md` before this module. Enforce guardrails strictly — if any limit is exceeded, abort and report. Never broadcast on mainnet without explicit network confirmation.

---

## Guardrail Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_slippage` | 0.5% | Max price deviation for swaps |
| `max_gas_gwei` | 50 | Max gas price willing to pay |
| `max_gas_pct` | 3% | Max gas as % of tx value |
| `abort_if_risk` | HIGH | Abort if risk score >= 7 |
| `daily_limit` | none | Optional: max spend per day |

---

## Execute Native Transfer

```bash
cast send <recipient_address> \
  --value <amount_in_wei> \
  --private-key $PRIVATE_KEY \
  --rpc-url <rpc_url> \
  --gas-limit <estimated_gas * 1.2>
```

**Convert PROS to wei:**
```bash
cast to-wei <amount> ether
# Example: cast to-wei 1.5 ether → 1500000000000000000
```

---

## Execute ERC20 Transfer

```bash
cast send <token_address> \
  "transfer(address,uint256)" \
  <recipient> <amount_in_wei> \
  --private-key $PRIVATE_KEY \
  --rpc-url <rpc_url>
```

---

## Execute Swap on Faroswap (DODO Protocol)

DODOFeeRouteProxy: `0xa5ca5fbe34e444f366b373170541ec6902b0f75c`

```bash
# Step 1: Approve DODOFeeRouteProxy to spend your token
cast send <token_address> \
  "approve(address,uint256)" \
  0xa5ca5fbe34e444f366b373170541ec6902b0f75c <amount_with_buffer> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.pharos.xyz

# Step 2: Execute token → token swap via DODO
cast send 0xa5ca5fbe34e444f366b373170541ec6902b0f75c \
  "dodoSwapV2TokenToToken(address,address,uint256,uint256,address[],uint256,bool,uint256)(uint256)" \
  <token_in> <token_out> <amount_in> <min_return> \
  "[<dodo_pool_address>]" 0 false <deadline> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.pharos.xyz

# Step 3 (PROS native → token): ETH/native to token
cast send 0xa5ca5fbe34e444f366b373170541ec6902b0f75c \
  "dodoSwapV2ETHToToken(address,uint256,address[],uint256,bool,uint256)(uint256)" \
  <token_out> <min_return> \
  "[<dodo_pool_address>]" 0 false <deadline> \
  --value <amount_in_wei> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.pharos.xyz
```

**Calculate min_amount_out with slippage:**
```
min_amount_out = quoted_amount * (1 - max_slippage/100)
# Example: 1000 PROS quoted, 0.5% slippage
# min = 1000 * 0.995 = 995 PROS minimum
```

---

## Execute Contract Write Call

```bash
cast send <contract_address> \
  "<function_sig>(<param_types>)" \
  [args...] \
  --private-key $PRIVATE_KEY \
  --rpc-url <rpc_url> \
  --gas-limit <estimated_gas * 1.2>
```

---

## Post-Execution Verification

After broadcasting, verify the transaction:

```bash
# Get receipt
cast receipt <tx_hash> --rpc-url <rpc_url>

# Check status (1 = success, 0 = failed)
cast receipt <tx_hash> --field status --rpc-url <rpc_url>
```

---

## Execution Report Format

Return to calling agent after execution:

```
PHAROS EXECUTION RESULT
━━━━━━━━━━━━━━━━━━━━━━━
Status:       [SUCCESS / FAILED]
TX Hash:      [0x...]
Explorer:     [https://pharosscan.xyz/tx/0x...]
Gas Used:     [X PROS/PHRS]
Block:        [#block_number]
Guardrails:   All passed / [which failed]
━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Guardrail Abort Messages

| Guardrail | Abort Message |
|-----------|--------------|
| High risk score | `ABORT: Risk score 8/10 exceeds limit. Reason: simulation reverted` |
| Gas too high | `ABORT: Gas cost 4.2% exceeds max_gas_pct limit of 3%` |
| Slippage exceeded | `ABORT: Price moved 1.2% since quote, exceeds max_slippage 0.5%` |
| Insufficient balance | `ABORT: Balance 0.8 PROS insufficient for tx (need 1.2 PROS + gas)` |
| Network mismatch | `ABORT: Mainnet operation requires explicit confirmation` |
