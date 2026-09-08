# LEASH (formerly BLACKOUT)

BLACKOUT's devnet no-reader crank gate failed: a writer excluded from the private permission could update a probe that then appeared on base RPC. The evidence is recorded in [`docs/evidence.md`](./docs/evidence.md); this repository has pivoted to LEASH, a confidential capability and budget kernel for hostile agent swarms.

LEASH keeps private policy and agent-session state in one PER, uses single-use permits, and will settle through an authenticated Magic Action SPL payment with mutually exclusive spent/expired markers. Its concrete invariants are in [`docs/leash.md`](./docs/leash.md).

## Run the preview

```sh
cd client && npm run dev
```

The existing client is a retired BLACKOUT preview and makes no LEASH claim. It will be replaced with the LEASH operator view.

## Validate the current slice

```sh
cd client && npm run lint && npm run build
cd ../server && npm test
cd ../contracts
cargo check
yarn typecheck && yarn lint
PATH="$HOME/.avm/bin:$PATH" yarn build
yarn test:leash
```

The contracts pin Rust 1.89.0 and Anchor 1.0.2. The LEASH devnet privacy gate has not yet been implemented; no privacy claim is made for this new kernel until it is tested against the TEE.

Copy [`.env.example`](./.env.example) into a local ignored `.env` or export its values in your shell. Do not put wallet paths, keypairs, or TEE authorization tokens in git.

The prior BLACKOUT program stays deployed only as a restored probe artifact. Do not use it for gameplay or submission.
