const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Wallet, web3 } = require("@coral-xyz/anchor");

function controllerKeypair() {
  const anchorWallet = process.env.ANCHOR_WALLET;
  const configured =
    process.env.DEMO_WALLET_KEYPAIR ||
    (anchorWallet?.trimStart().startsWith("[") ? anchorWallet : null);
  if (!configured) return Wallet.local().payer;
  return keypairFromJson(configured);
}

function keypairFromJson(configured) {
  let bytes = JSON.parse(configured);
  if (typeof bytes === "string") bytes = JSON.parse(bytes);
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

function explorerTransaction(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function explorerAccount(address) {
  const value = address.toBase58 ? address.toBase58() : address;
  return `https://explorer.solana.com/address/${value}?cluster=devnet`;
}

function transactionRef(signature, label = "Confirmed gate transaction") {
  return { label, signature, explorerUrl: explorerTransaction(signature) };
}

function accountRef(address, label = "Gate account") {
  const value = address.toBase58 ? address.toBase58() : address;
  return { label, address: value, explorerUrl: explorerAccount(address) };
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
exports.keypairFromJson = keypairFromJson;
exports.accountRef = accountRef;
exports.explorerAccount = explorerAccount;
exports.explorerTransaction = explorerTransaction;
exports.requiredEnv = requiredEnv;
exports.hasEnumVariant = hasEnumVariant;
exports.transactionRef = transactionRef;
exports.writeArtifact = writeArtifact;
