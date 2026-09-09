const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Wallet, web3 } = require("@coral-xyz/anchor");

function controllerKeypair() {
  const configured = process.env.DEMO_WALLET_KEYPAIR;
  if (!configured) return Wallet.local().payer;
  const bytes = JSON.parse(configured);
  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    bytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  )
    throw new Error("DEMO_WALLET_KEYPAIR must be a 64-byte JSON array");
  return web3.Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function hasEnumVariant(value, name) {
  return Object.keys(value || {}).some(
    (key) => key.toLowerCase() === name.toLowerCase()
  );
}

function writeArtifact(name, value) {
  const directory = resolve(process.env.LEASH_ARTIFACT_DIR || "artifacts");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, name),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), ...value },
      null,
      2
    ) + "\n"
  );
}

exports.controllerKeypair = controllerKeypair;
exports.requiredEnv = requiredEnv;
exports.hasEnumVariant = hasEnumVariant;
exports.writeArtifact = writeArtifact;
