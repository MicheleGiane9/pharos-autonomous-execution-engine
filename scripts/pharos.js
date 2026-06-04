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
  console.log("\n=======================================");
  console.log("  SWAP COMPARISON — Faroswap vs Jumper");
  console.log(`  ${amountPROS} PROS → USDC`);
  console.log("=======================================\n");

  // Faroswap price (onchain, instant)
  const { price } = await getPoolSlot0(CONTRACTS.pool_001);
  const faroOut = (amountPROS * price).toFixed(4);
  const gas = await getGasPrice();

  console.log("  FAROSWAP (stays on Pharos)");
  console.log(`  ${amountPROS} PROS → ${faroOut} USDC`);
  console.log(`  Time: instant  | Gas: ~$0.001 | Network: Pharos\n`);

  console.log("  JUMPER BRIDGE (moves to other chain)");

  const results = [];
  for (const [key, chain] of Object.entries(BRIDGE_CHAINS)) {
    try {
      const data = await getBridgeQuote(key, amountPROS);
      if (data?.estimate) {
        const out    = (data.estimate.toAmount / 1e6).toFixed(4);
        const time   = data.estimate.executionDuration;
        const gasCost= data.estimate.gasCosts?.[0]?.amountUSD || "?";
        const bridge = data.toolDetails?.name || "?";
        results.push({ chain: chain.name, out: parseFloat(out), time, gasCost, bridge });
        console.log(`  ${chain.name.padEnd(10)} ${out} USDC | ${String(time).padStart(5)}s | gas $${gasCost} | ${bridge}`);
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }

  // Best option
  const bestBridge = results.sort((a,b) => b.out - a.out)[0];
  const faroFloat  = parseFloat(faroOut);
  const best = faroFloat >= (bestBridge?.out || 0) ? "FAROSWAP" : `JUMPER → ${bestBridge?.chain}`;
  const diff = Math.abs(faroFloat - (bestBridge?.out || 0)).toFixed(4);

  console.log("\n  ─────────────────────────────────────");
  console.log(`  BEST PRICE:  ${best}`);
  console.log(`  DIFFERENCE:  ${diff} USDC`);
  if (best === "FAROSWAP") {
    console.log("  VERDICT: Stay on Pharos — better rate + instant + cheaper gas");
  } else {
    console.log("  VERDICT: Bridge to " + bestBridge?.chain + " for better rate");
  }
  console.log("=======================================\n");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

(async () => {
  try {
    if (cmd === "price")   await cmdPrice();
    else if (cmd === "wallet")  await cmdWallet(args[0]);
    else if (cmd === "lp")      await cmdLpMonitor(args[0], parseFloat(args[1]), parseFloat(args[2]));
    else if (cmd === "bridge")  await cmdBridge(parseFloat(args[0]) || 1);
    else if (cmd === "compare") await cmdCompare(parseFloat(args[0]) || 1);
    else {
      console.log("Usage:");
      console.log("  node pharos.js price");
      console.log("  node pharos.js wallet <address>");
      console.log("  node pharos.js lp <address> <minPrice> <maxPrice>");
      console.log("  node pharos.js bridge <amountPROS>");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
