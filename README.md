# BLACKOUT

BLACKOUT is a four-player stealth arena designed for authoritative execution inside a MagicBlock Private Ephemeral Rollup. The repository is currently at the local preview stage.

## Run the preview

```sh
cd client && npm run dev
```

The preview contains the arena shell, roster/visibility states, tick control, and simulated attack-console interactions. It does not claim a live PER connection.

## Validate the current slice

```sh
cd client && npm run lint && npm run build
cd ../server && npm test
cd ../contracts && cargo check && yarn typecheck && yarn lint && anchor build --no-idl
```

`anchor build --no-idl` produces the deployable SBF artifact. Anchor 0.30.1 IDL generation currently needs a compatible nightly/proc-macro toolchain, so IDL generation remains a setup task. Gameplay advancement intentionally returns `PrivateStateNotReady` until the Phase 1 PER no-reader test passes; a public `World` account would invalidate the product’s privacy claim.
