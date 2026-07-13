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

const BRAIN  = process.env.BRAIN;
const HANDS  = process.env.HANDS;
const RECORD = process.env.RECORD;

const brainAbi = parseAbi([
  'function check(address) view returns (uint8,uint256,uint256,uint256)',
  'function fire(address) returns (uint256)',
  'function nonce() view returns (uint256)',
]);

const handsAbi = parseAbi([
  'function execute(uint256,bytes32) returns (uint256)',
]);

const recordAbi = parseAbi([
  'function callCount() view returns (uint256)',
  'function executedCount() view returns (uint256)',
  'function executionRateBps() view returns (uint256)',
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

// Set to false to simulate a caller ignoring our calls
const AUTO_EXECUTE = true;

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
        `[${stamp}] ${tok.symbol}  ${usd(price)}  ${gain}%  → ${REASONS[reason]} CALLED`
      );

      // BRAIN makes the call. Logged whether or not anyone acts.
      const fireHash = await wallet.writeContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'fire', args: [tok.address],
      });
      await pub.waitForTransactionReceipt({ hash: fireHash });

      const intentNonce = await pub.readContract({
        address: BRAIN, abi: brainAbi, functionName: 'nonce',
      });
      console.log(`         call #${intentNonce}  ${fireHash}`);

      if (AUTO_EXECUTE) {
        // Reference caller acts and acknowledges. Anyone could do this.
        const execHash = await wallet.writeContract({
          address: HANDS, abi: handsAbi,
          functionName: 'execute',
          args: [intentNonce, fireHash],
        });
        await pub.waitForTransactionReceipt({ hash: execHash });
        console.log(`         executed by 0x4FAb…  ${execHash}`);
      } else {
        console.log(`         no caller acted — call remains OPEN`);
      }

      await new Promise(r => setTimeout(r, 2000));

      const [calls, executed, rate] = await Promise.all([
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'callCount' }),
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'executedCount' }),
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'executionRateBps' }),
      ]);

      console.log(
        `         record: ${executed}/${calls} calls executed — ${Number(rate) / 100}%`
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

console.log('Profit Taker — call agent. Polling every 15s.\n');

async function loop() {
  await tick();
  setTimeout(loop, POLL_MS);
}
loop();