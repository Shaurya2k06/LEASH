# LEASH (formerly BLACKOUT)

BLACKOUT's devnet no-reader crank gate failed: a writer excluded from the private permission could update a probe that then appeared on base RPC. The evidence is recorded in [`docs/evidence.md`](./docs/evidence.md); this repository has pivoted to LEASH, a confidential capability and budget kernel for hostile agent swarms.

LEASH keeps private policy and agent-session state in one PER, uses single-use permits, and will settle through an authenticated Magic Action SPL payment with mutually exclusive spent/expired markers. Its concrete invariants are in [`docs/leash.md`](./docs/leash.md).

## Run the operator view

```sh
cd client && npm run dev
```

The browser view only polls public program health and displays recorded gate
outcomes. It does not fetch private policy/session accounts or sign outcomes.

## Validate the current slice

```sh
cd client && npm run lint && npm run build
cd ../server && npm test
cd ../contracts
cargo test -p contracts
yarn typecheck && yarn lint
PATH="$HOME/.avm/bin:$PATH" yarn build
yarn test:leash

# Live devnet gates (replace the wallet path with your local wallet)
ANCHOR_WALLET=/path/to/wallet.json \
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:per
ANCHOR_WALLET=/path/to/wallet.json \
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:settlement
ANCHOR_WALLET=/path/to/wallet.json \
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:expiry
ANCHOR_WALLET=/path/to/wallet.json \
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:race
ANCHOR_WALLET=/path/to/wallet.json \
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet BENCHMARK_SAMPLES=100 yarn bench:leash
```

The contracts pin Rust 1.89.0 and Anchor 1.0.2. The sibling-read privacy gate,
authenticated SPL settlement gate, failed-payment retry, and expiry terminal
gate, and twenty-agent budget race pass against the deployed devnet TEE binary.
The relay only forwards allowlisted JSON-RPC payloads; it cannot sign or choose
an outcome.

Copy [`.env.example`](./.env.example) into a local ignored `.env` or export its values in your shell. Do not put wallet paths, keypairs, or TEE authorization tokens in git.

The prior BLACKOUT program stays deployed only as a restored probe artifact. Do not use it for gameplay or submission.
