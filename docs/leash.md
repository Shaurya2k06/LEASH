# LEASH

LEASH is the fallback confidential capability and budget kernel. BLACKOUT's
separate-crank privacy gate failed on devnet, so this repository no longer
claims a private game.

## Invariants

- One PER holds private `SecretPolicy` and per-agent `SessionLedger` accounts.
- A policy is allocated empty on Solana, delegated, permissioned on the ER,
  and configured only after it is private. No budget, policy hash, permit, or
  session data is written to a base-layer account.
- A controller can configure its policy. An agent can consume only its own
  granted permit. Sibling agents have no permission membership and cannot read
  each other's policy or ledger.
- A permit has one monotonically increasing nonce. Consumption reserves its
  amount exactly once; replay fails before mutation.
- A public `TerminalMarker` is mutually exclusive: `spent` and `expired` use
  the same PDA and cannot both be created.
- Payment is a Magic Action after a sanitized commit. The action authenticates
  its escrow signer, transfers SPL funds, creates the terminal marker, and
  marks the receipt spent atomically.
- A failed SPL action leaves the private reservation and pending receipt
  intact. After the source vault is repaired, the receipt is re-delegated and
  the same commit path can retry it; no budget is consumed until the action
  succeeds.
- Expiry refunds the private budget before an authenticated expiry action
  publishes `TerminalKind::Expired`. The receipt state blocks settlement
  before that action completes, so expiry cannot race a later payment.

## Account boundary

| Account | Location | Public data |
| --- | --- | --- |
| `SecretPolicy` | Solana then delegated | controller and PDA metadata only before private configuration |
| `SecretPolicy` | Private PER | policy hash, budget, expiry, permit nonce |
| `SessionLedger` | Private PER | agent reservation and spent total |
| `TerminalMarker` | Solana | permit digest and terminal kind only |

The first LEASH gate is narrower than BLACKOUT's failed gate: a member agent
must update its own ledger, while an authenticated sibling cannot read it by
direct or batch TEE RPC, subscriptions, transaction messages, or requested
simulation output. A successful member is intentionally allowed to read its
own private ledger. The tested lifecycle scrubs, closes permissions, and
undelegates before verifying that base RPC has no reservation bytes.

## Current demonstrated slice

From `contracts/` with a local wallet path:

```sh
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:per
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:settlement
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:expiry
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet yarn test:leash:race
SOLANA_RPC_URL=https://rpc.magicblock.app/devnet BENCHMARK_SAMPLES=100 yarn bench:leash
```

These live gates cover sibling-read denial, authenticated SPL payment,
underfunded-action rollback and retry, replay rejection, and expiry/payment
mutual exclusion, plus twenty private-session contention for one remaining
budget. The
operator client polls only public health; the relay transports already-signed
RPC payloads and has no outcome authority. The benchmark measures only
`getSlot(confirmed)` transport health, not permit/action latency.
