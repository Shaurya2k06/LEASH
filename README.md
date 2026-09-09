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

The browser routes are:

- `/` — public LEASH landing page
- `/dashboard` — operator dashboard with live gates and lifecycle execution
- `/demo` — redirects to `/dashboard#live-demo`

The browser polls public program health. Gate and lifecycle clicks call the
separate demo worker and return only sanitized progress/results; the browser
never receives the wallet, TEE authorization token, or private account state.

## Run the live end-to-end demo

The worker uses the local Anchor wallet and TEE credentials on the trusted
operator machine. It can execute each adversarial gate or create a fresh
policy/session, perform an authenticated SPL settlement, prove privacy and
replay rejection, scrub private state, and stream confirmed lifecycle steps:

```sh
# Terminal 1
cd contracts && yarn demo:server

# Terminal 2
cd client && npm run dev
```

Deploy the worker as a separate Render service with root directory `contracts`,
build command `yarn install --frozen-lockfile`, and start command
`yarn demo:server`. Configure `SOLANA_RPC_URL`, `MB_TEE_RPC_URL`,
`MB_TEE_VALIDATOR`, `LEASH_PROGRAM_ID`, and `ALLOWED_ORIGIN`. Store the 64-byte
wallet JSON only in Render as the secret
`DEMO_WALLET_KEYPAIR`, then set Vercel's `VITE_DEMO_API_URL` to that service.
Never put the wallet value in Vercel.

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
yarn test:demo-server

# Live devnet gates (after exporting the wallet and endpoints above)
yarn test:leash:per
yarn test:leash:settlement
yarn test:leash:expiry
yarn test:leash:race
BENCHMARK_SAMPLES=100 yarn bench:leash
```

The contracts pin Rust 1.89.0, Solana CLI 3.1.9, and Anchor 1.0.2. The current
devnet binary has passed the sibling-read, settlement, expiry, and twenty-session
race gates. The checked-in `client/public/evidence.json` remains historical
audit evidence; dashboard gate buttons execute fresh runs through the worker.
The relay only forwards allowlisted read-only JSON-RPC payloads, rate-limits
callers, bounds request and response sizes, checks upstream health, and cannot
sign or choose an outcome. Set `UPSTREAM_RESPONSE_BYTES` as well when deploying
the relay. Passing
gates and benchmarks write JSON artifacts under `contracts/artifacts/`.

[`.env.example`](./.env.example) contains the public contract defaults and
local wallet placeholder. Do not put keypairs or TEE authorization tokens in
git.

## Whitepaper

# LEASH

LEASH is a confidential capability and budget kernel for hostile agent swarms.
It keeps policy and session state private while exposing only sanitized public
settlement terminals.

## Invariants

- One PER holds private `SecretPolicy` and per-agent `SessionLedger` accounts.
- A policy is allocated empty on Solana, delegated, permissioned on the ER,
  and configured only after it is private. No budget, policy hash, permit, or
  session data is written to a base-layer account.
- A controller can configure its policy. Enrolled agents can issue only their
  own typed permit, and the controller finalizes the authenticated terminal.
  Sibling agents have no permission membership and cannot read each other's
  policy, ledger, or receipt.
- A typed policy binds version, destination program and discriminator, token
  mint, recipient, source vault, per-permit maximum, budget, and expiry. The
  agent signs issuance; forbidden action fields fail before reservation.
- A permit has one monotonically increasing nonce. Reservation is separate
  from settlement, and the bounded terminal history records each spent or
  expired outcome without allowing a nonce replay.
- Payment is a Magic Action after a sanitized commit. The action authenticates
  its escrow signer, transfers SPL funds, creates the terminal marker, and
  marks the receipt spent atomically.
- A failed SPL action leaves the private reservation and pending receipt
  intact. After the source vault is repaired, the receipt is re-delegated and
  its controller permission is recreated before retry; no budget is consumed
  until the action succeeds.
- Expiry refunds the private budget before an authenticated expiry action
  publishes `TerminalKind::Expired`. The receipt state blocks settlement
  before that action completes, so expiry cannot race a later payment.

## Account boundary

| Account | Location | Public data |
| --- | --- | --- |
| `SecretPolicy` | Solana then delegated | controller and PDA metadata only before private configuration |
| `SecretPolicy` | Private PER | policy hash, typed limits, budget, expiry, permit nonce |
| `SessionLedger` | Private PER | agent reservation and spent total |
| `SettlementReceipt` | Solana then delegated | routing metadata, nonce, status; no amount or digest |
| `TerminalMarker` | Solana | permit digest, amount, bounded history, and terminal kind |

An enrolled agent may issue and read its own ledger, while an authenticated
sibling cannot read it or a pending receipt by direct or batch TEE RPC,
subscriptions, transaction messages, writes, delegation, or requested
simulation output. The tested lifecycle scrubs, closes permissions, and
undelegates before verifying that base RPC has no reservation bytes.

## Current demonstrated slice

From `contracts/` with a local wallet path:

```sh
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:per
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:settlement
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:expiry
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:race
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet BENCHMARK_SAMPLES=100 yarn bench:leash
```

These live gates cover sibling-read denial, authenticated SPL payment,
underfunded-action rollback and retry, replay rejection, and expiry/payment
mutual exclusion, plus twenty private-session contention for one remaining
budget. The current deployment is binary
`2925d4fe8d94353489a9f6c3059c5e93b2bc008f03bbae0b6b28214e70ceb0b9` in slot
`495263536`; all four gates passed against it. The operator client polls only
public health and a sanitized evidence manifest; the relay transports
read-only RPC payloads and has no outcome authority. Gate and benchmark runs
write machine-readable JSON under `contracts/artifacts/`. The benchmark also
samples public program-account application health and explicitly does not
claim permit/action latency.
