const assert = require("node:assert/strict");
const test = require("node:test");

const { createDemoServer, parseDemoEvent } = require("./leash-demo-server");
const {
  accountRef,
  hasEnumVariant,
  transactionRef,
} = require("../tests/artifact");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

test("parses runner progress events", () => {
  assert.deepEqual(
    parseDemoEvent('LEASH_DEMO_EVENT {"type":"step","step":{"id":"one"}}'),
    { type: "step", step: { id: "one" } }
  );
  assert.equal(parseDemoEvent("ordinary log line"), null);
});

test("matches Anchor enum variants regardless of IDL casing", () => {
  assert.equal(hasEnumVariant({ Spent: {} }, "spent"), true);
  assert.equal(hasEnumVariant({ spent: {} }, "spent"), true);
  assert.equal(hasEnumVariant({ Open: {} }, "spent"), false);
});

test("creates public Explorer references for gate evidence", () => {
  assert.deepEqual(transactionRef("signature"), {
    label: "Confirmed gate transaction",
    signature: "signature",
    explorerUrl: "https://explorer.solana.com/tx/signature?cluster=devnet",
  });
  assert.equal(
    accountRef("address").explorerUrl,
    "https://explorer.solana.com/address/address?cluster=devnet"
  );
});

test("starts a real gate through the worker endpoint", async (t) => {
  const artifact = { status: "passed", generatedAt: "now" };
  const server = createDemoServer({
    configured: true,
    cooldownMs: 0,
    runGate: async ({ gate }) => ({ ...artifact, gate }),
  });
  const url = await listen(server);
  t.after(() => close(server));

  const started = await fetch(`${url}/gates/privacy`, { method: "POST" });
  assert.equal(started.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  const gates = await (await fetch(`${url}/gates`)).json();
  assert.deepEqual(gates.privacy, { ...artifact, gate: "privacy" });
});

test("starts a live run and publishes confirmed steps", async (t) => {
  const step = { id: "create-policy", status: "confirmed" };
  const server = createDemoServer({
    configured: true,
    cooldownMs: 0,
    runDemo: async ({ onEvent }) => {
      onEvent({ type: "started", network: "solana-devnet" });
      await new Promise((resolve) => setImmediate(resolve));
      onEvent({ type: "step", step });
      return { status: "passed", network: "solana-devnet", steps: [step] };
    },
  });
  const url = await listen(server);
  t.after(() => close(server));

  const started = await fetch(`${url}/demo`, { method: "POST" });
  assert.equal(started.status, 202);
  assert.equal((await started.json()).status, "running");

  let state;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    state = await fetch(`${url}/demo`).then((response) => response.json());
    if (state.status === "passed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(state.status, "passed");
  assert.deepEqual(state.steps, [step]);
});
