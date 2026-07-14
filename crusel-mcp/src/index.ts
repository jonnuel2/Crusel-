import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { encodeFunctionData } from "viem";
import {
  client,
  xlayer,
  BRAIN,
  RECORD,
  brainAbi,
  recordAbi,
  TOKENS,
  SYMBOL_OF,
  REASON,
  STATUS,
  usd,
  pct,
  amt,
  resolveToken,
  feedDecimals,
  toPriceScaled,
  toUnits18,
} from "./chain.js";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

function server() {
  const mcp = new McpServer({
    name: "crusel",
    version: "1.0.0",
  });

  // ─────────────────────────────────────────────────────────
  // READS
  // ─────────────────────────────────────────────────────────

  mcp.tool(
    "crusel_supported_tokens",
    "List the assets Crusel can watch. Call this first — Crusel only tracks tokens whose price oracle has been whitelisted, so a position can only be opened on one of these.",
    {},
    async () => {
      const n = (await client.readContract({
        address: BRAIN as `0x${string}`,
        abi: brainAbi,
        functionName: "supportedTokenCount",
      })) as bigint;

      const rows: string[] = [];
      for (let i = 0; i < Number(n); i++) {
        const token = (await client.readContract({
          address: BRAIN as `0x${string}`,
          abi: brainAbi,
          functionName: "supportedTokens",
          args: [BigInt(i)],
        })) as `0x${string}`;

        const px = (await client.readContract({
          address: BRAIN as `0x${string}`,
          abi: brainAbi,
          functionName: "price",
          args: [token],
        })) as bigint;

        const dec = await feedDecimals(token);
        const sym = SYMBOL_OF[token.toLowerCase()] ?? token;
        rows.push(`${sym.padEnd(5)} ${usd(px, dec).padStart(14)}   ${token}`);
      }

      return text(
        `Crusel watches ${rows.length} assets on X Layer:\n\n${rows.join("\n")}\n\n` +
          `Open a position with crusel_open_position.`,
      );
    },
  );

  mcp.tool(
    "crusel_check",
    "Ask Crusel whether an exit is triggered right now for a position. This is the core signal — poll it. Returns NONE (hold), RUNG (a ladder step has been reached), or TRAIL (the trailing stop fired; exit the whole remaining position). Free, no gas.",
    {
      user: z
        .string()
        .describe("The wallet address that owns the position (0x…)"),
      token: z.string().describe("Asset symbol (BTC, ETH) or token address"),
    },
    async ({ user, token }) => {
      const t = resolveToken(token);
      const sym = SYMBOL_OF[t.toLowerCase()] ?? t;
      const dec = await feedDecimals(t);

      const [reason, units, gainBps, price] = (await client.readContract({
        address: BRAIN as `0x${string}`,
        abi: brainAbi,
        functionName: "check",
        args: [user as `0x${string}`, t],
      })) as readonly [number, bigint, bigint, bigint];

      const pos = (await client.readContract({
        address: BRAIN as `0x${string}`,
        abi: brainAbi,
        functionName: "positions",
        args: [user as `0x${string}`, t],
      })) as readonly [
        `0x${string}`, bigint, bigint, bigint, bigint,
        bigint, bigint, bigint, boolean, boolean,
      ];

      const [, basis, orig, remaining, peak, trailArmBps, trailBps, rungsFired, trailArmed, active] = pos;

      if (!active) {
        return text(
          `No active ${sym} position for ${user}.\n` +
            `Open one with crusel_open_position.`,
        );
      }

      const head =
        `${sym} — ${usd(price, dec)}  (${Number(gainBps) >= 0 ? "+" : ""}${pct(gainBps)} from entry)\n` +
        `entry ${usd(basis, dec)}   holding ${amt(remaining)} of ${amt(orig)}\n` +
        `rungs fired: ${rungsFired}   trail: ${
          trailArmed
            ? `ARMED — exits on ${pct(trailBps)} off peak (peak ${usd(peak, dec)})`
            : `asleep until ${pct(trailArmBps)}`
        }\n`;

      if (reason === 0) {
        return text(`${head}\n→ NONE. No exit triggered. Hold.`);
      }

      const verb =
        reason === 1
          ? `RUNG — a ladder step was reached.`
          : `TRAIL — the trailing stop fired. Exit everything remaining.`;

      return text(
        `${head}\n→ ${REASON[reason]}. ${verb}\n\n` +
          `SELL ${amt(units)} ${sym} at ~${usd(price, dec)}\n\n` +
          `This is a signal, not a transaction. Execute it yourself, on whatever venue you like — ` +
          `Crusel holds no funds and cannot trade for you.\n\n` +
          `To make it count toward Crusel's public record, poke it onchain (anyone can: fire(user, token) on ` +
          `${BRAIN}), then report your fill with crusel_acknowledge.`,
      );
    },
  );

  mcp.tool(
    "crusel_calls",
    "Read Crusel's public record — every exit it has called, and whether anyone acted on it. Calls that nobody took stay in the record permanently. Omit `user` to see all calls; pass one to filter.",
    {
      user: z
        .string()
        .optional()
        .describe("Optional: only show calls made for this address"),
      limit: z
        .number()
        .optional()
        .describe("How many of the most recent calls to return (default 20)"),
    },
    async ({ user, limit }) => {
      const cap = limit ?? 20;

      const total = (await client.readContract({
        address: RECORD as `0x${string}`,
        abi: recordAbi,
        functionName: "totalCalls",
      })) as bigint;

      if (total === 0n) {
        return text("Crusel has not made any calls yet.");
      }

      // gather ids, newest first
      let ids: number[] = [];
      if (user) {
        const n = (await client.readContract({
          address: RECORD as `0x${string}`,
          abi: recordAbi,
          functionName: "callCountOf",
          args: [user as `0x${string}`],
        })) as bigint;

        for (let i = Number(n) - 1; i >= 0 && ids.length < cap; i--) {
          const id = (await client.readContract({
            address: RECORD as `0x${string}`,
            abi: recordAbi,
            functionName: "callsOfUser",
            args: [user as `0x${string}`, BigInt(i)],
          })) as bigint;
          ids.push(Number(id));
        }
      } else {
        for (let i = Number(total) - 1; i >= 0 && ids.length < cap; i--) {
          ids.push(i);
        }
      }

      if (ids.length === 0) {
        return text(`No calls on record for ${user}.`);
      }

      const rows: string[] = [];
      for (const id of ids) {
        const c = (await client.readContract({
          address: RECORD as `0x${string}`,
          abi: recordAbi,
          functionName: "getCall",
          args: [BigInt(id)],
        })) as readonly [
          bigint, `0x${string}`, `0x${string}`, bigint, bigint,
          bigint, string, bigint, `0x${string}`, `0x${string}`, number,
        ];

        const [nonce, forUser, token, units, trigger, gainBps, reason, calledAt, by, , status] = c;

        const dec = await feedDecimals(token);
        const sym = SYMBOL_OF[token.toLowerCase()] ?? token.slice(0, 8);
        const when = new Date(Number(calledAt) * 1000).toISOString().slice(0, 16).replace("T", " ");
        const state = status === 0 ? "OPEN — nobody acted" : `taken by ${by.slice(0, 8)}…`;

        rows.push(
          `#${String(nonce).padStart(3, "0")}  ${sym.padEnd(4)} ${reason.padEnd(6)} +${pct(gainBps).padStart(7)}  ` +
            `sell ${amt(units)} @ ${usd(trigger, dec).padStart(12)}  ${when}  ${state}` +
            (user ? "" : `\n      for ${forUser}`),
        );
      }

      const [made, taken, rate] = (await Promise.all([
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "callCount" }),
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "executedCount" }),
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "executionRateBps" }),
      ])) as [bigint, bigint, bigint];

      return text(
        `${rows.join("\n")}\n\n` +
          `${made} calls made · ${taken} acted on · ${pct(rate)} execution rate\n` +
          `Verify: ${RECORD} on ${xlayer.name} (chain ${xlayer.id})`,
      );
    },
  );

  mcp.tool(
    "crusel_execution_rate",
    "Crusel's reputation. How many of its calls did somebody actually act on? A log of one's own predictions proves nothing — this counts external follow-through, computed onchain from a record that cannot be edited after the fact.",
    {},
    async () => {
      const [made, taken, rate] = (await Promise.all([
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "callCount" }),
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "executedCount" }),
        client.readContract({ address: RECORD as `0x${string}`, abi: recordAbi, functionName: "executionRateBps" }),
      ])) as [bigint, bigint, bigint];

      const users = (await client.readContract({
        address: BRAIN as `0x${string}`,
        abi: brainAbi,
        functionName: "userCount",
      })) as bigint;

      return text(
        `Crusel — execution rate ${pct(rate)}\n\n` +
          `calls made      ${made}\n` +
          `acted on        ${taken}\n` +
          `left open       ${made - taken}\n` +
          `positions watched ${users}\n\n` +
          `Calls nobody took remain in the record permanently. Crusel does not hide them.\n` +
          `Record: ${RECORD} · ${xlayer.name} ${xlayer.id}`,
      );
    },
  );

  // ─────────────────────────────────────────────────────────
  // WRITES — Crusel returns calldata. It never holds a key.
  // ─────────────────────────────────────────────────────────

  mcp.tool(
    "crusel_open_position",
    "Register a position for Crusel to watch, and define how to scale out of it. " +
      "Returns an unsigned transaction — YOU sign and broadcast it, so the position is registered to YOUR address. " +
      "Crusel never takes custody and never holds a key.\n\n" +
      "The ladder: each rung is a gain threshold and how much of the ORIGINAL position to sell there. " +
      "A rung fires once and is spent forever — price falling back through it does nothing. " +
      "The trailing stop stays asleep until `trail_arms_at_pct` gain, then exits everything on a `trail_giveback_pct` drop from peak.",
    {
      token: z.string().describe("Asset symbol (BTC, ETH) or token address"),
      entry_price_usd: z
        .number()
        .describe("What you paid per unit, in USD. e.g. 50000 for BTC at $50k"),
      amount: z
        .number()
        .describe("How much you hold. e.g. 2 for 2 BTC"),
      ladder: z
        .array(
          z.object({
            at_gain_pct: z
              .number()
              .describe("Fire this rung at this % gain from entry. e.g. 20"),
            sell_pct: z
              .number()
              .describe(
                "Sell this % of the ORIGINAL position. All rungs must sum to <= 100.",
              ),
          }),
        )
        .describe(
          "Your exit ladder, ascending by gain. e.g. [{at_gain_pct:20,sell_pct:25},{at_gain_pct:50,sell_pct:25},{at_gain_pct:100,sell_pct:50}]",
        ),
      trail_arms_at_pct: z
        .number()
        .describe(
          "Trailing stop stays dormant until gain reaches this. e.g. 100 means it does nothing until you are up 100%. Set 0 to arm immediately.",
        ),
      trail_giveback_pct: z
        .number()
        .describe(
          "Once armed, exit everything if price falls this % from its peak. e.g. 30",
        ),
    },
    async ({ token, entry_price_usd, amount, ladder, trail_arms_at_pct, trail_giveback_pct }) => {
      const t = resolveToken(token);
      const sym = SYMBOL_OF[t.toLowerCase()] ?? t;
      const dec = await feedDecimals(t);

      if (ladder.length === 0) throw new Error("Ladder needs at least one rung.");

      const sorted = [...ladder].sort((a, b) => a.at_gain_pct - b.at_gain_pct);
      const totalSell = sorted.reduce((s, r) => s + r.sell_pct, 0);
      if (totalSell > 100) {
        throw new Error(
          `Ladder sells ${totalSell}% of the position — more than you hold. Rungs sell a share of the ORIGINAL amount, so they must sum to 100 or less.`,
        );
      }

      const rungs = sorted.map(
        (r) =>
          [
            BigInt(Math.round(r.at_gain_pct * 100)),
            BigInt(Math.round(r.sell_pct * 100)),
          ] as readonly [bigint, bigint],
      );

      const data = encodeFunctionData({
        abi: brainAbi,
        functionName: "openPosition",
        args: [
          t,
          toPriceScaled(entry_price_usd, dec),
          toUnits18(amount),
          BigInt(Math.round(trail_arms_at_pct * 100)),
          BigInt(Math.round(trail_giveback_pct * 100)),
          rungs,
        ],
      });

      const plan = sorted
        .map(
          (r) =>
            `  +${r.at_gain_pct}%  →  sell ${r.sell_pct}%  (${((amount * r.sell_pct) / 100).toFixed(4)} ${sym} at ~$${(
              entry_price_usd *
              (1 + r.at_gain_pct / 100)
            ).toLocaleString()})`,
        )
        .join("\n");

      const armPrice = entry_price_usd * (1 + trail_arms_at_pct / 100);

      return text(
        `Position plan — ${amount} ${sym} bought at $${entry_price_usd.toLocaleString()}\n\n` +
          `LADDER (each rung fires once, then is spent forever)\n${plan}\n` +
          `  ${totalSell < 100 ? `\n  ${100 - totalSell}% left unladdered — the trail will take it.` : ""}\n\n` +
          `TRAILING STOP\n` +
          `  asleep until +${trail_arms_at_pct}% ($${armPrice.toLocaleString()})\n` +
          `  then exits everything on a ${trail_giveback_pct}% drop from peak\n\n` +
          `─────────────────────────────────────\n` +
          `Sign and broadcast this to register it. The position will belong to whichever address signs.\n\n` +
          `chainId: ${xlayer.id} (${xlayer.name})\n` +
          `to:      ${BRAIN}\n` +
          `value:   0\n` +
          `data:    ${data}\n\n` +
          `Then poll crusel_check(your_address, "${sym}") for exit signals.`,
      );
    },
  );

  mcp.tool(
    "crusel_acknowledge",
    "Report that you acted on one of Crusel's calls. Returns an unsigned transaction. " +
      "This is what builds Crusel's public track record — and yours. Attributed, not verified: the contract records who claimed to act, it cannot confirm the swap happened.",
    {
      call_number: z
        .number()
        .describe("The call nonce, from crusel_calls"),
      your_tx_hash: z
        .string()
        .describe("The hash of the swap you executed (0x…)"),
    },
    async ({ call_number, your_tx_hash }) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(your_tx_hash)) {
        throw new Error("your_tx_hash must be a 32-byte hash (0x + 64 hex chars).");
      }

      const data = encodeFunctionData({
        abi: recordAbi,
        functionName: "acknowledge",
        args: [BigInt(call_number), your_tx_hash as `0x${string}`],
      });

      return text(
        `Acknowledging call #${call_number}.\n\n` +
          `Sign and broadcast:\n\n` +
          `chainId: ${xlayer.id} (${xlayer.name})\n` +
          `to:      ${RECORD}\n` +
          `value:   0\n` +
          `data:    ${data}\n\n` +
          `Once mined, the call moves from OPEN to EXECUTED and your address is recorded against it.`,
      );
    },
  );

  return mcp;
}

// ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "crusel", chain: xlayer.id, brain: BRAIN, record: RECORD });
});

app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => transport.close());

    const mcp = server();
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Crusel MCP · :${PORT}/mcp · brain ${BRAIN}`);
});
