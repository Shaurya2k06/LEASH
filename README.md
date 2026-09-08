# LEASH

LEASH is a confidential capability and budget kernel for hostile agent swarms.
Private policy and agent-session state run in one MagicBlock PER. Single-use
permits settle through an authenticated Magic Action SPL payment and a public
terminal marker that can be spent or expired exactly once.

See [`docs/leash.md`](./docs/leash.md) for invariants and
[`docs/evidence.md`](./docs/evidence.md) for the gate evidence. See
[`SECURITY.md`](./SECURITY.md) for vulnerability reporting.

## Run the operator view

```sh
cd client && npm run dev
```

The browser view only polls public program health and displays recorded gate
outcomes. It does not fetch private policy/session accounts or sign outcomes.

## Publish a real end-to-end demo tape

The demo runner uses the local Anchor wallet and TEE credentials on the trusted
operator machine. It creates a fresh policy/session, executes one authenticated
SPL settlement, proves privacy and replay rejection, scrubs the private state,
and writes public transaction/account links to `client/public/demo.json`:

```sh
cd contracts
yarn build
yarn demo:leash
cd ../client && npm run lint && npm run build
```

The generated artifact is safe for the browser: it contains no wallet,
authorization token, private amount, or digest. Deploy the client after running
the demo to publish the proof tape.

## Configure and validate

The checked-in examples describe the public configuration. For local use, copy
them into the ignored env files:

```sh
cp .env.example .env
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Live contract gates additionally need your funded devnet wallet:
`ANCHOR_WALLET=/absolute/path/to/your/solana-wallet.json`.

Copy [`client/.env.example`](./client/.env.example) and
[`server/.env.example`](./server/.env.example) when overriding browser or
relay defaults. The relay only forwards read-only RPC methods; set
`ALLOWED_ORIGIN`, `UPSTREAM_TIMEOUT_MS`, and `RELAY_RATE_LIMIT` for a deployed
instance. Never commit the wallet file or TEE token.

Then validate the current slice:

```sh
cd client && npm run lint && npm run build
cd ../server && npm test
cd ../contracts
cargo test -p contracts
yarn typecheck && yarn lint
yarn build
yarn test:leash

# Live devnet gates (after exporting the wallet and endpoints above)
yarn test:leash:per
yarn test:leash:settlement
yarn test:leash:expiry
yarn test:leash:race
BENCHMARK_SAMPLES=100 yarn bench:leash
```

The contracts pin Rust 1.89.0, Solana CLI 3.1.9, and Anchor 1.0.2. The current
devnet binary has passed the sibling-read, settlement, expiry, and twenty-session
race gates. The public client reads the sanitized summary at
`client/public/evidence.json`; it does not claim to execute those TEE gates in
the browser.
The relay only forwards allowlisted read-only JSON-RPC payloads, rate-limits
callers, bounds request and response sizes, checks upstream health, and cannot
sign or choose an outcome. Set `UPSTREAM_RESPONSE_BYTES` as well when deploying
the relay. Passing
gates and benchmarks write JSON artifacts under `contracts/artifacts/`.

[`.env.example`](./.env.example) contains the public contract defaults and
local wallet placeholder. Do not put keypairs or TEE authorization tokens in
git.
