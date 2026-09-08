# LEASH evidence ledger

| Claim | Test / script | Cluster / endpoint | Program commit | Sample count | Result | Artifact | Status |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| Reproducible Anchor build | `cargo test`, `anchor build` | Local | `6ee37a0` | 1 | Passed | Local build output | Demonstrated locally |
| LEASH policy kernel deployment | `anchor deploy --provider.cluster https://rpc.magicblock.app/devnet -- --use-rpc` | `rpc.magicblock.app/devnet` | `6ee37a0` | 1 | Passed; current binary includes settlement and expiry actions | Program `3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`; deploy signature `5fA8DRuV9sHNXKJARrCNjPQxXJDXzouFKTTJHkXvZszb1NFAGTcaXohQHs1A523CF9jJLYe9ykVeJE7MYb3noWWV` | Demonstrated on devnet |
| LEASH sibling-read gate | `contracts/tests/leash-per-gate.ts` | `rpc.magicblock.app/devnet` + Devnet TEE | `6ee37a0` | 1 | Passed: agent read/consumed its own ledger; base and authenticated sibling direct/batch/subscription/transaction/simulation paths did not reveal the reservation; scrub/close/undelegate did not commit it to base | Live test output, 2026-09-08 | Demonstrated on devnet |
| LEASH authenticated SPL settlement | `contracts/tests/leash-settlement-gate.ts` | `rpc.magicblock.app/devnet` + Devnet TEE | `6ee37a0` | 1 | Passed: direct action invocation rejected; an underfunded action left the reservation, receipt, marker, and recipient balance unchanged; refunding the vault and re-delegating the pending receipt paid once; replay rejected | Live test output, 2026-09-08 | Demonstrated on devnet |
| LEASH expiry terminal race | `contracts/tests/leash-expiry-gate.ts` | `rpc.magicblock.app/devnet` + Devnet TEE | `6ee37a0` | 1 | Passed: expired private permit refunded budget, authenticated expiry action published `TerminalKind::Expired`, later settlement failed, and expiry replay failed | Live test output, 2026-09-08 | Demonstrated on devnet |
| LEASH twenty-session budget race | `contracts/tests/leash-race-gate.ts` | `rpc.magicblock.app/devnet` + Devnet TEE | `870a41b` | 1 × 20 private sessions | Passed in 54.6s: one reservation won the exact remaining budget; nineteen losing sessions retained zero reservation; private teardown completed | Live test output, 2026-09-08 | Demonstrated on devnet |
| LEASH operator view / transport relay | `npm run lint && npm run build`; `npm test`; `/health` and invalid `/relay` checks | Local | `870a41b` | 1 | Passed: browser polls public program health only; relay reports `authoritative:false`, forwards only allowlisted JSON-RPC methods, and rejects unsupported methods | Local build and smoke output | Demonstrated locally |
| LEASH transport benchmark | `BENCHMARK_SAMPLES=100 yarn bench:leash` | `rpc.magicblock.app/devnet` + Devnet TEE | `4a4b565` | 100 per endpoint | `getSlot(confirmed)` round trips, 0 failures: base p50/p95/p99 88.27/99.70/103.91 ms; TEE 72.39/83.21/114.37 ms. This is transport health, not action latency. | Live benchmark output, 2026-09-08 | Demonstrated as measured transport health |

The deployed LEASH binary is `3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`.
Sibling-read, settlement, rollback, replay, expiry, and twenty-session
contention claims are demonstrated on devnet. The transport benchmark is not a
permit/action latency measurement; organizer-specific submission fields remain
owner verification items.
