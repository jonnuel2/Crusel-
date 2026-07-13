import { createPublicClient, http, defineChain, parseAbi, formatUnits } from "viem";

export const xlayer = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_RPC || "https://testrpc.xlayer.tech"] } },
});

export const client = createPublicClient({ chain: xlayer, transport: http() });

export const BRAIN = process.env.BRAIN || "0x1D8B77A44Edac389721dE0769f8f55A565cF0526";
export const RECORD = process.env.RECORD || "0xF1766Fa22F203AE07CaFE643CA9e742ffBc9AC8b";

export const brainAbi = parseAbi([
  "function check(address,address) view returns (uint8,uint256,uint256,uint256)",
  "function price(address) view returns (uint256)",
  "function positions(address,address) view returns (address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool)",
  "function ladderLength(address,address) view returns (uint256)",
  "function getRung(address,address,uint256) view returns (uint256,uint256)",
  "function supportedTokens(uint256) view returns (address)",
  "function supportedTokenCount() view returns (uint256)",
  "function feedOf(address) view returns (address)",
  "function userCount() view returns (uint256)",
  "function openPosition(address,uint256,uint256,uint256,uint256,(uint256,uint256)[])",
  "function closePosition(address)",
  "function fire(address,address) returns (uint256)",
]);

export const recordAbi = parseAbi([
  "function callCount() view returns (uint256)",
  "function executedCount() view returns (uint256)",
  "function executionRateBps() view returns (uint256)",
  "function totalCalls() view returns (uint256)",
  "function callCountOf(address) view returns (uint256)",
  "function callsOfUser(address,uint256) view returns (uint256)",
  "function getCall(uint256) view returns (uint256,address,address,uint256,uint256,uint256,string,uint256,address,bytes32,uint8)",
  "function acknowledge(uint256,bytes32) returns (uint256)",
]);

// Crusel watches tokens by symbol; the oracle behind each is whitelisted
// by the contract owner. Users pick a token, never an oracle — otherwise
// a caller could point Crusel at a feed that returns whatever they like.
export const TOKENS: Record<string, `0x${string}`> = {
  BTC: "0x0000000000000000000000000000000000000b7c",
  ETH: "0x0000000000000000000000000000000000000e74",
};

export const SYMBOL_OF: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([k, v]) => [v.toLowerCase(), k]),
);

export const REASON = ["NONE", "RUNG", "TRAIL"] as const;
export const STATUS = ["OPEN", "EXECUTED"] as const;

export const usd = (v: bigint) =>
  Number(formatUnits(v, 8)).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export const pct = (bps: bigint | number) => `${Number(bps) / 100}%`;
export const amt = (v: bigint) => Number(formatUnits(v, 18)).toFixed(6);

export function resolveToken(input: string): `0x${string}` {
  const up = input.toUpperCase().trim();
  if (TOKENS[up]) return TOKENS[up];
  if (input.startsWith("0x") && input.length === 42) {
    return input.toLowerCase() as `0x${string}`;
  }
  throw new Error(
    `Unknown token "${input}". Crusel watches: ${Object.keys(TOKENS).join(", ")}`,
  );
}

/** Price is 8-decimal USD onchain. Accept a human number, return the bigint. */
export function toPrice8(usdValue: number): bigint {
  return BigInt(Math.round(usdValue * 1e8));
}

/** Units are 18-decimal. Accept a human amount, return the bigint. */
export function toUnits18(amount: number): bigint {
  return BigInt(Math.round(amount * 1e18));
}
