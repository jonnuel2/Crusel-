import 'dotenv/config';
import {
  createPublicClient, createWalletClient, http,
  parseAbi, formatUnits, defineChain
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const xlayer = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_RPC] } },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const pub = createPublicClient({ chain: xlayer, transport: http() });
const wallet = createWalletClient({ account, chain: xlayer, transport: http() });

const BRAIN = process.env.BRAIN;
const HANDS = process.env.HANDS;
const BOOKS = process.env.BOOKS;

const brainAbi = parseAbi([
  'function check(address) view returns (uint8,uint256,uint256,uint256)',
  'function fire(address) returns (uint256)',
  'function nonce() view returns (uint256)',
]);

const handsAbi = parseAbi([
  'function execute(uint256,address,uint256,uint256,string) returns (uint256)',
  'function settled(uint256) view returns (bool)',
]);

const booksAbi = parseAbi([
  'function summary(address) view returns (uint256,uint256,int256,uint256)',
]);

const TOKENS = [
  { symbol: 'BTC', address: process.env.BTC_TOKEN },
  { symbol: 'ETH', address: process.env.ETH_TOKEN },
];

const REASONS = { 1: 'RUNG', 2: 'TRAIL' };
const usd = (v) => '$' + Number(formatUnits(v, 8)).toLocaleString(
  'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }
);

const POLL_MS = 15_000;

async function tick() {
  const stamp = new Date().toISOString().slice(11, 19);

  for (const tok of TOKENS) {
    try {
      const [reason, units, gainBps, price] = await pub.readContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'check', args: [tok.address],
      });

      const gain = (Number(gainBps) / 100).toFixed(2);

      if (reason === 0) {
        console.log(`[${stamp}] ${tok.symbol}  ${usd(price)}  ${gain}%  — idle`);
        continue;
      }

      console.log(
        `[${stamp}] ${tok.symbol}  ${usd(price)}  ${gain}%  → ${REASONS[reason]} TRIGGERED`
      );

      // 1. BRAIN: fire the intent
      const fireHash = await wallet.writeContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'fire', args: [tok.address],
      });
      await pub.waitForTransactionReceipt({ hash: fireHash });

      const intentNonce = await pub.readContract({
        address: BRAIN, abi: brainAbi, functionName: 'nonce',
      });
      console.log(`         intent #${intentNonce}  ${fireHash}`);

      // 2. HANDS: execute + post to BOOKS
      const execHash = await wallet.writeContract({
        address: HANDS, abi: handsAbi,
        functionName: 'execute',
        args: [intentNonce, tok.address, units, price, REASONS[reason]],
      });
      await pub.waitForTransactionReceipt({ hash: execHash });
      console.log(`         settled     ${execHash}`);

      // 3. BOOKS: read running totals
      const [proceeds, basis, pnl] = await pub.readContract({
        address: BOOKS, abi: booksAbi,
        functionName: 'summary', args: [tok.address],
      });
      console.log(
        `         books: Dr ${usd(proceeds)} | Cr basis ${usd(basis)} | Cr gain ${usd(pnl)}`
      );

    } catch (err) {
      const msg = err.shortMessage || err.message;
      if (msg.includes('stale feed')) {
        console.log(`[${stamp}] ${tok.symbol}  feed stale — skipping`);
      } else if (msg.includes('inactive')) {
        console.log(`[${stamp}] ${tok.symbol}  position closed`);
      } else {
        console.log(`[${stamp}] ${tok.symbol}  error: ${msg}`);
      }
    }
  }
}

console.log('Profit Taker keeper — polling every 15s\n');
await tick();
setInterval(tick, POLL_MS);