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
  'function check(address,address) view returns (uint8,uint256,uint256,uint256)',
  'function fire(address,address) returns (uint256)',
  'function nonce() view returns (uint256)',
  'function userCount() view returns (uint256)',
  'function users(uint256) view returns (address)',
  'function tokenCountOf(address) view returns (uint256)',
  'function userTokens(address,uint256) view returns (address)',
]);

const handsAbi = parseAbi([
  'function execute(uint256,bytes32) returns (uint256)',
]);

const recordAbi = parseAbi([
  'function callCount() view returns (uint256)',
  'function executedCount() view returns (uint256)',
  'function executionRateBps() view returns (uint256)',
]);

const SYMBOL = {
  [process.env.BTC_TOKEN.toLowerCase()]: 'BTC',
  [process.env.ETH_TOKEN.toLowerCase()]: 'ETH',
};

const REASONS = { 1: 'RUNG', 2: 'TRAIL' };
const usd = (v) => '$' + Number(formatUnits(v, 8)).toLocaleString(
  'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }
);
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

const POLL_MS = 15_000;
const AUTO_EXECUTE = true;   // false → calls go untaken

/** Walk the registry: every user, every token they registered. */
async function registry() {
  const n = await pub.readContract({
    address: BRAIN, abi: brainAbi, functionName: 'userCount',
  });

  const out = [];
  for (let i = 0; i < Number(n); i++) {
    const user = await pub.readContract({
      address: BRAIN, abi: brainAbi, functionName: 'users', args: [BigInt(i)],
    });

    const tc = await pub.readContract({
      address: BRAIN, abi: brainAbi, functionName: 'tokenCountOf', args: [user],
    });

    for (let j = 0; j < Number(tc); j++) {
      const token = await pub.readContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'userTokens', args: [user, BigInt(j)],
      });
      out.push({ user, token });
    }
  }
  return out;
}

async function tick() {
  const stamp = new Date().toISOString().slice(11, 19);
  const watch = await registry();

  if (watch.length === 0) {
    console.log(`[${stamp}] no positions registered`);
    return;
  }

  for (const { user, token } of watch) {
    const sym = SYMBOL[token.toLowerCase()] ?? short(token);
    const who = short(user);

    try {
      const [reason, units, gainBps, price] = await pub.readContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'check', args: [user, token],
      });

      const gain = (Number(gainBps) / 100).toFixed(2);

      if (reason === 0) {
        console.log(`[${stamp}] ${who}  ${sym}  ${usd(price)}  ${gain}%  — idle`);
        continue;
      }

      console.log(
        `[${stamp}] ${who}  ${sym}  ${usd(price)}  ${gain}%  → ${REASONS[reason]} CALLED`
      );

      const fireHash = await wallet.writeContract({
        address: BRAIN, abi: brainAbi,
        functionName: 'fire', args: [user, token],
      });
      await pub.waitForTransactionReceipt({ hash: fireHash });

      const intentNonce = await pub.readContract({
        address: BRAIN, abi: brainAbi, functionName: 'nonce',
      });
      console.log(`         call #${intentNonce}  ${fireHash}`);

      if (AUTO_EXECUTE) {
        const execHash = await wallet.writeContract({
          address: HANDS, abi: handsAbi,
          functionName: 'execute', args: [intentNonce, fireHash],
        });
        await pub.waitForTransactionReceipt({ hash: execHash });
        console.log(`         taken by ${short(account.address)}  ${execHash}`);
      } else {
        console.log(`         nobody acted — call remains OPEN`);
      }

      await new Promise(r => setTimeout(r, 2000));

      const [calls, executed, rate] = await Promise.all([
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'callCount' }),
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'executedCount' }),
        pub.readContract({ address: RECORD, abi: recordAbi, functionName: 'executionRateBps' }),
      ]);

      console.log(
        `         record: ${executed}/${calls} taken — ${Number(rate) / 100}%`
      );

    } catch (err) {
      const msg = err.shortMessage || err.message;
      if (msg.includes('inactive')) {
        console.log(`[${stamp}] ${who}  ${sym}  position closed`);
      } else if (msg.includes('stale feed')) {
        console.log(`[${stamp}] ${who}  ${sym}  feed stale`);
      } else {
        console.log(`[${stamp}] ${who}  ${sym}  error: ${msg}`);
      }
    }
  }
}

console.log('Crusel keeper — watching all registered positions\n');

async function loop() {
  await tick();
  setTimeout(loop, POLL_MS);
}
loop();