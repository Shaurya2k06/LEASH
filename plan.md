# LEASH — implementation plan

## 1. Contract kernel

- Keep `SecretPolicy` and `SessionLedger` private in one PER.
- Use bounded account layouts and canonical PDAs; terminal history is a
  serialized vector capped at 128 records to avoid BPF stack growth.
- Reserve budget with a checked subtraction and monotonic permit nonce.
- Keep receipt and terminal state separate so the public receipt contains only
  routing metadata, nonce, and status—not amount or digest.

## 2. Private lifecycle

- Allocate and fund accounts on Solana.
- Require the policy controller to co-sign session creation so hostile agents
  cannot self-enroll against another policy.
- Delegate policy, sessions, and receipts to the selected TEE validator.
- Create private permissions with the controller and explicitly enrolled agent
  members required for policy issuance.
- Configure typed policies privately; issue permits through an enrolled agent signer
  with exact action, payload, recipient, mint, vault, amount, and expiry
  checks.
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
- Keep the relay transport-only: bounded, rate-limited, timeout-bounded,
  read-only JSON-RPC forwarding with upstream health checks; no signing,
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

Run `BENCHMARK_SAMPLES=100 yarn bench:leash` as transport plus public
application-health measurement. It writes `artifacts/leash-benchmark.json`
and still makes no permit/action-latency claim.

## 7. Submission boundary

The repository is LEASH-only. Before submitting, confirm event rules directly
with the organizer, attach a short demo and explorer links, and label every
claim as demonstrated, simulated, or externally dependent. Do not describe
the relay as authoritative or private state as public Solana data.
