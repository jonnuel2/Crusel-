import { createPublicClient, http, defineChain, parseAbi, formatUnits } from "viem";

// ─────────────────────────────────────────────────────────
// Network config. Pick with NETWORK=mainnet | testnet (default testnet).
// Everything (rpc, brain, record, tokens) is still individually
// env-overridable, so a fresh mainnet deploy is a one-line switch.
// ─────────────────────────────────────────────────────────

type NetCfg = {
  chainId: number;
  name: string;
  rpc: string;
  brain: string;
  record: string;
  tokens: Record<string, string>;
};

const CONFIG: Record<string, NetCfg> = {
  // X Layer testnet — the demo path. Feeds are MockAggregators the keeper
  // drives, so a ladder actually fires on camera. Tokens are the placeholder
  // keys the testnet deploy whitelisted the mock feeds against.
  testnet: {
    chainId: 1952,
    name: "X Layer Testnet",
    rpc: "https://testrpc.xlayer.tech",
    brain: "0x1D8B77A44Edac389721dE0769f8f55A565cF0526",
    record: "0xF1766Fa22F203AE07CaFE643CA9e742ffBc9AC8b",
    tokens: {
      BTC: "0x0000000000000000000000000000000000000b7c",
      ETH: "0x0000000000000000000000000000000000000e74",
    },
  },
  // X Layer mainnet — real, whitelisted X Layer price feeds
  // (AggregatorV3Interface, the exact interface BRAIN consumes). Token keys
  // are the canonical X Layer mainnet token addresses. Set BRAIN and RECORD
  // (env or below) after you deploy the mainnet contracts.
  mainnet: {
    chainId: 196,
    name: "X Layer",
    rpc: "https://rpc.xlayer.tech",
    brain: "", // ← fill after mainnet deploy, or set env BRAIN
    record: "", // ← fill after mainnet deploy, or set env RECORD
    tokens: {
      WBTC: "0xEA034fb02eB1808C2cc3adbC15f447B93CbE08e1",
      WETH: "0x5a77f1443d16ee5761d310e38b62f77f726bc71c",
      WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
      USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
      USDC: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
      DAI: "0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4",
    },
  },
};

const NETWORK = (process.env.NETWORK || "testnet").toLowerCase();
const cfg = CONFIG[NETWORK] ?? CONFIG.testnet;

export const xlayer = defineChain({
  id: cfg.chainId,
  name: cfg.name,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_RPC || cfg.rpc] } },
});

export const client = createPublicClient({ chain: xlayer, transport: http() });

export const BRAIN = process.env.BRAIN || cfg.brain;
export const RECORD = process.env.RECORD || cfg.record;

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

// Minimal read on any whitelisted feed. X Layer's real feeds are not all
// 8-decimal (WBTC/WETH/OKB report 2, USDC 4), while the demo MockAggregator
// is 8 — so we never assume, we read decimals() and scale to it.
export const aggregatorAbi = parseAbi([
  "function decimals() view returns (uint8)",
]);

// Crusel watches tokens by symbol; the oracle behind each is whitelisted
// by the contract owner. Users pick a token, never an oracle — otherwise
// a caller could point Crusel at a feed that returns whatever they like.
export const TOKENS: Record<string, `0x${string}`> = Object.fromEntries(
  Object.entries(cfg.tokens).map(([k, v]) => [k, v.toLowerCase() as `0x${string}`]),
);

export const SYMBOL_OF: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([k, v]) => [v.toLowerCase(), k]),
);

export const REASON = ["NONE", "RUNG", "TRAIL"] as const;
export const STATUS = ["OPEN", "EXECUTED"] as const;

// Prices are USD in the feed's own decimals. Pass the feed decimals so the
// same formatter is correct for an 8-decimal mock and a 2-decimal real feed.
export const usd = (v: bigint, decimals = 8) =>
  Number(formatUnits(v, decimals)).toLocaleString("en-US", {
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

// How many decimals the feed behind a token reports. Cached — feed decimals
// never change. Falls back to 8 (the mock's) if the feed can't be read.
const _decCache = new Map<string, number>();
export async function feedDecimals(token: `0x${string}`): Promise<number> {
  const key = token.toLowerCase();
  const hit = _decCache.get(key);
  if (hit !== undefined) return hit;

  let dec = 8;
  try {
    const feed = (await client.readContract({
      address: BRAIN as `0x${string}`,
      abi: brainAbi,
      functionName: "feedOf",
      args: [token],
    })) as `0x${string}`;

    if (feed && feed !== "0x0000000000000000000000000000000000000000") {
      dec = Number(
        await client.readContract({
          address: feed,
          abi: aggregatorAbi,
          functionName: "decimals",
        }),
      );
    }
  } catch {
    dec = 8;
  }

  _decCache.set(key, dec);
  return dec;
}

/** Price is USD in the feed's decimals. Accept a human number, return the bigint. */
export function toPriceScaled(usdValue: number, decimals = 8): bigint {
  return BigInt(Math.round(usdValue * 10 ** decimals));
}

/** Units are 18-decimal notional. Accept a human amount, return the bigint. */
export function toUnits18(amount: number): bigint {
  return BigInt(Math.round(amount * 1e18));
}
