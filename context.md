# BLACKOUT — Coding Context and System Contract

## 1. How to use this document

This is the coding agent’s product and architecture source of truth for **BLACKOUT**, the selected Solana Blitz v8 submission. Read it before changing program state, permissions, settlement, client data flow, or public claims.

- `context.md` defines the product, trust model, invariants, state machine, and interface contracts.
- `plan.md` defines build order, gates, tests, and phase-level definitions of done.
- Deployed runtime behavior and passing tests outrank assumptions in either document. If MagicBlock’s current SDK/runtime contradicts this design, record the contradiction and stop at the relevant gate rather than simulating the missing property.
- Never silently downgrade private authoritative state into a public account or trusted game server.

## 2. Product in one paragraph

BLACKOUT is a four-player top-down stealth arena whose complete game loop executes in one MagicBlock Private Ephemeral Rollup (PER). The program owns movement, collision, projectile combat, cooldowns, match progression, and visibility. A player receives only a program-derived `PlayerView`; concealed enemy coordinates never reach that player’s client. A malicious client can attempt raw RPC reads, subscriptions, simulations, forged movement, and replayed inputs in the live demo. When the match ends, a sanitized result is committed and a Magic Action atomically transfers a prefunded SPL prize and updates the winner’s public rating.

The pitch is: **the blockchain knows where the enemy is, but your client does not.**

## 3. Why this must use MagicBlock

Both speed and privacy are load-bearing:

1. Public authoritative coordinates make fog of war inspectable and therefore useless.
2. Client-side or off-chain authoritative simulation reintroduces a trusted game server.
3. A 20 Hz target simulation has a 50 ms tick budget; ordinary Solana confirmation is not a suitable moment-to-moment game loop.
4. Prize custody and ratings should remain standard Solana/SPL state, reached through a sanitized PER result.

Required primitives are ER execution/delegation, PER access control, Magic Actions, and SPL tokens. Magic Router is routing convenience. VRF is optional fairness infrastructure, not secret randomness. Pyth is not part of the game.

## 4. Competition and benchmark context

The current [Solana Blitz v8 Luma page](https://luma.com/j13m2kqc) describes a full-week hybrid Global Startup Village edition. It lists $500/$250/$150 USDC prizes plus $100 Wizardio’s Choice and does not state a fixed product theme. Confirm deadline, team, pre-existing-code, and submission rules in the BUILD portal/Discord before submission.

The benchmark is Tenor, the Blitz v7 winner: a private multi-dealer FX RFQ with a polished devnet/bot demo, Pyth integration, an attack console, public SPL settlement, and repository-reported post→settled latency of p50 7.205 s / p95 7.330 s for n=10. BLACKOUT should beat Tenor’s **intended** standard: hard private-state isolation, sanitized public output, authenticated atomic settlement, live adversarial proof, and measured latency.

Source inspection at Tenor commit `ef13de39147e6b4e6215a4358e7adfe61c03c2c2` found that the current quote permission initializer uses `is_private: false`, its `CrossReadDenied` path is an instruction signer check rather than a raw-RPC confidentiality proof, and its e2e path performs commit/undelegate followed by a separate finalize instruction. This is a warning against equating a custom error with end-to-end privacy. Do not turn it into a public attack on the prior project; use it to make BLACKOUT’s evidence stronger.

## 5. Product scope

### Core match

- Four-player free-for-all.
- One fixed arena whose geometry and rules hash are public.
- One projectile weapon, one cooldown, integer health, and at most 32 live projectiles.
- Deterministic fixed-point movement and collision.
- Target cadence: 20 simulation ticks per second.
- Opponents/projectiles are visible only when the program’s visibility predicate passes.
- Match ends when one player remains alive or a configured maximum tick is reached.
- Time-limit tie-break is deterministic: highest health, then damage dealt, then lowest roster index.
- Result contains winner, score summary, match/rules hash, final tick, and settlement ID—never raw hidden history.

### Explicitly out of scope for v1

- Teams, ranked seasons, NFTs, inventory, multiple weapons/maps, voice/chat, spectators with live omniscience, token wagering, Pyth, DeFi, cross-ER simulation, ZK proofs, and AI-controlled gameplay.
- Claims of preventing aimbots, collusion, traffic analysis, TEE censorship, compromised clients reading their own authorized view, or all cheating.
- A public `World` account, an authoritative WebSocket game server, or a server that decides visibility/results.

## 6. Trust and threat model

### Trusted or assumed

- Solana consensus and SPL Token correctness for public custody/settlement.
- MagicBlock’s TEE validator, Intel TDX isolation, attestation path, and current PER ingress/access-control implementation.
- The deployed program binary and its deterministic rules.
- At least one available transaction submitter/crank for liveness. The submitter is not trusted to choose outcomes.

### Adversary capabilities

- Controls a normal player wallet, frontend, browser devtools, RPC client, and network requests.
- Calls any public instruction directly with arbitrary accounts/data.
- Reads public Solana state and transaction history.
- Attempts TEE RPC reads with its own token, another account address, batch methods, subscriptions, simulation, and transaction/log inspection.
- Replays, reorders, duplicates, delays, or fabricates inputs and settlement calls.
- Tries to invoke the Magic Action handler directly.

### Security objectives

- A player cannot obtain a concealed opponent’s position/health/projectile information through supported RPC or program interfaces.
- Only the program’s visibility computation moves opponent state into that player’s view.
- Invalid/replayed inputs cannot change `World`.
- The crank cannot fabricate signed player inputs or accelerate state beyond the accepted timing policy.
- Result settlement executes at most once and cannot partially apply payout/rating/marker changes.
- Secret-bearing state never appears on base-layer accounts, commits, events, logs, or teardown output.

PER confidentiality is TEE-backed, not a zero-knowledge proof. Report this plainly.

## 7. Execution topology

| Layer | Responsibilities | Must not contain/do |
|---|---|---|
| Client | Sign bounded inputs, render own view, show latency and attack results | Fetch/cache raw `World`; decide hits or visibility |
| Magic Router | Route transactions to Solana or the correct ER endpoint | Be described as cross-ER atomic coordination |
| Single PER | Authoritative world, tick execution, combat, visibility, private inputs/views | Depend on mutable state in another ER |
| Solana base layer | Match configuration/output, SPL vault, ratings, settlement marker | Store live positions, private inputs, or concealed history |
| Relayer/crank | Submit eligible tick/commit transactions | Invent player input, choose winner, bypass clock/sequence checks |

Use separate base-layer and TEE/Router connections. Verify TEE RPC integrity and derive the user authorization token by signing the endpoint challenge. Do not commit a reusable auth token or player key to source control.

## 8. Account model

Seeds below are canonical suggestions; change them only once, before fixtures and clients depend on them.

| Account | Suggested seeds | Key fields and constraints |
|---|---|---|
| `LobbyQueue` | `[b"lobby"]` | Bounded entries; no unbounded vector; deterministic roster order |
| `MatchConfig` | `[b"match", match_id]` | Authority, four players, rules/map hash, prize mint/amount, lifecycle, max tick |
| `MatchSponsor` | `[b"sponsor", match]` | Pre-funded before delegation; pays ER permission/ephemeral rent |
| `World` | `[b"world", match]` | Tick, phase, four `PlayerState`s, 32 projectile slots, aggregate score; private |
| `InputInbox` | `[b"input", match, player]` | Player/session authority, last sequence, pending bounded input; private/player-scoped |
| `PlayerView` | `[b"view", match, player]` | Own full state plus fixed-size visible-entity slots; private/player-scoped |
| `MatchResult` | `[b"result", match]` | Winner, score, final tick, rules hash, result digest, settlement ID; sanitized output |
| `PrizeVault` | ATA owned by match/venue PDA | Correct mint, prefunded amount, no arbitrary withdrawal path |
| `PlayerRating` | `[b"rating", player]` | Games, wins, rating, last settled match |
| `SettlementMarker` | `[b"settlement", settlement_id]` | Unique at-most-once receipt; created only in valid settlement |
| `EphemeralPermission` | MagicBlock-defined permission seed | Lives on ER under current SDK flow |

Keep all account sizes bounded and constant during a match. Prefer fixed arrays and active flags over variable vectors. This simplifies rent, compute bounds, deterministic serialization, and side-channel review.

### Private account layout decision

The first integration spike must determine the supported layout:

1. Preferred: ER-only ephemeral `World`/input/view accounts funded by `MatchSponsor`, with PER permissions where supported, then closed without a base-layer commit.
2. Acceptable: delegated private accounts with ER-native `EphemeralPermission`, provided secret fields are scrubbed before undelegation and only `MatchResult` is committed during play/settlement.

The program/crank must be able to update `World` while players cannot read it. If current ACL semantics require granting the crank raw-world read visibility, this architecture has failed its kill gate.

## 9. Match state machine

`Created → Funded → Delegated → Ready → Running → Finished → Committing → Settled → Closed`

- `Created`: immutable rules/map/prize configuration is established.
- `Funded`: exact SPL prize is in the program-controlled vault.
- `Delegated`: required match scaffolding/sponsor is owned by the ER delegation flow.
- `Ready`: four players, private accounts, permissions, and initial views exist.
- `Running`: inputs/ticks are accepted.
- `Finished`: outcome is frozen; inputs and ticks are rejected.
- `Committing`: sanitized result commit and post-commit action have been scheduled.
- `Settled`: payout, rating update, and settlement marker succeeded together.
- `Closed`: secret state/permissions are closed or scrubbed; safe public scaffolding is undelegated.

No instruction may skip phases. Retries must be idempotent. Failure to settle leaves the match retryable but must never reopen gameplay.

## 10. Input and tick contract

Use an integer input structure such as:

```text
PlayerInput {
  match,
  player,
  sequence,
  target_tick,
  move_x,
  move_y,
  aim,
  fire
}
```

- Player or scoped session key must sign.
- `sequence` must increase monotonically and cannot be reused.
- Movement axes and aim use bounded integers; normalize/clamp inside the program.
- `target_tick` must be inside a small configured future window. Late inputs are rejected or converted to neutral according to one documented policy—never silently applied to a later tick.
- At most one accepted input per player/tick. A missing input means neutral/hold, not crank-selected movement.
- `advance_tick` advances exactly the next tick, applies a bounded number of catch-up ticks, and cannot run after `Finished`.

Do not assume Unix-second precision can enforce 20 Hz. Phase 1 must identify the PER runtime’s usable monotonic slot/clock source and measure it. If pacing cannot be enforced programmatically, document the trusted scheduler/liveness limitation; never claim that a transaction-driven loop is clock-secure without evidence.

## 11. Deterministic simulation contract

- Use fixed-point integers; no floating-point arithmetic in consensus logic.
- Recommended geometry: circular players/projectiles against axis-aligned wall rectangles.
- Movement order per tick: validate input → update aim/cooldown → propose movement → resolve walls/bounds → spawn projectile → advance projectiles → resolve first deterministic hit → update health/score → determine finish → derive views.
- Resolve ties by stable roster/projectile-slot order. Never depend on hash-map iteration order.
- Projectile records are fixed slots containing active flag, owner index, position, velocity, damage, and remaining ticks.
- Arithmetic uses checked operations or deliberately sized saturating operations with tests.
- The same initial state plus accepted input transcript must produce the same final state and result digest.

### Visibility predicate

An opponent is visible to player `p` only when:

1. opponent is alive;
2. squared distance is within the configured vision radius; and
3. the segment from `p` to the opponent does not intersect an opaque wall.

Projectiles follow the same rule or a separately fixed public rule. Derive each `PlayerView` only after the full tick resolves. Use fixed-size view slots with `visible` flags; zero every hidden field. The roster itself may remain public.

## 12. Instruction contracts

| Instruction | Required authorization/preconditions | Writes/result |
|---|---|---|
| `create_match` | Creator signer; unique `match_id`; supported mint/rules | Initializes immutable `MatchConfig` and vault authority |
| `fund_prize` | Funder signer; correct mint; `Created` | Transfers exact prize; phase `Funded` |
| `join_queue` | Player signer; one active entry; bounded queue | Adds player without duplicate identity |
| `form_match` | Permissionless/deterministic; four eligible players | Fixes roster; no caller-selected ordering |
| `delegate_match` | Match authority/sponsor; funded state | Delegates only accounts required by current ER flow |
| `initialize_private_state` | Correct ER/PER; delegated sponsor | Creates world, inboxes, views, permissions; phase `Ready` |
| `submit_input` | Roster player/session signer; `Running` | Stores one bounded, sequenced pending input |
| `advance_tick` | Eligible submitter; valid timing; `Running` | Applies deterministic tick and rewrites every player view |
| `finish_match` | Program condition reached | Freezes sanitized result; phase `Finished` |
| `commit_result` | Finished result; correct Magic context | Commits only `MatchResult`; attaches post-commit action |
| `settle_result` | Authenticated action escrow signer; unconsumed ID | SPL transfer + rating + marker atomically; phase `Settled` |
| `close_private_state` | Finished/settled policy satisfied | Closes ER-only secrets or zeroes delegated secrets |
| `undelegate_match` | Secrets already closed/scrubbed | Returns safe public scaffolding to Solana; phase `Closed` |

Expected custom errors include `Unauthorized`, `UnauthorizedView`, `WrongPhase`, `InvalidInput`, `Replay`, `TickOutOfRange`, `MovementOutOfBounds`, `ProjectileLimit`, `ClockViolation`, `InvalidResult`, `UnauthorizedSettlement`, `AlreadySettled`, and `ArithmeticOverflow`. Error numbers are evidence for instruction behavior only, not proof of raw-RPC privacy.

## 13. PER lifecycle and permissions

Follow the current SDK v0.14+ lifecycle:

1. Initialize and pre-fund the data/sponsor PDA on Solana.
2. Delegate the data PDA to the selected devnet TEE validator.
3. On the ER, create `EphemeralPermission` using the delegated PDA as payer/PDA signer.
4. Set `is_private` and the minimum member flags needed for each account.
5. Obtain player TEE auth tokens from wallet-signed challenges.
6. Execute/test against the TEE ER connection.
7. Close ER permission/ephemeral accounts; commit only sanitized outputs; scrub before any secret-bearing delegated account is undelegated.

Do not use the older “create/delegate a permission account on L1” flow in the same implementation. Pin exact package versions and base the program/client on a matching official example.

## 14. Magic Action settlement contract

`commit_result` uses `MagicIntentBundleBuilder` to commit the sanitized result and attach `settle_result` as a base-layer action.

`settle_result` must verify:

- the injected Magic Action escrow signer, not merely account seeds or the `#[action]` attribute;
- exact program/match/result ownership and digest;
- match is finished and result fields match the committed account;
- `SettlementMarker` for the settlement ID does not exist;
- winner is in the fixed roster;
- winner ATA owner and mint are correct;
- vault mint/authority/balance are correct;
- rating belongs to the winner and has not processed this match.

Within one Solana instruction/transaction, create the marker, transfer the SPL prize, update rating, and mark the result settled. Any CPI failure must roll back all changes. Retrying the same settlement cannot pay twice. A wallet directly invoking the handler must fail before state mutation.

## 15. Optional VRF

Core BLACKOUT may use fixed canonical spawn points assigned by roster order. Add VRF only if randomized assignment materially improves fairness.

If enabled:

- lock roster, rules, prize, and spawn set before requesting randomness;
- store the pending request/queue identity;
- validate MagicBlock’s official callback signer and original request parameters;
- consume the output once to permute public spawn/role assignments;
- treat output as public and never derive secret future positions from it;
- expose callback failure/timeout and prevent silent rerolls.

VRF is not part of the 20 Hz loop and is not required for the privacy claim.

## 16. Failure and liveness behavior

- Missing player input: apply the documented neutral input for that tick.
- Duplicate/replayed input: reject without mutation.
- Tick submitter outage: match pauses; another eligible submitter can resume within catch-up bounds.
- TEE/RPC outage: client displays paused/degraded state; no local authoritative progression.
- Result commit timeout: retry the same frozen result/settlement ID.
- Settlement action failure: no marker, payout, or rating update; retry the same result.
- Already-created marker: return idempotent/settled state without transferring.
- VRF timeout, if enabled: explicit timeout/void rule; no silent replacement output.
- Teardown failure: keep state private and retry; never undelegate unsanitized secrets to “unstick” the match.

## 17. Client and operator behavior

Recommended structure:

```text
programs/blackout/       Anchor/Rust program
app/                     React game UI and demo cockpit
packages/sdk/            PDA derivation, types, base/TEE/Router clients
crank/                   Tick and settlement worker
tests/unit/              Pure deterministic rules
tests/integration/       Local/devnet lifecycle and attacks
scripts/                 Deploy, fund, demo, attack, benchmark, reset
fixtures/                Map/rules/transcripts and expected hashes
docs/                    Architecture, threat model, evidence, submission
```

The frontend should expose four player windows plus an attack console. Keep game rendering separate from network state so prediction/interpolation cannot mutate authoritative data. Every displayed confirmed event should link to its ER signature or final Solana explorer transaction where available.

Suggested environment variables: `SOLANA_RPC_URL`, `MB_TEE_RPC_URL`, `MB_ROUTER_RPC_URL`, `PROGRAM_ID`, `PRIZE_MINT`, and local key paths for development. Provide `.env.example`; ignore real keys and tokens.

## 18. Live demo contract

The canonical 3–5 minute demo is:

1. Show program ID, devnet/TEE endpoint, four funded players, and prefunded SPL prize.
2. Start a match and move all four players with visibly responsive confirmed state.
3. Open the attacker pane and attempt raw `World`, another `PlayerView`, subscriptions, simulation, and transaction/log inspection.
4. Show that hidden coordinates are unavailable; label whether denial came from TEE ingress or the application.
5. Move an opponent into legitimate line of sight and show the derived view reveal.
6. Attempt impossible movement and replayed input; show explicit failure and unchanged state.
7. Finish the match; attempt a direct-wallet settlement and show rejection.
8. Run the Magic Action path; show SPL balance change, rating update, result, marker, and explorer transaction.
9. Attempt duplicate settlement; show no second payout.
10. Display measured p50/p95/p99 rather than advertised infrastructure latency.

## 19. Evidence and claims policy

Maintain a `docs/evidence.md` table with columns: claim, test/script, cluster/endpoint, program commit, sample count, result, artifact link, and status.

Measure separately:

- input submission → confirmed authoritative `PlayerView`;
- actual tick intervals/jitter;
- finish instruction → base-layer committed result;
- committed result → successful public settlement;
- failures/retries/timeouts.

Report p50/p95/p99, n, client region, endpoint, timestamp source, and failure count. Do not claim “sub-50 ms” unless the measured application path supports it. README labels must be **Demonstrated**, **Simulated**, or **Externally dependent**. Repository-reported figures from another project are not BLACKOUT measurements.

## 20. Project-level definition of done

BLACKOUT is done only when all conditions hold:

- Current v8 eligibility/submission rules are recorded and satisfied.
- Anchor program is reproducibly built and deployed to Solana devnet with a published program ID and commit hash.
- The real TEE devnet supports program updates over a world unreadable by players/relayer under the tested access model.
- Four clients complete a deterministic match without an authoritative off-chain game server.
- Direct and batch RPC reads, subscriptions, logs/messages, return data, simulation, wrong-wallet tokens, and public commits reveal no concealed coordinates.
- Program-derived line of sight correctly reveals and hides opponents.
- Forged movement, wrong-player view access, replay, duplicate input, and invalid tick advancement fail without mutation.
- Sanitized result commit contains no secret history.
- Direct-wallet settlement fails; valid Magic Action settlement transfers SPL prize, updates rating, and creates one marker atomically.
- Induced transfer failure rolls back every settlement effect; retry succeeds once; duplicate retry pays zero.
- At least 20 scripted clean matches pass; deterministic fixtures replay byte-for-byte; core unit/integration/property tests pass from a clean clone.
- Latency evidence reports the required percentiles and failure counts with no unmeasured performance claim.
- Demo, README, architecture, threat model, limitations, setup, explorer links, and attack transcript are complete.
- No private key, auth token, concealed state, or secret fixture is committed to git.

If the no-reader execution condition fails, BLACKOUT is **not done** and must not be submitted under this privacy claim. Follow `plan.md` and pivot to LEASH.

## 21. Rejected scope and fallback context

The ideation review compared five tracks. BLACKOUT was selected for the strongest visual proof and genuinely load-bearing ER/PER use. The private liquidation engine and PACT coordination app were rejected as weaker than Tenor. FAIRFOG’s delayed-reveal VRF construction is separate R&D; do not merge it into BLACKOUT unless sponsor-vs-colluding-player map fairness is an explicit requirement.

Fallback **LEASH** is a confidential capability/budget kernel for hostile AI-agent swarms. It uses one PER for `SecretPolicy` and `SessionLedger`, single-use permits, a Magic Action SPL payment, and a mutually exclusive L1 spent/expired marker. Pivot only if BLACKOUT’s Phase 1 access-model gate fails; do not build both products in parallel.

## 22. Primary references

- [Solana Blitz v8](https://luma.com/j13m2kqc)
- [Tenor README](https://github.com/Shaurya2k06/tenor/blob/main/README.md)
- [MagicBlock documentation index](https://docs.magicblock.gg/llms.txt)
- [PER quickstart](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart)
- [PER access control](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/access-control)
- [Ephemeral accounts](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/ephemeral-accounts)
- [Magic Actions overview](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/overview)
- [Magic Actions implementation](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/magic-actions/implementation)
- [Magic Router](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/magic-router)
- [VRF best practices](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/best-practices)

