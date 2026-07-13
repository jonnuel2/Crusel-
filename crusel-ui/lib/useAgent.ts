"use client";

import { useEffect, useState, useCallback } from "react";
import {
  client,
  BRAIN,
  RECORD,
  TOKENS,
  brainAbi,
  recordAbi,
  type Call,
  type Position,
  type Rung,
} from "./chain";

export type TokenState = {
  symbol: string;
  address: `0x${string}`;
  price: bigint;
  gainBps: bigint;
  reason: number;
  position: Position | null;
  ladder: Rung[];
};

export type AgentState = {
  tokens: TokenState[];
  calls: Call[];
  callCount: number;
  executedCount: number;
  rateBps: number;
  loading: boolean;
  error: string | null;
};

const EMPTY: AgentState = {
  tokens: [],
  calls: [],
  callCount: 0,
  executedCount: 0,
  rateBps: 0,
  loading: true,
  error: null,
};

export function useAgent(pollMs = 12000): AgentState {
  const [state, setState] = useState<AgentState>(EMPTY);

  const load = useCallback(async () => {
    try {
      // --- per-token state ---
      const tokens: TokenState[] = await Promise.all(
        TOKENS.map(async (t) => {
          const [check, pos, ladLen] = await Promise.all([
            client.readContract({
              address: BRAIN,
              abi: brainAbi,
              functionName: "check",
              args: [t.address],
            }) as Promise<readonly [number, bigint, bigint, bigint]>,
            client.readContract({
              address: BRAIN,
              abi: brainAbi,
              functionName: "positions",
              args: [t.address],
            }) as Promise<
              readonly [
                `0x${string}`,
                bigint,
                bigint,
                bigint,
                bigint,
                bigint,
                bigint,
                bigint,
                boolean,
                boolean,
              ]
            >,
            client.readContract({
              address: BRAIN,
              abi: brainAbi,
              functionName: "ladderLength",
              args: [t.address],
            }) as Promise<bigint>,
          ]);

          const ladder: Rung[] = await Promise.all(
            Array.from({ length: Number(ladLen) }, (_, i) =>
              client
                .readContract({
                  address: BRAIN,
                  abi: brainAbi,
                  functionName: "getRung",
                  args: [t.address, BigInt(i)],
                })
                .then((r) => {
                  const [gainBps, sellBps] = r as readonly [bigint, bigint];
                  return { gainBps, sellBps };
                }),
            ),
          );

          const [reason, , gainBps, price] = check;

          return {
            symbol: t.symbol,
            address: t.address,
            price,
            gainBps,
            reason,
            position: {
              feed: pos[0],
              basisPerUnit: pos[1],
              originalUnits: pos[2],
              remainingUnits: pos[3],
              peakPrice: pos[4],
              trailArmBps: pos[5],
              trailBps: pos[6],
              rungsFired: pos[7],
              trailArmed: pos[8],
              active: pos[9],
            },
            ladder,
          };
        }),
      );

      // --- record ---
      const [total, executed, rate] = (await Promise.all([
        client.readContract({ address: RECORD, abi: recordAbi, functionName: "callCount" }),
        client.readContract({ address: RECORD, abi: recordAbi, functionName: "executedCount" }),
        client.readContract({ address: RECORD, abi: recordAbi, functionName: "executionRateBps" }),
      ])) as [bigint, bigint, bigint];

      const n = Number(total);
      const calls: Call[] = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          client
            .readContract({
              address: RECORD,
              abi: recordAbi,
              functionName: "getCall",
              args: [BigInt(i)],
            })
            .then((r) => {
              const c = r as readonly [
                bigint,
                `0x${string}`,
                bigint,
                bigint,
                bigint,
                string,
                bigint,
                `0x${string}`,
                `0x${string}`,
                number,
              ];
              return {
                id: i,
                nonce: c[0],
                token: c[1],
                units: c[2],
                triggerPrice: c[3],
                gainBps: c[4],
                reason: c[5],
                calledAt: c[6],
                executedBy: c[7],
                txHash: c[8],
                status: c[9],
              } as Call;
            }),
        ),
      );

      setState({
        tokens,
        calls: calls.reverse(),
        callCount: Number(total),
        executedCount: Number(executed),
        rateBps: Number(rate),
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Could not reach X Layer",
      }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return state;
}
