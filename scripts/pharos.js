#!/usr/bin/env node
/**
 * Pharos Autonomous Execution Engine
 * Zero-dependency blockchain reader — only requires Node.js v18+
 * No Foundry, no npm install needed.
 */

const NETWORKS = {
  mainnet: { rpc: "https://rpc.pharos.xyz", chainId: 1672, symbol: "PROS" },
  testnet: { rpc: "https://atlantic.dplabs-internal.com", chainId: 688689, symbol: "PHRS" }
};

const CONTRACTS = {
  router:   "0xa5ca5fbe34e444f366b373170541ec6902b0f75c",
  wpros:    "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0",
  usdc:     "0xC879C018dB60520F4355C26eD1a6D572cdAC1815",
  pool_001: "0x912c9ade24d44d8922f0866d8dcb079f1363f647", // WPROS/USDC 0.01%
  pool_030: "0x4146d192da6428c9e1c243d2a953c625b5765623"  // WPROS/USDC 0.30%
};

// ─── RPC helper ─────────────────────────────────────────────────────────────

async function rpcCall(method, params, network = "mainnet") {
  const res = await fetch(NETWORKS[network].rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── ABI encode helpers ──────────────────────────────────────────────────────

function encodeAddress(addr) {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function decodeUint(hex) {
  return BigInt("0x" + hex.replace("0x", ""));
}

function decodeAddress(hex) {
  return "0x" + hex.replace("0x", "").slice(-40);
}

async function ethCall(to, data, network = "mainnet") {
  return await rpcCall("eth_call", [{ to, data }, "latest"], network);
}

// ─── Blockchain reads ────────────────────────────────────────────────────────

async function getBlockNumber(network = "mainnet") {
  const hex = await rpcCall("eth_blockNumber", [], network);
  return parseInt(hex, 16);
}

async function getGasPrice(network = "mainnet") {
  const hex = await rpcCall("eth_gasPrice", [], network);
  return Number(BigInt(hex)) / 1e9; // in gwei
}

async function getNativeBalance(wallet, network = "mainnet") {
  const hex = await rpcCall("eth_getBalance", [wallet, "latest"], network);
  return Number(BigInt(hex)) / 1e18;
}

async function getERC20Balance(token, wallet, decimals, network = "mainnet") {
  // balanceOf(address) = 0x70a08231
  const data = "0x70a08231" + encodeAddress(wallet);
  const raw = await ethCall(token, data, network);
  return Number(decodeUint(raw)) / Math.pow(10, decimals);
}

async function getPoolSlot0(pool, network = "mainnet") {
  // slot0() = 0x3850c7bd
  const raw = await ethCall(pool, "0x3850c7bd", network);
  const hex = raw.replace("0x", "");

  // sqrtPriceX96 is uint160 stored in first 256-bit slot
  const sqrtPriceX96 = BigInt("0x" + hex.slice(0, 64));

  // tick is int24 stored in second 256-bit slot — decode as signed int256
  const tickUint = BigInt("0x" + hex.slice(64, 128));
  const SIGN = BigInt("0x8000000000000000000000000000000000000000000000000000000000000000");
  const MOD  = BigInt("0x10000000000000000000000000000000000000000000000000000000000000000");
  const currentTick = Number(tickUint >= SIGN ? tickUint - MOD : tickUint);

  // Calculate price from sqrtPriceX96
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtFloat = Number(sqrtPriceX96 * BigInt(1e9) / Q96) / 1e9;
  const price = sqrtFloat * sqrtFloat * 1e12;

  return { sqrtPriceX96, currentTick, price };
}

function tickToPrice(tick) {
  return Math.pow(1.0001, tick) * 1e12;
}

function priceToTick(price) {
  return Math.round(Math.log(price / 1e12) / Math.log(1.0001));
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdPrice() {
  const { currentTick } = await getPoolSlot0(CONTRACTS.pool_001);
  const price = tickToPrice(currentTick);
  const gas = await getGasPrice();
  const block = await getBlockNumber();

  console.log("\n=======================================");
  console.log("  PHAROS PRICE FEED");
  console.log("=======================================");
  console.log(`  1 WPROS  =  $${price.toFixed(4)} USDC`);
  console.log(`  1 USDC   =  ${(1/price).toFixed(2)} WPROS`);
  console.log(`  Gas:        ${gas} gwei`);
  console.log(`  Block:      ${block}`);
  console.log("=======================================\n");
}

async function cmdWallet(wallet) {
  const pros   = await getNativeBalance(wallet);
  const wpros  = await getERC20Balance(CONTRACTS.wpros, wallet, 18);
  const usdc   = await getERC20Balance(CONTRACTS.usdc, wallet, 6);
  const { price } = await getPoolSlot0(CONTRACTS.pool_001);
  const gas  = await getGasPrice();

  const total = (pros + wpros) * price + usdc;

  console.log("\n=======================================");
  console.log("  WALLET ANALYSIS — PHAROS");
  console.log(`  ${wallet.slice(0,10)}...${wallet.slice(-6)}`);
  console.log("=======================================");
  console.log(`  PROS:   ${pros.toFixed(4)}   (~$${(pros * price).toFixed(2)})`);
  console.log(`  WPROS:  ${wpros.toFixed(4)}   (~$${(wpros * price).toFixed(2)})`);
  console.log(`  USDC:   ${usdc.toFixed(2)}`);
  console.log(`  Total:  ~$${total.toFixed(2)} USD`);
  console.log(`\n  Price:  $${price.toFixed(4)} USDC/WPROS`);
  console.log(`  Gas:    ${gas} gwei — ${gas <= 15 ? "LOW ✅" : "HIGH ⚠️"}`);
  console.log("=======================================\n");
}

async function cmdLpMonitor(_wallet, minPrice, maxPrice, pool = "pool_030") {
  const poolAddr = CONTRACTS[pool];
  const { currentTick } = await getPoolSlot0(poolAddr);

  const currentPrice = tickToPrice(currentTick);
  const tickLower    = priceToTick(minPrice);
  const tickUpper    = priceToTick(maxPrice);
  const rangeWidth   = tickUpper - tickLower;
  const distLower    = currentTick - tickLower;
  const distUpper    = tickUpper - currentTick;
  const pctLower     = (distLower / rangeWidth * 100).toFixed(1);
  const pctUpper     = (distUpper / rangeWidth * 100).toFixed(1);
  const minPct       = Math.min(distLower, distUpper) / rangeWidth;

  let status, icon;
  if (currentTick <= tickLower)      { status = "OUT_OF_RANGE (below min)"; icon = "🚨"; }
  else if (currentTick >= tickUpper) { status = "OUT_OF_RANGE (above max)"; icon = "🚨"; }
  else if (minPct < 0.05)            { status = "CRITICAL";  icon = "🔴"; }
  else if (minPct < 0.10)            { status = "WARNING";   icon = "⚠️"; }
  else                               { status = "IN_RANGE";  icon = "✅"; }

  const dropToExit = ((currentPrice - minPrice) / currentPrice * 100).toFixed(1);
  const riseToExit = ((maxPrice - currentPrice) / currentPrice * 100).toFixed(1);

  console.log("\n=======================================");
  console.log("  LP RANGE MONITOR — PHAROS");
  console.log("  Pool WPROS/USDC 0.30%");
  console.log("=======================================");
  console.log(`  Status:       ${icon}  ${status}`);
  console.log(`  Earning fees: ${!status.includes("OUT") ? "YES ✅" : "NO 🚨"}`);
  console.log(`\n  Price now:    $${currentPrice.toFixed(4)} USDC/WPROS`);
  console.log(`  Your range:   $${minPrice} — $${maxPrice}`);
  console.log(`\n  To lower:     ${pctLower}% of range`);
  console.log(`  To upper:     ${pctUpper}% of range`);
  console.log(`\n  Alert if drops ${dropToExit}% → exits at min`);
  console.log(`  Alert if rises ${riseToExit}% → exits at max`);
  console.log("=======================================\n");
}

// ─── Bridge via Jumper/LI.FI ────────────────────────────────────────────────

const BRIDGE_CHAINS = {
  base:     { id: "8453",  name: "Base",     usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  arbitrum: { id: "42161", name: "Arbitrum", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  polygon:  { id: "137",   name: "Polygon",  usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  bnb:      { id: "56",    name: "BNB Chain",usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  ethereum: { id: "1",     name: "Ethereum", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
};

async function getBridgeQuote(toChain, amountPROS) {
  const chain = BRIDGE_CHAINS[toChain];
  if (!chain) return null;
  const amountWei = BigInt(Math.floor(amountPROS * 1e18)).toString();
  const params = new URLSearchParams({
    fromChain: "1672",
    toChain: chain.id,
    fromToken: "0x0000000000000000000000000000000000000000",
    toToken: chain.usdc,
    fromAmount: amountWei,
    fromAddress: "0x0000000000000000000000000000000000000001"
  });
  const res = await fetch("https://li.quest/v1/quote?" + params);
  return await res.json();
}

async function cmdBridge(amountPROS = 1) {
  console.log("\n=======================================");
  console.log("  BRIDGE ANALYZER — Pharos → Other Chains");
  console.log(`  Bridging ${amountPROS} PROS via Jumper`);
  console.log("=======================================\n");

  for (const [key, chain] of Object.entries(BRIDGE_CHAINS)) {
    try {
      const data = await getBridgeQuote(key, amountPROS);
      if (data?.estimate) {
        const out     = (data.estimate.toAmount / 1e6).toFixed(4);
        const time    = data.estimate.executionDuration;
        const gasCost = data.estimate.gasCosts?.[0]?.amountUSD || "?";
        const bridge  = data.toolDetails?.name || "unknown";
        console.log(`  ${chain.name.padEnd(10)} ${out} USDC | ${String(time).padStart(4)}s | gas $${gasCost} | ${bridge}`);
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  console.log("\n  Source: Jumper.xyz (LI.FI API)");
  console.log("  Execute bridge at: https://jumper.exchange");
  console.log("=======================================\n");
}

// ─── Compare Faroswap vs Jumper ─────────────────────────────────────────────

async function cmdCompare(amountPROS = 1) {
  console.log("\n=================================================");
  console.log("  BEST EXECUTION — Faroswap vs Jumper");
  console.log(`  Converting ${amountPROS} PROS → USDC`);
  console.log("=================================================\n");

  // Both Faroswap pools
  const [slot1, slot2] = await Promise.all([
    getPoolSlot0(CONTRACTS.pool_001),
    getPoolSlot0(CONTRACTS.pool_030)
  ]);
  const faro001Out = amountPROS * slot1.price;
  const faro030Out = amountPROS * slot2.price;
  const bestFaro   = faro001Out >= faro030Out
    ? { out: faro001Out, fee: "0.01%", pool: "pool_001" }
    : { out: faro030Out, fee: "0.30%", pool: "pool_030" };

  console.log("  FAROSWAP — Onchain (stays on Pharos)");
  console.log(`  Pool 0.01%   ${faro001Out.toFixed(4)} USDC  instant  gas ~$0.001${faro001Out >= faro030Out ? "  ← best onchain" : ""}`);
  console.log(`  Pool 0.30%   ${faro030Out.toFixed(4)} USDC  instant  gas ~$0.001${faro030Out >  faro001Out ? "  ← best onchain" : ""}`);

  console.log("\n  JUMPER BRIDGE — Cross-chain (moves to other network)");

  const bridgeResults = [];
  for (const [key, chain] of Object.entries(BRIDGE_CHAINS)) {
    try {
      const data = await getBridgeQuote(key, amountPROS);
      if (data?.estimate) {
        const out     = parseFloat((data.estimate.toAmount / 1e6).toFixed(4));
        const time    = data.estimate.executionDuration;
        const gasCost = data.estimate.gasCosts?.[0]?.amountUSD || "?";
        const bridge  = data.toolDetails?.name || "?";
        bridgeResults.push({ chain: chain.name, out, time, gasCost, bridge });
        console.log(`  ${chain.name.padEnd(10)}  ${out.toFixed(4)} USDC  ${String(time).padStart(5)}s   gas $${gasCost}  ${bridge}`);
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }

  // Final verdict
  const bestBridge = bridgeResults.sort((a, b) => b.out - a.out)[0];
  const allOptions = [
    { name: `Faroswap ${bestFaro.fee}`, out: bestFaro.out, instant: true },
    ...(bestBridge ? [{ name: `Jumper → ${bestBridge.chain}`, out: bestBridge.out, instant: false }] : [])
  ].sort((a, b) => b.out - a.out);

  const winner = allOptions[0];
  const diff   = (allOptions[0].out - allOptions[allOptions.length - 1].out).toFixed(4);

  console.log("\n  ───────────────────────────────────────────────");
  console.log(`  BEST PRICE:   ${winner.name}`);
  console.log(`  YOU RECEIVE:  ${winner.out.toFixed(4)} USDC`);
  console.log(`  DIFFERENCE:   ${diff} USDC vs worst option`);

  if (winner.instant) {
    console.log("  VERDICT:      Stay on Pharos — best rate + instant + cheapest gas");
  } else {
    const timeMins = Math.round((bestBridge?.time || 0) / 60);
    console.log(`  VERDICT:      Bridge to ${bestBridge?.chain} for best rate (+${diff} USDC, ~${timeMins} min)`);
  }
  console.log("=================================================\n");
}

// ─── Swap via Faroswap SwapRouter ────────────────────────────────────────────

const SWAP_ROUTER = "0xf38d34c8382b9079b0f85309578b43b8479Cd875";

const TOKEN_INFO = {
  WPROS:  { address: CONTRACTS.wpros, decimals: 18, symbol: "WPROS" },
  USDC:   { address: CONTRACTS.usdc,  decimals: 6,  symbol: "USDC"  },
};

const POOL_FEES = { WPROS_USDC_001: 100, WPROS_USDC_030: 3000 };

async function cmdSwap(amountStr, fromSymbol = "WPROS", toSymbol = "USDC", slippagePct = 0.5) {
  const amount = parseFloat(amountStr);
  if (!amount || amount <= 0) { console.log("ERROR: Invalid amount"); return; }

  const from = TOKEN_INFO[fromSymbol.toUpperCase()];
  const to   = TOKEN_INFO[toSymbol.toUpperCase()];
  if (!from || !to || from === to) {
    console.log("Supported: WPROS, USDC");
    return;
  }

  // ── Pre-execution analysis ──────────────────────────────────────────────────
  const [slot1, slot2] = await Promise.all([
    getPoolSlot0(CONTRACTS.pool_001),
    getPoolSlot0(CONTRACTS.pool_030),
  ]);
  const price        = slot1.price;
  const price030     = slot2.price;
  const gas          = await getGasPrice();

  let estimatedOut, poolFee, poolLabel;
  if (fromSymbol.toUpperCase() === "WPROS") {
    const out001 = amount * price;
    const out030 = amount * price030;
    if (out001 >= out030) {
      estimatedOut = out001; poolFee = 100; poolLabel = "0.01%";
    } else {
      estimatedOut = out030; poolFee = 3000; poolLabel = "0.30%";
    }
  } else {
    // USDC -> WPROS
    const out001 = amount / price;
    const out030 = amount / price030;
    if (out001 >= out030) {
      estimatedOut = out001; poolFee = 100; poolLabel = "0.01%";
    } else {
      estimatedOut = out030; poolFee = 3000; poolLabel = "0.30%";
    }
  }

  const minOut = estimatedOut * (1 - slippagePct / 100);

  // Risk score (simple heuristic)
  const riskScore = gas > 50 ? 7 : gas > 20 ? 4 : 2;
  const riskLabel = riskScore >= 7 ? "HIGH ⚠️" : riskScore >= 4 ? "MEDIUM" : "LOW ✅";

  console.log("\n=================================================");
  console.log("  PRE-EXECUTION ANALYSIS — Pharos Network");
  console.log("=================================================");
  console.log(`  Action:      Swap ${amount} ${fromSymbol} → ${toSymbol}`);
  console.log(`  Best route:  Faroswap pool ${poolLabel}`);
  console.log(`  Est. output: ~${estimatedOut.toFixed(4)} ${toSymbol}`);
  console.log(`  Min output:  ${minOut.toFixed(4)} ${toSymbol} (${slippagePct}% slippage)`);
  console.log(`  Gas price:   ${gas} gwei`);
  console.log(`  Risk score:  ${riskScore}/10 — ${riskLabel}`);
  console.log("=================================================\n");

  if (riskScore >= 8) {
    console.log("  ⚠️  HIGH RISK: gas price is elevated. Aborting for safety.");
    console.log("  Set PHAROS_FORCE=1 to override.\n");
    if (!process.env.PHAROS_FORCE) return;
  }

  // ── Require ethers + key for execution ─────────────────────────────────────
  let ethers;
  try { ethers = require("ethers"); }
  catch (_) {
    console.log("  To execute: npm install ethers  then set PRIVATE_KEY\n");
    return;
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log("  To execute this swap, set your private key:");
    console.log("    export PRIVATE_KEY=0x...");
    console.log(`    node scripts/pharos.js swap ${amountStr} ${fromSymbol} ${toSymbol}`);
    console.log("=================================================\n");
    return;
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(NETWORKS.mainnet.rpc);
  const wallet   = new ethers.Wallet(privateKey, provider);
  const addr     = wallet.address;

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ];
  const fromContract = new ethers.Contract(from.address, erc20Abi, wallet);

  const balance   = await fromContract.balanceOf(addr);
  const amountIn  = ethers.parseUnits(amount.toString(), from.decimals);
  const amountMin = ethers.parseUnits(minOut.toFixed(to.decimals), to.decimals);

  console.log(`  Wallet:    ${addr.slice(0,10)}...${addr.slice(-6)}`);
  console.log(`  Balance:   ${ethers.formatUnits(balance, from.decimals)} ${fromSymbol}`);

  if (balance < amountIn) {
    console.log(`\n  ERROR: Insufficient balance. Need ${amount} ${fromSymbol}, have ${ethers.formatUnits(balance, from.decimals)}.`);
    return;
  }

  // Step 1 — Approve if needed
  const allowance = await fromContract.allowance(addr, SWAP_ROUTER);
  if (allowance < amountIn) {
    console.log("\n  Step 1/2: Approving SwapRouter to spend " + fromSymbol + "...");
    const approveTx = await fromContract.approve(SWAP_ROUTER, amountIn);
    console.log("  TX:        " + approveTx.hash);
    await approveTx.wait();
    console.log("  Approved   ✅");
  } else {
    console.log("  Allowance  ✅ (already approved)");
  }

  // Step 2 — Execute swap
  const routerAbi = [
    "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  ];
  const router   = new ethers.Contract(SWAP_ROUTER, routerAbi, wallet);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log("\n  Step 2/2: Executing swap...");
  const swapTx = await router.exactInputSingle({
    tokenIn:              from.address,
    tokenOut:             to.address,
    fee:                  poolFee,
    recipient:            addr,
    deadline,
    amountIn,
    amountOutMinimum:     amountMin,
    sqrtPriceLimitX96:    0n,
  });

  console.log("  TX hash:   " + swapTx.hash);
  console.log("  Pharosscan: https://pharosscan.xyz/tx/" + swapTx.hash);
  const receipt = await swapTx.wait();

  console.log("\n=================================================");
  if (receipt.status === 1) {
    console.log("  SWAP SUCCESS ✅");
    console.log(`  Sold:      ${amount} ${fromSymbol}`);
    console.log(`  Received:  ~${estimatedOut.toFixed(4)} ${toSymbol}`);
  } else {
    console.log("  SWAP FAILED ❌");
  }
  console.log(`  Gas used:  ${receipt.gasUsed.toString()}`);
  console.log(`  TX:        ${swapTx.hash}`);
  console.log("=================================================\n");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

(async () => {
  try {
    if (cmd === "price")        await cmdPrice();
    else if (cmd === "wallet")  await cmdWallet(args[0]);
    else if (cmd === "lp")      await cmdLpMonitor(args[0], parseFloat(args[1]), parseFloat(args[2]));
    else if (cmd === "bridge")  await cmdBridge(parseFloat(args[0]) || 1);
    else if (cmd === "compare") await cmdCompare(parseFloat(args[0]) || 1);
    else if (cmd === "swap")    await cmdSwap(args[0], args[1] || "WPROS", args[2] || "USDC", parseFloat(args[3]) || 0.5);
    else {
      console.log("Usage:");
      console.log("  node scripts/pharos.js price");
      console.log("  node scripts/pharos.js wallet <address>");
      console.log("  node scripts/pharos.js lp <address> <minPrice> <maxPrice>");
      console.log("  node scripts/pharos.js bridge <amountPROS>");
      console.log("  node scripts/pharos.js compare <amountPROS>");
      console.log("  node scripts/pharos.js swap <amount> <fromToken> <toToken> [slippage%]");
      console.log("    Example: node scripts/pharos.js swap 10 WPROS USDC 0.5");
      console.log("    Requires: PRIVATE_KEY env var");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
