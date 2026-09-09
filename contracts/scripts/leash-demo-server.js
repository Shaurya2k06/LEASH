const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdtemp, readFile, rm, unlink } = require("node:fs/promises");
const { createServer } = require("node:http");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { createInterface } = require("node:readline");

const EVENT_PREFIX = "LEASH_DEMO_EVENT ";
const REQUIRED_ENV = [
  "SOLANA_RPC_URL",
  "MB_TEE_RPC_URL",
  "MB_TEE_VALIDATOR",
  "LEASH_PROGRAM_ID",
];
const GATES = {
  privacy: ["LEASH_PER_TEST", "leash-per-gate.ts", "leash-per-gate.json"],
  settlement: [
    "LEASH_SETTLEMENT_TEST",
    "leash-settlement-gate.ts",
    "leash-settlement-gate.json",
  ],
  expiry: [
    "LEASH_EXPIRY_TEST",
    "leash-expiry-gate.ts",
    "leash-expiry-gate.json",
  ],
  race: ["LEASH_RACE_TEST", "leash-race-gate.ts", "leash-race-gate.json"],
};

function parseDemoEvent(line) {
  if (!line.startsWith(EVENT_PREFIX)) return null;
  return JSON.parse(line.slice(EVENT_PREFIX.length));
}

function runnerFailure(stderr) {
  if (
    /DEMO_WALLET_KEYPAIR|Unexpected token|JSON|ENOENT|ENAMETOOLONG|secret key/i.test(
      stderr
    )
  )
    return "Demo wallet configuration is invalid; set DEMO_WALLET_KEYPAIR to the 64-byte JSON array.";
  if (/Invalid public key input/.test(stderr))
    return "Demo public-key configuration is invalid.";
  if (/LEASH_PROGRAM_ID does not match/.test(stderr))
    return "Demo program configuration does not match the checked-in IDL.";
  if (/Cannot find module|MODULE_NOT_FOUND/.test(stderr))
    return "Demo runtime dependencies are unavailable.";
  if (/Failed to find IDL|anchor build/.test(stderr))
    return "Demo program IDL is unavailable.";
  return "Demo runner exited before completion. Check worker logs.";
}

function isConfigured() {
  return (
    REQUIRED_ENV.every((name) => process.env[name]) &&
    Boolean(process.env.ANCHOR_WALLET || process.env.DEMO_WALLET_KEYPAIR)
  );
}

function launchDemo({ runId, onEvent }) {
  const contractsDirectory = resolve(__dirname, "..");
  const output = join(tmpdir(), `leash-demo-${runId}.json`);
  const tsNode = join(contractsDirectory, "node_modules/ts-node/dist/bin.js");
  const script = join(contractsDirectory, "scripts/leash-demo.ts");

  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [tsNode, "--transpile-only", script],
      {
        cwd: contractsDirectory,
        env: { ...process.env, LEASH_DEMO_OUTPUT: output },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stderr = "";
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const event = parseDemoEvent(line);
        if (event) onEvent(event);
      } catch (error) {
        console.error("Invalid demo progress event", error);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });
    child.once("error", reject);
    child.once("close", async (code) => {
      try {
        const artifact = JSON.parse(await readFile(output, "utf8"));
        if (code !== 0 && artifact.status !== "failed")
          throw new Error(`Demo runner exited with code ${code}`);
        resolvePromise(artifact);
      } catch (error) {
        console.error("Demo runner failed", stderr || error);
        reject(new Error(runnerFailure(stderr)));
      } finally {
        unlink(output).catch(() => {});
      }
    });
  });
}

async function launchGate({ gate }) {
  const contractsDirectory = resolve(__dirname, "..");
  const [flag, script, artifact] = GATES[gate];
  const outputDirectory = await mkdtemp(join(tmpdir(), `leash-${gate}-`));
  const mocha = join(contractsDirectory, "node_modules/ts-mocha/bin/ts-mocha");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        mocha,
        "--exit",
        "-p",
        "tsconfig.json",
        "-t",
        "1000000",
        `tests/${script}`,
      ],
      {
        cwd: contractsDirectory,
        env: {
          ...process.env,
          [flag]: "1",
          LEASH_ARTIFACT_DIR: outputDirectory,
        },
        stdio: ["ignore", "ignore", "pipe"],
      }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });
    child.once("error", reject);
    child.once("close", async (code) => {
      try {
        if (code !== 0)
          throw new Error(stderr || `${gate} gate exited with code ${code}`);
        resolvePromise(
          JSON.parse(await readFile(join(outputDirectory, artifact), "utf8"))
        );
      } catch (error) {
        reject(error);
      } finally {
        rm(outputDirectory, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
}

function createDemoServer(options = {}) {
  const allowedOrigin =
    options.allowedOrigin ||
    process.env.ALLOWED_ORIGIN ||
    "http://localhost:5173";
  const configured = options.configured ?? isConfigured();
  const runDemo = options.runDemo || launchDemo;
  const runGate = options.runGate || launchGate;
  let demoState = { status: "idle", steps: [] };
  let gateStates = Object.fromEntries(
    Object.keys(GATES).map((gate) => [gate, { status: "idle" }])
  );
  // ponytail: one in-memory job is enough for one Render instance; use shared state when horizontally scaling.
  let activeJob = false;

  return createServer((request, response) => {
    response.setHeader("access-control-allow-origin", allowedOrigin);
    response.setHeader("vary", "origin");
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "application/json; charset=utf-8");

    if (request.headers.origin && request.headers.origin !== allowedOrigin) {
      response.writeHead(403).end(JSON.stringify({ error: "Origin denied." }));
      return;
    }
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.writeHead(204).end();
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response.end(
        JSON.stringify({
          service: "leash-demo-worker",
          status: configured ? "ok" : "configuration-required",
          configured,
          running: activeJob,
        })
      );
      return;
    }
    if (request.method === "GET" && request.url === "/gates") {
      response.end(JSON.stringify(gateStates));
      return;
    }
    const gateMatch = request.url.match(
      /^\/gates\/(privacy|settlement|expiry|race)$/
    );
    if (request.method === "POST" && gateMatch) {
      const gate = gateMatch[1];
      if (!configured) {
        response
          .writeHead(503)
          .end(JSON.stringify({ error: "Demo worker is not configured." }));
        return;
      }
      if (activeJob) {
        response
          .writeHead(409)
          .end(JSON.stringify({ error: "Another live job is running." }));
        return;
      }
      activeJob = true;
      gateStates = {
        ...gateStates,
        [gate]: { status: "running", startedAt: new Date().toISOString() },
      };
      response.writeHead(202).end(JSON.stringify(gateStates[gate]));
      runGate({ gate })
        .then((artifact) => {
          gateStates = { ...gateStates, [gate]: artifact };
        })
        .catch((error) => {
          console.error(`${gate} gate failed`, error);
          gateStates = {
            ...gateStates,
            [gate]: {
              status: "failed",
              finishedAt: new Date().toISOString(),
              error: `${gate} gate failed. Check worker logs.`,
            },
          };
        })
        .finally(() => {
          activeJob = false;
        });
      return;
    }
    if (request.method === "GET" && request.url === "/demo") {
      response.end(JSON.stringify(demoState));
      return;
    }
    if (request.method !== "POST" || request.url !== "/demo") {
      response.writeHead(404).end(JSON.stringify({ error: "Not found." }));
      return;
    }
    if (!configured) {
      response
        .writeHead(503)
        .end(JSON.stringify({ error: "Demo worker is not configured." }));
      return;
    }
    if (activeJob) {
      response.writeHead(409).end(JSON.stringify(demoState));
      return;
    }
    const runId = randomUUID();
    const startedAt = Date.now();
    demoState = {
      runId,
      status: "running",
      startedAt: new Date(startedAt).toISOString(),
      steps: [],
    };
    activeJob = true;
    response.writeHead(202).end(JSON.stringify(demoState));

    runDemo({
      runId,
      onEvent(event) {
        if (demoState.runId !== runId) return;
        if (event.type === "started") {
          const { type: _type, ...metadata } = event;
          demoState = { ...demoState, ...metadata };
        } else if (event.type === "startup") {
          demoState = { ...demoState, startupStage: event.stage };
        } else if (event.type === "step") {
          demoState = {
            ...demoState,
            steps: [...demoState.steps, event.step],
            updatedAt: new Date().toISOString(),
          };
        }
      },
    })
      .then((artifact) => {
        if (demoState.runId === runId) {
          demoState = { ...demoState, ...artifact, runId };
        }
      })
      .catch((error) => {
        if (demoState.runId === runId) {
          demoState = {
            ...demoState,
            status: "failed",
            finishedAt: new Date().toISOString(),
            error: error.message,
          };
        }
      })
      .finally(() => {
        activeJob = false;
      });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8790);
  createDemoServer().listen(port, () => {
    console.log(`LEASH demo worker listening on http://localhost:${port}`);
  });
}

module.exports = { createDemoServer, parseDemoEvent, runnerFailure };
