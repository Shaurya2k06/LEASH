# LEASH — implementation plan

## 1. Contract kernel

- Keep `SecretPolicy` and `SessionLedger` private in one PER.
- Use bounded fixed-size account layouts and canonical PDAs.
- Reserve budget with a checked subtraction and monotonic permit nonce.
- Keep receipt and terminal state separate so public output is sanitized.

## 2. Private lifecycle

- Allocate and fund accounts on Solana.
- Delegate policy, sessions, and receipts to the selected TEE validator.
- Create private permissions with only the controller/agent members required.
- Configure and issue permits only through authenticated controller paths.
- Scrub, close permissions, and undelegate only after private state is safe.

## 3. Settlement and expiry

- Prepare a digest-bound pending receipt.
- Commit an authenticated Magic Action for SPL transfer and `Spent` marker.
- Preserve the reservation and receipt when the action fails.
- Retry the same pending receipt after repairing the source vault.
- Refund expired reservations and publish one authenticated `Expired` marker.
- Reject direct action calls and all terminal/replay duplicates.

## 4. Adversarial gates

Run from `contracts/`:

```sh
yarn test:leash:per
yarn test:leash:settlement
yarn test:leash:expiry
yarn test:leash:race
```

The gates must prove private sibling-read denial across direct, batch,
subscription, transaction, and simulation paths; settlement rollback/retry;
replay rejection; expiry/payment mutual exclusion; and exactly one reservation
among twenty concurrent private sessions.

## 5. Operator surface

- Keep the React client read-only: public program health and recorded evidence.
- Keep the relay transport-only: allowlisted JSON-RPC forwarding, no signing,
  policy access, or outcome authority.
- Expose the deployed program ID and trust boundary in the UI.

## 6. Reproducibility

```sh
cd contracts
cargo test -p contracts
yarn typecheck
yarn lint
cd ../client && npm ci && npm run lint && npm run build
cd ../server && npm ci && npm test
```

Run `BENCHMARK_SAMPLES=100 yarn bench:leash` only as a transport-health
benchmark. Record endpoint, timestamp source, percentiles, failures, and the
deployed program commit in `docs/evidence.md`.

## 7. Submission boundary

The repository is LEASH-only. Before submitting, confirm event rules directly
with the organizer, attach a short demo and explorer links, and label every
claim as demonstrated, simulated, or externally dependent. Do not describe
the relay as authoritative or private state as public Solana data.
