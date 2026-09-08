# BLACKOUT

BLACKOUT is a four-player stealth arena designed for authoritative execution inside a MagicBlock Private Ephemeral Rollup. The client is still a local preview; the contracts include the Phase 1 private-state probe, opt-in no-reader gate, and the bounded Phase 2 account model.

## Run the preview

```sh
cd client && npm run dev
```

The preview contains the arena shell, roster/visibility states, tick control, and simulated attack-console interactions. It does not claim a live PER connection.

## Validate the current slice

```sh
cd client && npm run lint && npm run build
cd ../server && npm test
cd ../contracts
cargo check
yarn typecheck && yarn lint
PATH="$HOME/.avm/bin:$PATH" yarn build
yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/per-gate.ts
```

The contracts pin Rust 1.89.0 and Anchor 1.0.2. The dry gate is skipped by default. After configuring a funded wallet and the required TEE endpoint, run `PATH="$HOME/.avm/bin:$PATH" yarn test:per` to execute the real devnet gate. It checks authorized TEE reads, base-layer raw reads, unauthenticated TEE reads, and wrong-wallet TEE reads, then scrubs and undelegates the probe.

Copy [`.env.example`](./.env.example) into a local ignored `.env` or export its values in your shell. Do not put wallet paths, keypairs, or TEE authorization tokens in git.

Gameplay advancement intentionally returns `PrivateStateNotReady` until this gate passes; a public `World` account would invalidate the product’s privacy claim.

Phase 2 has canonical PDA seeds and fixed-size layouts for the lobby, match, sponsor, world, inboxes, player views, result, ratings, and settlement marker. A full roster no longer enters `Ready` until the private lifecycle is wired.
