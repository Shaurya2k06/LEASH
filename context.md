# LEASH — coding context and system contract

This repository implements LEASH, a confidential spending-capability kernel for
hostile agent swarms. Private policy and session state run in one MagicBlock
Private Ephemeral Rollup (PER); public Solana state contains only sanitized
settlement markers.

## Product contract

LEASH gives a controller a bounded policy budget and creates private,
single-use permits for agent sessions. A permit is reserved atomically against
the policy budget, converted into a sanitized settlement receipt, and paid by
an authenticated Magic Action. The same public terminal PDA can end as
`Spent` or `Expired`, never both.

The system does not claim private LLM reasoning, private base-layer state,
protection from compromised authorized agents, or protection from TEE
censorship and traffic analysis.

## Trust boundary

Trusted or assumed:

- Solana consensus, SPL Token, and the MagicBlock TEE/PER runtime.
- The deployed program binary and deterministic account constraints.
- A transaction submitter for liveness; it cannot choose a payment outcome.

An attacker may control an agent wallet, RPC client, browser, and network
requests. They may call instructions directly, read public state, use another
TEE token, batch or subscribe to RPC, inspect transactions/logs/simulation,
replay settlement calls, or invoke the action handler directly.

Security objectives:

- Private policy, reservation, nonce, and session data never reach base-layer
  accounts, logs, messages, return data, or teardown output.
- A session member can read its own private ledger; an authenticated sibling
  cannot read it through supported direct or indirect RPC paths.
- Budget reservation is atomic and bounded; a losing concurrent attempt does
  not mutate its session.
- A failed payment leaves the receipt and reservation retryable.
- Settlement and expiry are authenticated, mutually exclusive, and replay
  safe.

PER confidentiality is TEE-backed, not a zero-knowledge proof.

## Account model

| Account | Location | Purpose |
| --- | --- | --- |
| `SecretPolicy` | Solana, then private PER | Controller, typed policy, budget, expiry, permit counter |
| `SessionLedger` | Solana, then private PER | Agent identity, reservation, nonce, spent total, state |
| `SettlementReceipt` | Solana, then private PER | Sanitized routing metadata, nonce, status; no amount or digest |
| `TerminalMarker` | Solana | One public `Spent` or `Expired` terminal state |
| `EphemeralPermission` | MagicBlock PER | Private membership and RPC visibility boundary |

Canonical seeds are `policy/controller/policy_id`,
`session/policy/agent`, `receipt/session`, and `terminal/session`.

## State and instruction rules

The controller co-signs session creation. Policy configuration is private and bounded. The policy permission includes the
controller and explicitly enrolled agents. `issue_permit` is signed by the
agent and requires a typed policy match for destination program, discriminator,
payload commitment, mint, recipient, source vault, amount, expiry, and budget.
The policy counter supplies a monotonic nonce; only the controller finalizes a
settled terminal.

The normal payment path is:

```text
Idle → Reserved → Pending receipt → Settled
                         └────────→ retry after action failure
Idle → Reserved → Expired receipt → Expired terminal
```

`settle_permit` creates a sanitized pending receipt without consuming the
reservation. `commit_settlement` attaches the authenticated SPL Magic Action
and closes the controller-bound receipt permission before publication.
The action verifies the injected escrow signer, exact vault/recipient/mint,
open terminal state, and pending receipt before transferring tokens and marking
the receipt spent. `expire_permit` refunds the reservation only after expiry;
`commit_expiry` publishes the authenticated expired terminal.

Private permissions are created only after delegation and closed before
scrubbed accounts are undelegated. No secret-bearing delegated account is
undelegated unsanitized. The configured validator is pinned in each policy,
session, and receipt delegation; arbitrary validator substitution is rejected.

## Runtime and configuration

The default deployed program is
`3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe` on MagicBlock devnet.
Defaults point to `https://rpc.magicblock.app/devnet` and
`https://devnet-tee.magicblock.app`.

Live gates require a local Solana wallet with devnet SOL:
`ANCHOR_WALLET=/absolute/path/to/wallet.json`. RPC URLs, validator, program
ID, and sample count are configurable through `.env.example`; never commit a
keypair or TEE authorization token.

## Evidence standard

Claims are labelled demonstrated, simulated, or externally dependent. The
live gate suite must cover sibling reads, direct/batch/subscription/history/
simulation leakage, settlement authentication, SPL rollback and retry,
replay, expiry/payment exclusion, and twenty concurrent private sessions
competing for one remaining budget. Transport benchmarks must not be described
as permit or action latency; each passing gate writes a machine-readable
artifact under `contracts/artifacts/`.
