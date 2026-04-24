# ADR-0004: Escrow State Machine Design

- **Status**: Accepted
- **Date**: 2024-04-24

## Context

An escrow contract must enforce a strict lifecycle so that funds can never be double-spent, released to the wrong party, or locked forever. The design must be auditable and easy to test.

## Decision

### States

```
Created ──fund()──► Funded ──mark_delivered()──► Delivered
   │                  │                              │
cancel()        request_refund()             approve_delivery()
   │            (after deadline)             resolve_dispute()
   ▼                  │                              │
Cancelled         Refunded ◄──resolve_dispute()──────┤
                                                      │
                                               Completed
```

| State | Meaning |
|-------|---------|
| `Created` | Escrow initialised; no funds held yet |
| `Funded` | Buyer has transferred tokens to the contract |
| `Delivered` | Seller has marked goods/services as delivered |
| `Completed` | Funds released to seller — terminal |
| `Refunded` | Funds returned to buyer — terminal |
| `Cancelled` | Buyer cancelled before funding — terminal |

### Transition rules

Every entry point reads the current state first and rejects calls that are invalid for that state, returning `EscrowError::InvalidState`. This is enforced at the top of each function before any auth check or storage mutation.

### Checks-Effects-Interactions (CEI) pattern

All token transfers happen **after** the state is updated in storage:

```rust
// Effects first
env.storage().instance().set(&State, &EscrowState::Completed);
bump_instance(&env);
// Interactions last
token::Client::new(&env, &token_contract).transfer(…);
```

This prevents re-entrancy: if the token transfer somehow triggers a re-entrant call back into the escrow, the state is already terminal and all state-guarded functions will return `InvalidState`.

### Deadline enforcement

The `deadline_ledger` is a Soroban ledger sequence number set at initialisation. It must be at least `MIN_DEADLINE_BUFFER` (100) ledgers in the future.

- `request_refund` is only valid when `env.ledger().sequence() > deadline` **and** the state is `Funded` or `Delivered`.
- There is no automatic expiry; the buyer must explicitly call `request_refund`.

### Partial release

`release_partial(amount)` allows the buyer to release a portion of funds to the seller while the escrow remains in `Funded` or `Delivered` state. The stored `Amount` is decremented; the state does not change. This enables milestone-based payments without requiring a new escrow deployment.

### Arbiter

The arbiter can call `resolve_dispute` in `Funded` or `Delivered` states to either complete or refund the escrow. The arbiter has no power in `Created`, `Completed`, `Refunded`, or `Cancelled` states.

## Consequences

- Terminal states (`Completed`, `Refunded`, `Cancelled`) are irreversible; a new contract instance must be deployed for a new escrow.
- The CEI pattern makes the contract safe against re-entrant token callbacks.
- The explicit state enum makes the lifecycle easy to audit and test exhaustively.
- Partial releases reduce the need for multiple escrow deployments in milestone scenarios.
