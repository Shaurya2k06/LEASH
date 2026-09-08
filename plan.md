# BLACKOUT — Solana Blitz v8 Coding Plan

## 0. Decision and scope

Build **BLACKOUT**, a four-player top-down stealth arena. Movement, collision, combat, cooldowns, tick advancement, matchmaking, and visibility are authoritative inside one Private Ephemeral Rollup (PER). A player receives a derived `PlayerView`, never the raw enemy positions. The public chain receives only a sanitized result, prize transfer, and rating update.

Primary success claim: **hidden-state wallhacks and invalid movement fail while the game remains responsive**. Do not claim protection against collusion, aimbots, traffic analysis, TEE censorship, or all cheating.

Scope the first shippable map to four players, one weapon, fixed-point physics, a 20 Hz target tick, one visibility rule, and at most 32 projectiles. Client prediction is visual only; the program decides outcomes. A relayer/crank may transport transactions but cannot invent inputs or choose results.

## 1. v8 rules to pin before coding

The current official [v8 Luma page](https://luma.com/j13m2kqc) describes a full-week hybrid edition joining the IRL/online Global Startup Village. It lists $500/$250/$150 USDC prizes plus $100 Wizardio’s Choice, and prioritizes projects using ER or PER; it does not state a mandatory product theme. The [MagicBlock announcement](https://x.com/magicblock/status/2094425150318108965/photo/1) corroborates the Global Startup Village format.

Before submission, verify the BUILD portal/Discord for the exact cutoff, pre-existing-code rule, team limits, demo format, and any later amendment. Do not import v7’s collaboration theme or weekend assumptions.

## 2. Benchmark and honest comparison

The intended benchmark is Tenor: blind multi-dealer FX in PER, selective quote privacy, `CrossReadDenied` 6013, losing quotes absent from public state, Pyth-backed pricing, automated settlement, working devnet program/live bot demo, and reported post→settled latency of p50 7.205 s / p95 7.330 s (n=10). See the [Tenor README](https://github.com/Shaurya2k06/tenor/blob/main/README.md).

Repository inspection at commit `ef13de39147e6b4e6215a4358e7adfe61c03c2c2` found important implementation caveats: quote permission initialization sets `is_private: false` so the matcher can read quotes; `probe_cross_read` checks a signer in one instruction rather than proving raw-RPC confidentiality; the e2e path uses commit/undelegate followed by a separate `finalize_settlement`. Treat the README as the published benchmark, not as proof that every stronger guarantee exists in the deployed binary. BLACKOUT must run direct-RPC, logs, subscriptions, simulation, and commit-boundary tests and report exactly what is demonstrated.

At equal working-devnet polish, judges should choose BLACKOUT because the privacy guarantee changes play continuously, the speed requirement is visible in the 20 Hz loop, and the attack console demonstrates the failure—not merely a final hidden quote.

## 3. Primitive policy

| Primitive | Use | Required claim |
|---|---|---|
| ER delegation/execution | Delegate match scaffolding/sponsor; run gasless, low-latency simulation | Measure achieved latency; do not repeat a sub-50 ms number without measurement |
| PER / Intel TDX | Protect `World`, inputs, and per-player views from unauthorized TEE RPC reads | Essential: public coordinates make stealth meaningless |
| Ephemeral accounts | Prefer ER-only secret payloads where supported; close them before teardown | Never commit secret world/salt payloads just to close a session |
| Magic Actions | Attach an authenticated base-layer prize/rating handler to the sanitized result commit | Verify the injected escrow signer; `#[action]` is not post-commit-only authentication |
| SPL tokens | Prefunded prize vault and real winner token accounts | Settlement must move real SPL funds |
| Magic Router | One RPC endpoint that routes lifecycle transactions | Routing convenience only; do not claim arbitrary cross-ER atomicity |
| VRF | Optional public spawn/role assignment after roster lock | Public randomness is not secret; omit it if it does not add a fairness property |
| Pyth | Omit from the core game | No price feed is needed; adding one is decorative |

Use the current PER flow: delegate the data PDA on the base layer, then create/update/close `EphemeralPermission` directly on the ER with `ephemeral-rollups-sdk` v0.14+; pre-fund the delegated PDA for permission rent. Do not mix legacy L1 permission-account examples with the current flow. Sources: [PER quickstart](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart), [PER access control](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/access-control), [ephemeral accounts](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/ephemeral-accounts).

Magic Actions run base-layer instructions immediately after an ER commit; action handlers remain directly callable unless escrow/receipt authentication is enforced. Sources: [Actions overview](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/overview), [Actions implementation](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/implementation). Router behavior is documented as metadata-based ER/L1 routing, not distributed transaction atomicity: [Magic Router](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/magic-router).

## 4. Architecture and account surface

| Account | Location | Contents / visibility |
|---|---|---|
| `LobbyQueue` | ER | Bounded queue and deterministic assignment; public |
| `MatchConfig` | Delegated/public output | Roster, map/rules hash, tick policy, prize, lifecycle |
| `MatchSponsor` | Delegated | Lamports/rent sponsor for ER-only accounts |
| `World` | Private PER/ER-only candidate | Fixed-point positions, health, cooldowns, projectile state; no player read membership |
| `InputInbox[player]` | Private PER | Signed sequence, target tick, bounded controls; player-scoped |
| `PlayerView[player]` | Private PER | Own state plus only entities passing the visibility predicate |
| `MatchResult` | Delegated public output | Winner, score, result hash, unique settlement ID |
| `PrizeVault` | Solana SPL | Prefunded prize custody |
| `PlayerRating` | Solana | Public rating update |
| `SettlementMarker` | Solana | Unique consumed-result PDA / replay protection |
| `EphemeralPermission` PDAs | ER | Current PER ACL state |

If the runtime cannot execute a tick over a private `World` without exposing it to a relayer, stop and redesign the account layout before adding gameplay. Do not silently introduce a trusted simulation server.

### Instructions

`create_match`, `fund_prize`, `join_queue`, `form_match`, `delegate_match`, `initialize_private_state`, `set_permissions`, `submit_input`, `advance_tick`, `finish_match`, `commit_result`, `settle_result` (Magic Action handler), `close_private_state`, `undelegate_match`.

`submit_input` verifies player/session authority, sequence, target-tick bounds, and movement/action limits. `advance_tick` consumes only the next deterministic tick, applies fixed-point physics/combat/visibility, rejects replay/future/duplicate inputs, and caps catch-up. `finish_match` freezes the result. `commit_result` commits only a sanitized result and schedules the action. `settle_result` verifies the injected escrow signer, result hash, winner ATA owner, deadline/lifecycle, and unique `SettlementMarker`, then transfers SPL prize and updates rating in one base-layer instruction.

## 5. Delivery roadmap

### Phase 0 — rules, versions, and fixtures

- Pin Rust, Solana/Agave, Anchor, Node, and `ephemeral-rollups-sdk` versions compatible with the current PER quickstart.
- Record v8 rules and submission checklist in `docs/submission.md`.
- Create fixed map/rules fixtures and deterministic input transcripts with expected result hashes.

**Done when:** a clean clone installs the pinned toolchain, unit tests run without network access, and the v8 checklist has an owner/date for every unknown rule.

### Phase 1 — PER no-reader integration gate (kill gate)

- Deploy a minimal program to devnet TEE.
- Delegate sponsor/data PDA; create ER-native `EphemeralPermission` with current SDK.
- Prove a program/crank can update a private world and a separate player view without granting the crank or another player global world access.
- Attack with `getAccountInfo`, `getMultipleAccounts`, subscriptions, transaction messages, logs, return data, simulation, and wrong-wallet TEE tokens.

**Done when:** the world update works on the real devnet runtime, unauthorized reads are denied or contain no secret data, and the test artifacts distinguish TEE ingress denial from application-level errors. **If this fails, pivot to LEASH; do not weaken BLACKOUT into a public-state game.**

### Phase 2 — program skeleton and lifecycle

- Implement all PDAs, bounded account sizes, delegation, permission initialization/update/close, and teardown.
- Add explicit errors: unauthorized view, invalid input, replay, tick out of range, wrong phase, unauthorized settlement, already settled.
- Keep all mutable world state in one PER; do not rely on cross-ER atomicity.

**Done when:** initialize → delegate → permission → private update → scrub/close → undelegate passes on devnet and no secret-bearing account is committed publicly.

### Phase 3 — deterministic simulation

- Implement fixed-point movement, collisions, one weapon, cooldowns, health, projectile cap, line-of-sight and visibility.
- Add deterministic transcript replay and property tests: identical accepted inputs produce identical result hashes; no position/health invariant can overflow.
- Enforce tick order, late/future-input policy, bounded catch-up, and no invented crank inputs.

**Done when:** 1,000 offline transcripts replay byte-for-byte and a four-player match reaches the same result from multiple clients.

### Phase 4 — client views and attack console

- Build four playable clients using session/auth tokens appropriate to the PER endpoint.
- Render only `PlayerView[player]`; never download or cache raw `World`.
- Add an attack console for wrong-player view, raw RPC reads, subscriptions, simulation, forged speed, replayed inputs, and future inputs.

**Done when:** a wallhack client cannot obtain hidden coordinates, a legitimate line-of-sight event reveals an opponent, and every invalid action has a reproducible failing signature.

### Phase 5 — result commit and settlement

- Build `MagicIntentBundleBuilder` commit plus post-commit action.
- In the action, authenticate the injected escrow signer and enforce result-hash/nonce/receipt constraints.
- Transfer SPL prize and update rating atomically; use `SettlementMarker` for at-most-once execution.
- Test direct-wallet invocation, induced SPL failure, retry, duplicate result, wrong winner ATA, and stale lifecycle calls.

**Done when:** direct forged settlement fails; a failed transfer leaves no payout/rating/consumed marker; a successful retry pays exactly once; the explorer shows only the sanitized result and public settlement.

### Phase 6 — measured demo and reliability

- Measure n≥100 (prefer n≥1,000) input→confirmed-view latency, achieved tick interval, and match-finish→public-settlement latency separately.
- Report p50/p95/p99, region/endpoint, retries, failures, and whether timestamps are client, ER, or base-layer.
- Run 20 clean matches plus induced failure/attack scenarios from a scripted worker.

**Done when:** the README contains reproducible measurements; “sub-50 ms” appears only if the measured application path supports it; oracle latency is not implied because Pyth is omitted.

### Phase 7 — submission packaging

- Add landing page, 3–5 minute live demo, architecture diagram, explorer links, program ID, commit hash, setup commands, and attack transcript.
- Mark each feature **demonstrated**, **simulated**, or **externally dependent**. Document TDX trust assumptions, operator liveness, traffic analysis, collusion, and any runtime limitations.
- Run CI from a clean clone; ensure no keys, tokens, or private state enter git.

**Done when:** a judge can run one documented command, open four clients, reproduce the wallhack failure, see a valid visibility reveal, inspect the failed direct settlement, and verify the successful public SPL settlement.

## 6. Test matrix

- **Privacy:** wrong-wallet reads, batch reads, subscriptions, logs/messages/return data, simulations, public commit inspection, teardown inspection.
- **Authorization:** wrong player input, forged sequence, replay, future/late tick, invalid movement, wrong view, direct action call, wrong escrow signer.
- **Determinism:** fixed-point arithmetic, transcript replay, same inputs → same result hash, bounded resource usage.
- **Settlement:** SPL conservation, winner ATA ownership, unique marker, failed transfer rollback, retry/idempotency, finish-state immutability.
- **Lifecycle:** delegation, ER-native permission creation/update/close, sponsor rent, scrub, undelegation, reconnect/retry.
- **Performance:** clean and adversarial runs with percentile reports and failure counts.

## 7. Track decisions retained for scope control

| Track | Candidate | D / N / Demo / F | Decision |
|---|---|---:|---|
| Multiplayer | BLACKOUT stealth arena | 4 / 3 / 5 / 4 | **Primary**; strongest live judge story, conditional on Phase 1 |
| Private markets | Confidential continuous liquidation engine | 3 / 2 / 3 / 4 | Reject: oracle/solvency/recovery complexity, weaker novelty than Tenor |
| AI agents | LEASH confidential capability/budget kernel | 4 / 3 / 4 / 4 | **Fallback** if BLACKOUT no-reader gate fails |
| Social | PACT confidential crew formation | 3 / 3 / 3 / 3 | Reject: slower/discrete demo and weaker fault story |
| VRF + PER + Actions | FAIRFOG hidden course with later replay | 4 / 4 / 4 / 4* | Optional R&D only; VRF is redundant unless preventing colluding preselection is a stated requirement |

Scores are design potential at equivalent polish; Tenor currently wins on shipped evidence. Do not add private markets, Pyth, VRF, or cross-ER composition to BLACKOUT merely to increase primitive count.

## 8. Fallback: LEASH

If Phase 1 proves that a no-reader private world cannot be executed reliably, pivot early to LEASH: confidential spending capabilities for hostile AI swarms. Keep one PER for `SecretPolicy` + `SessionLedger`; issue single-use permits; attach a Magic Action to an SPL payment; consume a mutually exclusive L1 `TerminalMarker` for spent/expired. Demonstrate twenty agents racing for the last budget, sibling reads denied, replay rejected, failed payment preserving reservation, and expiry unable to race a later payment. Do not claim private LLM reasoning or add VRF/Pyth.

## 9. Source index

- v8: [Luma](https://luma.com/j13m2kqc), [Global Startup Village announcement](https://x.com/magicblock/status/2094425150318108965/photo/1)
- Benchmark: [Tenor README](https://github.com/Shaurya2k06/tenor/blob/main/README.md) and source files at commit `ef13de39147e6b4e6215a4358e7adfe61c03c2c2`
- MagicBlock: [PER quickstart](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart), [PER access control](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/access-control), [ephemeral accounts](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/ephemeral-accounts), [ER quickstart](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart), [Magic Actions](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/overview), [Actions implementation](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/implementation), [Magic Router](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/magic-router), [VRF best practices](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/best-practices)
- Prior winners/context: [Supersize](https://www.magicblock.xyz/blog/supersize), [CapturGO](https://x.com/magicblock/status/2078122363129147849), [Perps Rider](https://x.com/magicblock/status/2078122723419771182), [Hunch](https://x.com/magicblock/status/2078122585620103449), [Solana July roundup](https://solana.com/news/solana-ecosystem-roundup-july-2026)
- Agent fallback context: [Sonic North Star](https://x.com/SonicSVM/status/2071943960113910020), [Loyal private transactions](https://docs.askloyal.com/sdk/private-transactions/how-it-works)

