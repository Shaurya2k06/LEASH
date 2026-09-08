import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import {
  getAuthToken,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
const samples = Number(process.env.BENCHMARK_SAMPLES || 100);
const programId = new web3.PublicKey(requiredEnv("LEASH_PROGRAM_ID"));

function percentile(values: number[], percentage: number) {
  const rank = Math.max(0, Math.ceil((percentage / 100) * values.length) - 1);
  return Number(values[rank].toFixed(2));
}

async function measure(
  connection: web3.Connection,
  operation: (connection: web3.Connection) => Promise<unknown>
) {
  const values: number[] = [];
  let failures = 0;
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    try {
      await operation(connection);
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
  const transport = (connection: web3.Connection) =>
    connection.getSlot("confirmed");
  const application = (connection: web3.Connection) =>
    connection.getAccountInfo(programId, "confirmed");
  const report = {
    sampleTarget: samples,
    timestampSource: "client performance.now",
    applicationProbe: "getAccountInfo(programId, confirmed)",
    actionLatencyMeasured: false,
    base: {
      endpoint: baseEndpoint,
      transport: await measure(base, transport),
      application: await measure(base, application),
    },
    tee: {
      endpoint: teeEndpoint,
      transport: await measure(tee, transport),
      application: await measure(tee, application),
    },
  };
  const directory = resolve(process.env.LEASH_ARTIFACT_DIR || "artifacts");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "leash-benchmark.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
