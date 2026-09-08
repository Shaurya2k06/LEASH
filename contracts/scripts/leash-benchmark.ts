import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import {
  getAuthToken,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import { performance } from "node:perf_hooks";

const baseEndpoint =
  process.env.SOLANA_RPC_URL || "https://rpc.magicblock.app/devnet";
const teeEndpoint = (
  process.env.MB_TEE_RPC_URL || "https://devnet-tee.magicblock.app"
).replace(/\/$/, "");
const samples = Number(process.env.BENCHMARK_SAMPLES || 100);

function percentile(values: number[], percentage: number) {
  const rank = Math.max(0, Math.ceil((percentage / 100) * values.length) - 1);
  return Number(values[rank].toFixed(2));
}

async function measure(connection: web3.Connection) {
  const values: number[] = [];
  let failures = 0;
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    try {
      await connection.getSlot("confirmed");
      values.push(performance.now() - started);
    } catch (_) {
      failures += 1;
    }
  }
  values.sort((left, right) => left - right);
  if (values.length === 0) throw new Error("all benchmark samples failed");
  return {
    n: values.length,
    failures,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
    minMs: Number(values[0].toFixed(2)),
    maxMs: Number(values[values.length - 1].toFixed(2)),
  };
}

async function main() {
  if (!Number.isInteger(samples) || samples < 1)
    throw new Error("BENCHMARK_SAMPLES must be a positive integer");
  const controller = anchor.Wallet.local().payer;
  await verifyTeeRpcIntegrity(teeEndpoint);
  const auth = await getAuthToken(
    teeEndpoint,
    controller.publicKey,
    (message) =>
      Promise.resolve(nacl.sign.detached(message, controller.secretKey))
  );
  const base = new web3.Connection(baseEndpoint, { commitment: "confirmed" });
  const tee = new web3.Connection(
    `${teeEndpoint}?token=${encodeURIComponent(auth.token)}`,
    { commitment: "confirmed" }
  );
  console.log(
    JSON.stringify(
      {
        sampleTarget: samples,
        method: "getSlot(confirmed)",
        timestampSource: "client performance.now",
        base: { endpoint: baseEndpoint, ...(await measure(base)) },
        tee: { endpoint: teeEndpoint, ...(await measure(tee)) },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
