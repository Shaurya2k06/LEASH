# LEASH evidence ledger

Evidence is tied to the deployed program binary that produced it. The current
devnet deployment is program `3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`,
deployed in slot `495263536`, with binary SHA-256
`2925d4fe8d94353489a9f6c3059c5e93b2bc008f03bbae0b6b28214e70ceb0b9`.

| Claim | Test / script | Environment | Revision | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Anchor build | `PATH="$HOME/.avm/bin:$PATH" anchor build` | Local, Rust 1.89.0 / Anchor 1.0.2 / Solana 3.1.9 | current source | Passed with the BPF stack checker | build output | Demonstrated locally |
| Contract unit invariants | `cargo test -p contracts` | Local | current source | Typed-action rejection, single-use consumption, and 100 mixed terminal outcomes pass | test output | Demonstrated locally |
| TypeScript gate migration | `yarn typecheck && yarn lint` | Local | current source | Passed; gates use agent-signed typed issuance, receipt permission, terminal accounts, and finalization | test output | Demonstrated locally |
| Relay hardening | `npm test` | Local Node 22 | current source | Read-only allowlist, request size handling, upstream timeout/health, CORS restriction, and rate limiting pass | test output | Demonstrated locally |
| Operator cockpit | `npm run lint && npm run build` | Local Node 22 | current source | Passed; UI labels public RPC health and recorded CLI evidence separately from TEE execution | build output | Demonstrated locally |
| Live sibling-read / settlement / expiry / race gates | `yarn test:leash:per`, `yarn test:leash:settlement`, `yarn test:leash:expiry`, `yarn test:leash:race` | Devnet + authenticated TEE | `2925d4fe…70ceb0b9`, slot `495263536` | All four passed: private reads denied, rollback/retry preserved, expiry excluded payment, 1 of 20 reservations won, and terminal history reset preserved | `contracts/artifacts/leash-*-gate.json` | Demonstrated live |
| Transport + application-health benchmark | `BENCHMARK_SAMPLES=100 yarn bench:leash` | Devnet + authenticated TEE | `2925d4fe…70ceb0b9` | 100 samples per base/TEE transport and application probe; zero failures; makes no action-latency claim | `contracts/artifacts/leash-benchmark.json` | Demonstrated live |
| Public evidence manifest | Vercel static asset `/evidence.json` | Public browser | `2925d4fe…70ceb0b9` | Sanitized gate outcomes only; no wallet, TEE token, private account payload, amount, or digest | `client/public/evidence.json` | Published |

The program ID is
`3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe`. Gate and benchmark artifacts
are intentionally ignored because they contain run-specific endpoints and
timestamps. The checked-in browser manifest is a sanitized summary derived
from those artifacts; it must not contain wallets, TEE tokens, or private
account payloads.
