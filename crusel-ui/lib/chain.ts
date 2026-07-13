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

export const BRAIN = "0x1D8B77A44Edac389721dE0769f8f55A565cF0526" as const;
export const RECORD = "0xF1766Fa22F203AE07CaFE643CA9e742ffBc9AC8b" as const;
export const HANDS = "0x0CEd2aE9b08a9917641E13f74595a382B80bf045" as const;

export const TOKENS = [
  {
    symbol: "BTC",
    address: "0x0000000000000000000000000000000000000b7c" as const,
    feed: "0xB822d19B623b8F0c37f401913c42842BD480Be81" as const,
  },
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000e74" as const,
    feed: "0xcA02Cc2d402C4D75013932C3a492F27FafAc9579" as const,
  },
];

export const brainAbi = parseAbi([
  "function check(address,address) view returns (uint8,uint256,uint256,uint256)",
  "function positions(address,address) view returns (address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool)",
  "function ladderLength(address,address) view returns (uint256)",
  "function getRung(address,address,uint256) view returns (uint256,uint256)",
  "function nonce() view returns (uint256)",
  "function userCount() view returns (uint256)",
  "function users(uint256) view returns (address)",
  "function tokenCountOf(address) view returns (uint256)",
  "function userTokens(address,uint256) view returns (address)",
]);

export const recordAbi = parseAbi([
  "function callCount() view returns (uint256)",
  "function executedCount() view returns (uint256)",
  "function executionRateBps() view returns (uint256)",
  "function totalCalls() view returns (uint256)",
  "function getCall(uint256) view returns (uint256,address,address,uint256,uint256,uint256,string,uint256,address,bytes32,uint8)",
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
  user: `0x${string}`;
  token: `0x${string}`;
  units: bigint;
  triggerPrice: bigint;
  gainBps: bigint;
  reason: string;
  calledAt: bigint;
  executedBy: `0x${string}`;
  txHash: `0x${string}`;
  status: number;
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

export const DEMO_USER = "0x4FABd3fd5D3B959b8c62567422B785dE3C926b15" as const;

export const ZERO = "0x0000000000000000000000000000000000000000";
