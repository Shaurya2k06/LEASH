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
  its escrow signer and creates the terminal marker, transfers SPL funds, and
  marks the permit spent atomically.

## Account boundary

| Account | Location | Public data |
| --- | --- | --- |
| `PolicyStub` | Solana then delegated | controller and PDA metadata only |
| `SecretPolicy` | Private PER | policy hash, budget, expiry, permit nonce |
| `SessionLedger` | Private PER | agent reservation and spent total |
| `TerminalMarker` | Solana | permit digest and terminal kind only |

The first LEASH gate is narrower than BLACKOUT's failed gate: a member agent
must update its own ledger, while an authenticated sibling cannot read it by
direct or batch TEE RPC, subscriptions, transaction messages, or requested
simulation output. A successful member is intentionally allowed to read its
own private ledger. The tested lifecycle scrubs, closes permissions, and
undelegates before verifying that base RPC has no reservation bytes.
