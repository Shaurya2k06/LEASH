# BLACKOUT evidence ledger

| Claim | Test / script | Cluster / endpoint | Program commit | Sample count | Result | Artifact | Status |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| Reproducible Anchor build | `cargo test`, `anchor build` | Local | `36e2fbd` | 1 | Passed | Local build output | Demonstrated locally |
| Private PER no-reader gate | `contracts/tests/per-gate.ts` | Devnet TEE | `36e2fbd` | 0 | Not run: program deployment has not landed | Devnet deploy retry output | Blocked externally |
| Devnet program deployment | `anchor deploy`, `solana program deploy --use-rpc` | `api.devnet.solana.com` | `36e2fbd` | 2 | Both writes exhausted retry budgets; public RPC also returned 429 | Terminal output, 2026-09-08 | Blocked externally |

No privacy, latency, settlement, or gameplay claim is demonstrated until this table has direct runtime evidence.
