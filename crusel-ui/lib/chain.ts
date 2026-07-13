import { createPublicClient, http, parseAbi, defineChain, formatUnits } from "viem";

export const xlayer = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: {
    default: { name: "OKLink", url: "https://web3.okx.com/explorer/x-layer-testnet" },
  },
});

export const client = createPublicClient({ chain: xlayer, transport: http() });

export const BRAIN = "0xcdb76F807f389878Ddae95F521A1fC2fd1a54aC1" as const;
export const RECORD = "0x78EA5B902cB99A0CA9334143BE7591F4f1836719" as const;
export const HANDS = "0x023144421BCD65c16eEf80aB50B9A0f0369e44Cf" as const;

export const TOKENS = [
  {
    symbol: "BTC",
    address: "0x0000000000000000000000000000000000000b7c" as const,
    feed: "0x32861a8B91D0F445ca6fC6A86239BaA5Ca9D0039" as const,
  },
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000e74" as const,
    feed: "0x78Fc3f0595b5Ca5A967001ddD38220589EF94f33" as const,
  },
];
export const brainAbi = parseAbi([
  "function check(address) view returns (uint8,uint256,uint256,uint256)",
  "function positions(address) view returns (address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool)",
  "function ladderLength(address) view returns (uint256)",
  "function getRung(address,uint256) view returns (uint256,uint256)",
  "function nonce() view returns (uint256)",
]);

export const recordAbi = parseAbi([
  "function callCount() view returns (uint256)",
  "function executedCount() view returns (uint256)",
  "function executionRateBps() view returns (uint256)",
  "function totalCalls() view returns (uint256)",
  "function getCall(uint256) view returns (uint256,address,uint256,uint256,uint256,string,uint256,address,bytes32,uint8)",
]);

// ---------- formatting ----------

export const usd = (v: bigint) =>
  "$" +
  Number(formatUnits(v, 8)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const usdShort = (v: bigint) =>
  "$" +
  Number(formatUnits(v, 8)).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

export const pct = (bps: bigint) => (Number(bps) / 100).toFixed(2) + "%";

export const units = (v: bigint) => Number(formatUnits(v, 18)).toFixed(4);

export const short = (a: string) => a.slice(0, 6) + "\u2026" + a.slice(-4);

export const clock = (ts: bigint) => {
  const d = new Date(Number(ts) * 1000);
  return d.toISOString().slice(11, 19);
};

export const day = (ts: bigint) => {
  const d = new Date(Number(ts) * 1000);
  return d.toISOString().slice(0, 10);
};

export type Call = {
  id: number;
  nonce: bigint;
  token: `0x${string}`;
  units: bigint;
  triggerPrice: bigint;
  gainBps: bigint;
  reason: string;
  calledAt: bigint;
  executedBy: `0x${string}`;
  txHash: `0x${string}`;
  status: number; // 0 OPEN, 1 EXECUTED
};

export type Position = {
  feed: `0x${string}`;
  basisPerUnit: bigint;
  originalUnits: bigint;
  remainingUnits: bigint;
  peakPrice: bigint;
  trailArmBps: bigint;
  trailBps: bigint;
  rungsFired: bigint;
  trailArmed: boolean;
  active: boolean;
};

export type Rung = { gainBps: bigint; sellBps: bigint };

export const ZERO = "0x0000000000000000000000000000000000000000";
