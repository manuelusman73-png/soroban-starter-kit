# ADR-0003: Admin Model

- **Status**: Accepted
- **Date**: 2024-04-24

## Context

Both contracts need a privileged role that can perform sensitive operations (minting tokens, resolving disputes). The design must:

- Be simple to reason about.
- Avoid a single point of failure where possible.
- Leverage Soroban's native auth framework rather than rolling a custom signature scheme.

## Decision

### Token contract — single admin address

A single `Admin` address is stored in instance storage under `AdminKey::Admin` (defined in the shared `soroban-common` crate).

```rust
// soroban-common
pub fn try_get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AdminKey::Admin)
}

// token/src/admin.rs
pub fn require_admin(env: &Env) -> Result<Address, TokenError> {
    soroban_common::try_get_admin(env).ok_or(TokenError::NotInitialized)
}
```

The admin address is set once during `initialize` and can be a regular account or a multisig contract address — the token contract is agnostic to the type of address.

Privileged operations (mint, burn, set_admin) call `admin.require_auth()`, delegating all authentication to the Soroban host.

### Escrow contract — role-based parties, no global admin

The escrow has no "admin" in the traditional sense. Instead, three distinct roles are established at initialisation:

| Role | Stored key | Privileged operations |
|------|-----------|----------------------|
| `buyer` | `Buyer` | `fund`, `approve_delivery`, `request_refund`, `release_partial`, `cancel` |
| `seller` | `Seller` | `mark_delivered` |
| `arbiter` | `Arbiter` | `resolve_dispute` |

Each function reads the relevant address from storage and calls `.require_auth()` on it. There is no super-admin that can override all roles.

### Shared admin utilities in `soroban-common`

To avoid duplicating admin-read logic, the `soroban-common` crate exposes `get_admin` / `try_get_admin`. This is the single source of truth for the `AdminKey` enum and its storage layout.

## Consequences

- The token admin is a single address; operators who need multi-party control should deploy a multisig contract as the admin address.
- The escrow arbiter provides dispute resolution without granting blanket admin power.
- Admin transfer for the token contract must be implemented explicitly (set_admin function) — there is no implicit ownership transfer.
- Removing the admin from the token contract (setting it to a burn address) effectively makes the token immutable.
