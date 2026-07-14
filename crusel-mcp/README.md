# Crusel MCP

MCP server for Crusel — a profit-taking agent on X Layer that calls exits and keeps a public record of every call, including the ones nobody took.

## Run

```bash
npm install
npm run build
npm start
```

Serves MCP at `http://localhost:3001/mcp`, health at `/health`.

## Tools

**Reads** — free, no gas, no wallet needed.

| Tool | What it does |
|---|---|
| `crusel_supported_tokens` | Which assets Crusel watches, and their live price |
| `crusel_check` | Is an exit triggered right now? NONE / RUNG / TRAIL |
| `crusel_calls` | The public record — every call, and whether anyone took it |
| `crusel_execution_rate` | Crusel's reputation: how many of its calls got acted on |

**Writes** — return unsigned calldata. **Crusel never holds a key.**

| Tool | What it does |
|---|---|
| `crusel_open_position` | Register your position and your exit ladder |
| `crusel_acknowledge` | Report that you acted on a call |

You sign and broadcast. The position registers to *your* address, so `msg.sender` is you — not Crusel.

## The trust boundary

Crusel does not custody funds and does not execute trades. It reads an oracle, applies your ladder, and emits a signal. Everything else is yours.

That means it also cannot verify your fills. `crusel_acknowledge` records **who claimed to act** — attributed, not proven. This is stated in the schema, not buried in a disclaimer.

## Networks

Set `NETWORK` in the env (default `testnet`). It selects the RPC and the token
set; `BRAIN`/`RECORD` are overridable per-network.

**testnet** (chain 1952) — mock feeds you can drive for a demo. Watches `BTC`, `ETH`.

- BRAIN `0x1D8B77A44Edac389721dE0769f8f55A565cF0526`
- RECORD `0xF1766Fa22F203AE07CaFE643CA9e742ffBc9AC8b`

**mainnet** (chain 196) — X Layer's real price feeds. Watches `WBTC`, `WETH`,
`WOKB`, `USDT`, `USDC`, `DAI`. Deploy with `script/DeployMainnet.s.sol`, then set
`NETWORK=mainnet`, `BRAIN`, and `RECORD`.

Feed decimals differ per asset (WBTC/WETH/OKB report 2, USDC 4, mock 8). The
server reads each feed's `decimals()` and scales accordingly — no assumption baked in.
