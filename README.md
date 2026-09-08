# LEASH

LEASH is a confidential capability and budget kernel for hostile agent swarms.
Private policy and agent-session state run in one MagicBlock PER. Single-use
permits settle through an authenticated Magic Action SPL payment and a public
terminal marker that can be spent or expired exactly once.

See [`docs/leash.md`](./docs/leash.md) for invariants and
[`docs/evidence.md`](./docs/evidence.md) for the deployed gate results.

## Run the operator view

```sh
cd client && npm run dev
```

The browser view only polls public program health and displays recorded gate
outcomes. It does not fetch private policy/session accounts or sign outcomes.

## Configure and validate

The client and relay run with public defaults. Live contract gates additionally
need your local funded devnet wallet:

```sh
export ANCHOR_WALLET=/absolute/path/to/your/solana-wallet.json
export SOLANA_RPC_URL=https://rpc.magicblock.app/devnet
export MB_TEE_RPC_URL=https://devnet-tee.magicblock.app
```

Copy [`client/.env.example`](./client/.env.example) and
[`server/.env.example`](./server/.env.example) when overriding browser or
relay defaults. Never commit the wallet file or TEE token.

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

The contracts pin Rust 1.89.0 and Anchor 1.0.2. The sibling-read gate,
authenticated SPL settlement gate, failed-payment retry, expiry terminal gate,
and twenty-session budget race pass against the deployed devnet TEE binary.
The relay only forwards allowlisted JSON-RPC payloads; it cannot sign or choose
an outcome.

[`.env.example`](./.env.example) contains the public contract defaults and
local wallet placeholder. Do not put keypairs or TEE authorization tokens in
git.
