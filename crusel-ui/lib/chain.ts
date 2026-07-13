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

export const BRAIN = "0x66225aDfbA5B9Ad7e1Ce1e581c5198FA2130De82" as const;
export const RECORD = "0x53459D8452ECf17956C3Cd4549B6d7cAc297f291" as const;
export const HANDS = "0xa39dfD7fE237F18e44303304F4123d91669732Ef" as const;

export const TOKENS = [
  {
    symbol: "BTC",
    address: "0x0000000000000000000000000000000000000b7c" as const,
    feed: "0x3b4c12CB7ec57685a0cadC7AB327512C4a5206FE" as const,
  },
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000e74" as const,
    feed: "0x2241f2c452FE6004330CFd4ffB0e9B11c6e75C38" as const,
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
