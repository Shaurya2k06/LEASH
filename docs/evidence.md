# BLACKOUT evidence ledger

| Claim | Test / script | Cluster / endpoint | Program commit | Sample count | Result | Artifact | Status |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| Reproducible Anchor build | `cargo test`, `anchor build` | Local | `36e2fbd` | 1 | Passed | Local build output | Demonstrated locally |
| Private PER no-reader gate | `contracts/tests/per-gate.ts` | Devnet TEE | `36e2fbd` | 1 | Passed: authorized reader received the secret; base/direct/batch/subscription/history/transaction/simulation and wrong-wallet paths did not | Live test output, 2026-09-08 | Demonstrated on devnet |
| Crank-without-reader gate | `contracts/tests/per-gate.ts` with separate authenticated writer | Devnet TEE | Uncommitted test-only probe variant | 1 | Failed: a writer excluded from the private permission updated the probe, then base RPC contained that secret | Live test output, 2026-09-08 | BLACKOUT kill gate failed |
| Devnet program deployment | `solana program deploy --use-quic` | `api.devnet.solana.com` | `36e2fbd` | 2 | Passed; prior probe-only binary restored after the failing variant | Program `3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`; deploy signatures `2uRiTzNzQfqaxtLDgyVjG5mhdRycmxPM1rXjyVdDG33B91PDSHXS7tJRU6hJctXoPeVNX73ufKwB4NTUxkUgvKMX`, `646B5yyDaBJppGJEabLwmabE1ib5vKs1VhahdS3Js2V4bkT874S1ZkHaRo4rNZ18v1pfqCT8TAkfDoEsfpMq1Gxq` | Demonstrated on devnet |

The reader-only probe result does not satisfy BLACKOUT's architecture: the actual crank-without-reader gate failed. Per `context.md` and `plan.md`, BLACKOUT must not continue as a private-state game; the project pivots to LEASH. The prior probe-only binary is restored after this evidence run.
