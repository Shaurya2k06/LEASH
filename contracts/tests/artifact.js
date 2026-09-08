const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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

exports.requiredEnv = requiredEnv;
exports.writeArtifact = writeArtifact;
