# BLACKOUT evidence ledger

| Claim | Test / script | Cluster / endpoint | Program commit | Sample count | Result | Artifact | Status |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| Reproducible Anchor build | `cargo test`, `anchor build` | Local | `36e2fbd` | 1 | Passed | Local build output | Demonstrated locally |
| Private PER no-reader gate | `contracts/tests/per-gate.ts` | Devnet TEE | `36e2fbd` | 1 | Passed: authorized reader received the secret; base/direct/batch/subscription/history/transaction/simulation and wrong-wallet paths did not | Live test output, 2026-09-08 | Demonstrated on devnet |
| Devnet program deployment | `solana program deploy --use-quic` | `api.devnet.solana.com` | `36e2fbd` | 1 | Passed | Program `3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`; deploy signature `2uRiTzNzQfqaxtLDgyVjG5mhdRycmxPM1rXjyVdDG33B91PDSHXS7tJRU6hJctXoPeVNX73ufKwB4NTUxkUgvKMX` | Demonstrated on devnet |

The privacy result covers the probe access model only. Private World and player-view behavior, latency, settlement, and gameplay remain unproven until they have direct runtime evidence.
