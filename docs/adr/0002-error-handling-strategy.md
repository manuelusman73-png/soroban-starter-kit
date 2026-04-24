# ADR-0002: Error Handling Strategy

- **Status**: Accepted
- **Date**: 2024-04-24

## Context

Soroban contracts can signal failure in two ways:

1. **`panic!`** — aborts the transaction immediately with no structured code.
2. **`contracterror` enum + `Result<T, E>`** — returns a typed, numeric error code that callers and indexers can inspect.

Contracts also need to decide how to handle unexpected missing state (keys that should always be present after initialisation).

## Decision

### Typed errors via `contracterror`

Both contracts define a dedicated error enum annotated with `#[contracterror]`:

```rust
// escrow
pub enum EscrowError { NotAuthorized=1, InvalidState=2, DeadlinePassed=3, … }

// token
pub enum TokenError { InsufficientBalance=1, InsufficientAllowance=2, Unauthorized=3, … }
```

All public entry points return `Result<(), XxxError>` so that:
- Clients receive a stable numeric code they can match on.
- Errors are visible in the contract ABI / XDR metadata.
- Tests can assert on specific error variants.

### `panic!` for programmer errors

`panic!` is reserved for conditions that indicate a bug or misuse that cannot be recovered from at runtime, e.g.:

- Deadline set in the past during `initialize` (violates a hard invariant).
- `bump()` called on an uninitialised contract.
- Missing storage keys that must exist after initialisation (`.expect("…")`).

These are not expected in normal operation and do not need a stable error code.

### `?` propagation

Internal helpers (e.g. `release_to_seller`, `refund_to_buyer`) also return `Result` and propagate errors with `?`, keeping the call chain clean.

## Consequences

- Callers get machine-readable error codes for all expected failure modes.
- The distinction between `Result` errors and panics makes the contract's invariants explicit.
- Adding a new error variant is a non-breaking ABI change (new numeric code); removing or renumbering one is breaking and must be avoided.
