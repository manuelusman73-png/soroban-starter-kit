# ADR-0001: Storage Tier Choices

- **Status**: Accepted
- **Date**: 2024-04-24

## Context

Soroban provides three storage tiers with different TTL and cost characteristics:

| Tier | TTL behaviour | Typical use |
|------|--------------|-------------|
| `instance` | Tied to the contract instance; one TTL for all keys | Small, always-needed state |
| `persistent` | Per-key TTL; survives contract upgrades | Long-lived, per-user data |
| `temporary` | Per-key TTL; automatically deleted on expiry | Short-lived, cheap scratch data |

Both the token and escrow contracts must store state that must remain accessible for the full lifetime of the contract.

## Decision

### Escrow contract
All escrow fields (`Buyer`, `Seller`, `Arbiter`, `TokenContract`, `Amount`, `Deadline`, `State`, `BuyerApproved`, `SellerDelivered`) are stored in **instance storage**.

Rationale:
- An escrow is a single, atomic agreement; all fields are always read together.
- Instance storage gives a single TTL to manage, simplifying the bump logic.
- The contract is single-use (one escrow per deployed instance), so per-key granularity of persistent storage adds no benefit.

### Token contract
- `Admin`, `TotalSupply`, and `Metadata` keys use **instance storage** — they are global, always needed, and small.
- `Balance(Address)` and `Allowance(AllowanceDataKey)` use **persistent storage** — they are per-user, potentially numerous, and must survive independently of each other.

Rationale:
- Persistent storage lets inactive balances expire without affecting the contract instance.
- Allowances carry an `expiration_ledger` field; persistent storage TTL aligns naturally with that semantic.

## TTL / Bump Strategy

Both contracts define:
```rust
const BUMP_THRESHOLD: u32 = 120_960;  // ~7 days  — bump if TTL falls below this
const BUMP_AMOUNT:    u32 = 518_400;  // ~30 days — extend to this on every write
```

`bump_instance` is called on every state-mutating function so that active contracts never expire unexpectedly.

## Consequences

- Simple, predictable TTL management for escrow (single bump call covers all state).
- Token balances can expire for dormant accounts, reducing on-chain bloat.
- Callers must periodically invoke `bump()` on long-running escrows to keep them alive.
