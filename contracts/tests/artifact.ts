import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function writeArtifact(name: string, value: Record<string, unknown>) {
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
