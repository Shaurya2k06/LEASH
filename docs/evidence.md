# LEASH evidence ledger

Evidence is tied to the source revision that produced it. The previous
devnet runs in this repository used the pre-audit binary and are retained only
as historical context; redeploy the current program before calling the live
gates demonstrated.

| Claim | Test / script | Environment | Revision | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Anchor build | `PATH="$HOME/.avm/bin:$PATH" anchor build` | Local, Rust 1.89.0 / Anchor 1.0.2 / Solana 3.1.9 | current source | Passed with the BPF stack checker | build output | Demonstrated locally |
| Contract unit invariants | `cargo test -p contracts` | Local | current source | Typed-action rejection, single-use consumption, and 100 mixed terminal outcomes pass | test output | Demonstrated locally |
| TypeScript gate migration | `yarn typecheck && yarn lint` | Local | current source | Passed; gates use agent-signed typed issuance, receipt permission, terminal accounts, and finalization | test output | Demonstrated locally |
| Relay hardening | `npm test` | Local Node 22 | current source | Read-only allowlist, request size handling, upstream timeout/health, CORS restriction, and rate limiting pass | test output | Demonstrated locally |
| Operator cockpit | `npm run lint && npm run build` | Local Node 22 | current source | Passed; UI labels public RPC health and recorded CLI evidence separately from TEE execution | build output | Demonstrated locally |
| Live sibling-read / settlement / expiry / race gates | `yarn test:leash:*` | Devnet + authenticated TEE | redeploy required | Existing historical runs passed before the audit redesign; they do not certify the current binary | `contracts/artifacts/*.json` after rerun | Pending redeploy |
| Transport + application-health benchmark | `BENCHMARK_SAMPLES=100 yarn bench:leash` | Devnet + authenticated TEE | current source | Writes transport and public program-account application samples; makes no action-latency claim | `contracts/artifacts/leash-benchmark.json` | Run on demand |

The program ID is
`3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`. Gate and benchmark artifacts
are intentionally ignored because they contain run-specific endpoints and
timestamps; they must not contain wallets, TEE tokens, or private account
payloads.
