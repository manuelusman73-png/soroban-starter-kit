# Soroban Contract Templates — Improvement Issues

**Generated:** 2026-04-22 | **Total:** 157 issues | **Categories:** Critical (20), High Architecture (15), High Testing (10), Medium Docs (10), Medium CI (5), Medium Infra/Docker (20), Medium Deps (20), Low Code (20), Low DX (20), Low Misc (17)

---

## 🔴 Critical — Security & Safety

---

**#1: Integer Overflow in Balance Arithmetic**
- **File:** `contracts/token/src/lib.rs:104, 270`
- **Root cause:** `balance + amount` and `to_balance + amount` use plain Rust addition on `i128`. Although `i128` has a very large range, a malicious admin could mint repeatedly until overflow wraps the value to a negative number, corrupting every downstream balance check.
- **Impact:** Attacker can manufacture an arbitrarily large balance or reduce total supply to a negative value, breaking all accounting invariants.
- **Fix:** Replace every arithmetic operation on balances and total supply with `checked_add` / `checked_sub`, returning `TokenError::Overflow` (new variant) on failure. Example: `balance.checked_add(amount).ok_or(TokenError::Overflow)?`

---

**#2: Reentrancy Risk in Escrow — State Updated After External Call**
- **File:** `contracts/escrow/src/lib.rs:215–220, 240–245`
- **Root cause:** Both `release_to_seller` and `refund_to_buyer` call `token_client.transfer(...)` and only *then* update `DataKey::State`. If the token contract is malicious or calls back into the escrow, the state is still `Funded`/`Delivered` during the callback, allowing the transfer to be triggered a second time.
- **Impact:** Double-spend: the full escrow amount could be drained twice.
- **Fix:** Follow checks-effects-interactions. Set `DataKey::State` to `Completed`/`Refunded` *before* calling `token_client.transfer`. This is safe because Soroban reverts all state on panic, so a failed transfer will roll back the state write too.

---

**#3: Allowance Expiration Not Enforced in `transfer_from`**
- **File:** `contracts/token/src/lib.rs:222–240`
- **Root cause:** `approve` stores an `expiration_ledger` via `extend_ttl`, but `transfer_from` only checks the stored amount — it never reads or validates the expiration ledger. Temporary storage TTL and the logical expiration are two different things; TTL expiry removes the key, but if the key still exists the amount is used regardless of whether the logical deadline has passed.
- **Impact:** A spender can use an allowance that the owner intended to expire, enabling unauthorized transfers after the approval window.
- **Fix:** Store `(amount, expiration_ledger)` as a struct in temporary storage. In `transfer_from`, read both fields and assert `env.ledger().sequence() <= expiration_ledger`, returning `TokenError::AllowanceExpired` otherwise.

---

**#4: `panic!` Used Instead of Returning `TokenError` for Negative Amounts**
- **File:** `contracts/token/src/lib.rs:98, 127, 263`
- **Root cause:** Three separate locations call `panic!("Amount must be non-negative")` when `amount < 0`. Panics in Soroban abort the entire invocation with an opaque host error rather than a typed contract error, making it impossible for callers to distinguish this failure from other panics.
- **Impact:** Callers cannot programmatically detect and handle this error; tooling and indexers cannot decode the failure reason; the error message is lost on-chain.
- **Fix:** Add `TokenError::InvalidAmount = 6`. Replace all three `panic!` calls with `return Err(TokenError::InvalidAmount)`. Also add a corresponding check in `burn` for `amount == 0` (burning zero is a no-op that wastes gas).

---

**#5: Missing Storage TTL Extension — Data Can Expire Mid-Lifecycle**
- **File:** Both contracts, all `env.storage().instance().set(...)` and `env.storage().persistent().set(...)` calls
- **Root cause:** Soroban storage entries have a time-to-live (TTL) measured in ledgers. Neither contract calls `extend_ttl` after writes or reads. Instance storage defaults to a short TTL; persistent storage has a longer default but still expires. A long-lived escrow (e.g., 6-month deadline) will have its storage expire before the deadline is reached.
- **Impact:** All contract state — balances, escrow parties, deadlines — silently disappears. Funds become permanently inaccessible.
- **Fix:** After every write to instance and persistent storage, call `env.storage().instance().extend_ttl(min, max)` and `env.storage().persistent().extend_ttl(&key, min, max)` with appropriate ledger counts. Add a public `bump` function that anyone can call to extend TTL on active escrows.

---

**#6: Escrow Deadline Validation Uses `<=` — Same-Ledger Deadline Allowed**
- **File:** `contracts/escrow/src/lib.rs:67`
- **Root cause:** The check `if deadline_ledger <= env.ledger().sequence()` rejects deadlines strictly in the past but allows `deadline_ledger == env.ledger().sequence()`, meaning the escrow expires in the same ledger it is created. The buyer would fund an escrow that is already past its deadline.
- **Impact:** Buyer funds are immediately refundable by themselves (or anyone who calls `request_refund`) in the same block, making the escrow useless and potentially exploitable in a sandwich attack.
- **Fix:** Change to `if deadline_ledger < env.ledger().sequence() + MIN_DEADLINE_BUFFER` where `MIN_DEADLINE_BUFFER` is a constant (e.g., 100 ledgers ≈ 8 minutes) to ensure a meaningful escrow window.

---

**#7: `admin()` and Metadata Getters Panic on Uninitialized Contract**
- **File:** `contracts/token/src/lib.rs:155, 162, 169, 176`
- **Root cause:** `admin()`, `name()`, `symbol()`, and `decimals()` all call `.unwrap()` on storage reads. If the contract has not been initialized, these return `None` and the unwrap panics with a host error.
- **Impact:** Any external contract or frontend that calls these before initialization gets an opaque panic instead of a meaningful error. This also makes it impossible to detect uninitialized state programmatically.
- **Fix:** Return `Result<T, TokenError>` from each getter, mapping `None` to `TokenError::NotInitialized`. Or add a separate `is_initialized() -> bool` helper.

---

**#8: `get_escrow_info` and `get_state` Panic on Uninitialized Escrow**
- **File:** `contracts/escrow/src/lib.rs:195–210, 218`
- **Root cause:** `get_escrow_info` calls `.unwrap()` on every storage read. `get_state` uses `unwrap_or(EscrowState::Created)`, which silently returns `Created` even when the contract was never initialized — masking the uninitialized state.
- **Impact:** `get_state` returning `Created` on an uninitialized contract could mislead callers into thinking an escrow exists and is in the `Created` state, potentially triggering downstream logic incorrectly.
- **Fix:** Return `Result<..., EscrowError>` from `get_escrow_info`. Change `get_state` to return `Option<EscrowState>` or `Result<EscrowState, EscrowError>` and remove the `unwrap_or` default.

---

**#9: No Validation That Buyer, Seller, and Arbiter Are Distinct Addresses**
- **File:** `contracts/escrow/src/lib.rs:55–80`
- **Root cause:** `initialize` accepts `buyer`, `seller`, and `arbiter` without checking they are three different addresses. A malicious actor could set `arbiter == seller`, giving the seller unilateral power to resolve the dispute in their own favor without the buyer's consent.
- **Impact:** The arbiter role — intended as a neutral third party — is meaningless if it equals one of the trading parties. The entire dispute resolution mechanism is bypassed.
- **Fix:** Add assertions: `require!(buyer != seller)`, `require!(buyer != arbiter)`, `require!(seller != arbiter)`, returning `EscrowError::InvalidParties` (new variant) on failure.

---

**#10: No Validation That Escrow Amount Is Greater Than Zero**
- **File:** `contracts/escrow/src/lib.rs:55`
- **Root cause:** `initialize` accepts any `i128` for `amount`, including zero and negative values. A zero-amount escrow is a no-op that wastes storage. A negative amount would cause the token transfer in `fund` to fail with an opaque error from the token contract rather than a clear escrow-level error.
- **Impact:** Confusing failures, wasted storage, and potential for griefing by creating many zero-amount escrows.
- **Fix:** Add `if amount <= 0 { return Err(EscrowError::InvalidAmount) }` at the start of `initialize`.

---

**#11: `transfer_from` Uses `panic!` Instead of Returning Error**
- **File:** `contracts/token/src/lib.rs:228`
- **Root cause:** `if allowance < amount { panic!("Insufficient allowance") }` — same class of problem as #4. The `TokenError::InsufficientAllowance` variant already exists but is never used here.
- **Impact:** Callers cannot catch this as a typed error. The existing `InsufficientAllowance` error code is dead code.
- **Fix:** Replace `panic!` with `return Err(TokenError::InsufficientAllowance)`. Since `transfer_from` is part of the `token::Interface` trait which returns `()`, the function signature must be changed or the error must be converted to a panic via a helper — but the idiomatic Soroban approach is to use `panic_with_error!(&env, TokenError::InsufficientAllowance)` which emits a typed, decodable error.

---

**#12: `transfer` Silently Unwraps `transfer_impl` Result**
- **File:** `contracts/token/src/lib.rs:218`
- **Root cause:** `Self::transfer_impl(env, from, to, amount).unwrap()` — if `transfer_impl` returns `Err(TokenError::InsufficientBalance)`, the `.unwrap()` converts it to a panic, discarding the typed error.
- **Impact:** Same as above — callers and indexers cannot decode the failure reason.
- **Fix:** Use `panic_with_error!(&env, e)` in a match arm, or restructure `transfer` to propagate the error properly.

---

**#13: No Authorization Check in `fund` Before State Read**
- **File:** `contracts/escrow/src/lib.rs:90–110`
- **Root cause:** `fund` reads state and the buyer address from storage, then calls `buyer.require_auth()`. The auth check comes *after* two storage reads. While not a direct exploit, it means unauthenticated callers can probe contract state (state, buyer address) without paying auth costs.
- **Impact:** Minor information leak; inconsistent with the pattern used in other functions.
- **Fix:** Move `buyer.require_auth()` to the top of the function, before any storage reads, consistent with Soroban best practices.

---

**#14: `resolve_dispute` Can Be Called Without a Formal Dispute Being Raised**
- **File:** `contracts/escrow/src/lib.rs:160–180`
- **Root cause:** The arbiter can call `resolve_dispute` at any time while the escrow is in `Funded` or `Delivered` state — no dispute needs to have been formally raised by either party. The `Disputed` state variant exists in `EscrowState` but is never set.
- **Impact:** The arbiter can unilaterally redirect funds at any time, even when both parties are satisfied. This is a trust violation and makes the `Disputed` state dead code.
- **Fix:** Add a `raise_dispute` function callable by buyer or seller that transitions state to `Disputed`. Restrict `resolve_dispute` to only work when state is `Disputed`.

---

**#15: No Check That Token Contract Address Is a Valid Contract**
- **File:** `contracts/escrow/src/lib.rs:55`
- **Root cause:** `token_contract` is stored as-is without any validation. If a non-contract address (e.g., a regular account) is passed, the `token::Client::new` call in `fund` will fail with an opaque host error.
- **Impact:** Funds can never be deposited; the escrow is permanently broken with no recovery path.
- **Fix:** Attempt a read-only call (e.g., `token::Client::new(&env, &token_contract).decimals()`) during `initialize` to verify the address is a valid token contract, returning `EscrowError::InvalidTokenContract` on failure.

---

**#16: Allowance Storage Uses Temporary Storage — Survives Ledger Gaps Unexpectedly**
- **File:** `contracts/token/src/lib.rs:196–210`
- **Root cause:** Allowances are stored in `env.storage().temporary()`. Temporary storage is designed for short-lived data and is archived (not deleted) after TTL. The `extend_ttl` call uses `expiration_ledger` as both the `min_ttl` and `max_ttl` argument, which is semantically incorrect — `extend_ttl` takes a *duration* (number of ledgers), not an absolute ledger number.
- **Impact:** Allowances may expire far sooner or later than intended. The TTL extension logic is broken.
- **Fix:** Compute the duration: `let ttl = expiration_ledger.saturating_sub(env.ledger().sequence()); env.storage().temporary().extend_ttl(&key, ttl, ttl);`

---

**#17: No Maximum Supply Cap on Token**
- **File:** `contracts/token/src/lib.rs:88`
- **Root cause:** `mint` has no upper bound on total supply. An admin (or a compromised admin key) can mint an unlimited number of tokens, inflating supply to `i128::MAX`.
- **Impact:** Unlimited inflation destroys token value. For governance tokens, it allows an attacker who gains admin access to mint enough tokens to take over any vote.
- **Fix:** Add an optional `max_supply: Option<i128>` parameter to `initialize`, stored in instance storage. In `mint`, check `total_supply + amount <= max_supply` before proceeding.

---

**#18: `set_admin` Has No Two-Step Confirmation**
- **File:** `contracts/token/src/lib.rs:140`
- **Root cause:** Admin transfer is immediate — the current admin calls `set_admin(new_admin)` and the change takes effect instantly. If the wrong address is passed (typo, copy-paste error), admin access is permanently lost with no recovery.
- **Impact:** Irreversible loss of admin access if the wrong address is provided.
- **Fix:** Implement a two-step transfer: `propose_admin(new_admin)` stores a pending admin; `accept_admin()` must be called by the new admin to confirm. This ensures the new admin address is valid and controlled.

---

**#19: No Event Emitted When Allowance Is Consumed in `transfer_from`**
- **File:** `contracts/token/src/lib.rs:222–240`
- **Root cause:** When `transfer_from` reduces an allowance, it emits a `transfer` event but no `approval` event reflecting the updated (reduced) allowance. Off-chain indexers tracking allowances will have stale data.
- **Impact:** Wallets and DeFi protocols that rely on events to track allowance state will show incorrect remaining allowances.
- **Fix:** After updating the allowance in storage, emit an `approve` event with the new remaining amount: `env.events().publish((Symbol::new(&env, "approve"), from, spender), allowance - amount)`.

---

**#20: `burn` Does Not Require Authorization From Token Holder**
- **File:** `contracts/token/src/lib.rs:115`
- **Root cause:** `burn(from, amount)` only requires admin authorization. The holder of the tokens (`from`) is not required to sign. An admin can burn any user's tokens without their consent.
- **Impact:** Admin can destroy any user's tokens unilaterally. This is a significant trust assumption that is not documented and violates the principle of least privilege.
- **Fix:** Either (a) require both `admin.require_auth()` and `from.require_auth()` for admin-initiated burns, or (b) add a separate `burn_self(amount)` that only requires the caller's auth and remove admin's ability to burn others' tokens. Document whichever design is chosen.


---

## 🟠 High Priority — Architecture & Code Quality

---

**#21: Inconsistent Error Handling — Mix of `Result` and `panic!`**
- **File:** Both contracts
- **Root cause:** Some functions return `Result<(), Error>` while others call `panic!` for the same class of problem. For example, `mint` returns `Err(TokenError::NotInitialized)` for a missing admin but `panic!` for a negative amount. The existing `InsufficientAllowance` variant is never used — `transfer_from` panics instead.
- **Impact:** Callers must handle both typed errors and opaque panics. Automated testing is harder because panics require `#[should_panic]` while errors require `assert_eq!(result, Err(...))`. Off-chain tooling cannot decode panic reasons.
- **Fix:** Establish a rule: all user-facing errors return `Result<T, ContractError>`. Use `panic_with_error!(&env, e)` (which emits a typed, decodable error) as the bridge for trait methods that return `()`. Audit every `panic!` and `unwrap()` and replace with typed errors.

---

**#22: No Emergency Pause Mechanism**
- **File:** Both contracts
- **Root cause:** Neither contract has a way to halt operations in an emergency (discovered exploit, compromised admin key). Once deployed, all functions remain callable indefinitely.
- **Impact:** If a vulnerability is discovered post-deployment, there is no way to stop the bleeding while a fix is prepared. Funds can continue to be drained.
- **Fix:** Add a `paused: bool` flag in instance storage. Add `pause()` and `unpause()` restricted to admin. Add a `require_not_paused(&env)` guard at the top of every state-mutating function. Emit `Paused`/`Unpaused` events.

---

**#23: No Contract Upgrade Path**
- **File:** Both contracts
- **Root cause:** There is no versioning or upgrade mechanism. Soroban supports contract upgrades via `env.deployer().update_current_contract_wasm(new_wasm_hash)`, but neither contract implements this.
- **Impact:** Any bug discovered post-deployment requires deploying a new contract at a new address, migrating all state manually, and updating all integrations. This is operationally expensive and error-prone.
- **Fix:** Add `upgrade(new_wasm_hash: BytesN<32>)` restricted to admin. Add `version() -> u32` returning a compile-time constant. Document the upgrade procedure and state migration strategy.

---

**#24: Arbiter Has Unconstrained Power — No Dispute Initiation Required**
- **File:** `contracts/escrow/src/lib.rs:160`
- **Root cause:** The arbiter can call `resolve_dispute` at any time while the escrow is `Funded` or `Delivered` — no dispute needs to have been formally raised. The `Disputed` state variant exists but is never set anywhere in the contract.
- **Impact:** The arbiter is effectively a second admin who can redirect funds at will, defeating the purpose of the two-party escrow model. The `Disputed` state is dead code.
- **Fix:** Add `raise_dispute()` callable by buyer or seller. Transition to `Disputed` state. Restrict `resolve_dispute` to `Disputed` state only. Add a dispute timeout after which the buyer can auto-refund if the arbiter is unresponsive.

---

**#25: `get_escrow_info` Returns a Tuple — Fragile and Hard to Use**
- **File:** `contracts/escrow/src/lib.rs:185`
- **Root cause:** Returns `(Address, Address, Address, Address, i128, u32, EscrowState)` — a 7-element positional tuple. Callers must remember the exact order. Adding or reordering fields is a breaking change with no compile-time safety.
- **Impact:** Integration code is brittle. A future field addition breaks all existing callers silently if positions shift.
- **Fix:** Define `#[contracttype] pub struct EscrowInfo { buyer, seller, arbiter, token_contract, amount, deadline, state }` and return that instead.

---

**#26: Redundant Storage Reads — Admin Fetched Multiple Times Per Call**
- **File:** `contracts/token/src/lib.rs:88, 115, 140`
- **Root cause:** `mint`, `burn`, and `set_admin` each independently read `DataKey::Admin` from instance storage. In `transfer_impl`, `balance_of` is called twice for the recipient (once to read, once implicitly via the set).
- **Impact:** Unnecessary compute unit consumption increases transaction fees for users.
- **Fix:** Read admin once at the top of each function and reuse the local variable. In `transfer_impl`, read both balances before writing either.

---

**#27: Monolithic `lib.rs` Files — All Logic in One File**
- **File:** `contracts/token/src/lib.rs`, `contracts/escrow/src/lib.rs`
- **Root cause:** All types, storage keys, errors, events, and business logic are in a single file (~285 lines each). As the contract grows, this becomes unmaintainable.
- **Impact:** Hard to navigate, review, and test individual components. PRs touching the file create merge conflicts.
- **Fix:** Split into modules: `src/storage.rs` (DataKey, read/write helpers), `src/errors.rs`, `src/events.rs`, `src/admin.rs`, `src/lib.rs` (public interface only).

---

**#28: No Shared Utilities Between Contracts**
- **File:** Both contracts
- **Root cause:** Both contracts independently implement admin management, TTL extension patterns, and error handling. Common patterns are duplicated with no shared crate.
- **Impact:** Bug fixes must be applied in two places. Divergence between contracts over time.
- **Fix:** Create a `contracts/common` workspace crate with shared admin helpers, storage utilities, and TTL management. Both contracts depend on it.

---

**#29: No `burn_from` Function (Burn via Allowance)**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** The token implements `transfer_from` (spend via allowance) but has no `burn_from`. DeFi protocols (AMMs, lending) commonly need to burn tokens from a user's balance using an allowance.
- **Impact:** Protocols must use a two-step workaround (transfer to a burn address) instead of a clean burn, wasting gas and adding complexity.
- **Fix:** Add `burn_from(env, spender, from, amount)` that checks and decrements the allowance, then burns from `from`'s balance, updating total supply.

---

**#30: No Partial Release in Escrow**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** The escrow only supports releasing or refunding the full `amount`. Real-world escrows often need partial releases (e.g., milestone payments).
- **Impact:** The contract cannot model common payment structures, limiting its usefulness as a template.
- **Fix:** Add `release_partial(amount: i128)` callable by buyer, which transfers `amount` to seller and reduces the stored `amount`. Full release completes the escrow.

---

**#31: No Escrow Cancellation in `Created` State**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** Once initialized, an escrow in `Created` state cannot be cancelled. The buyer cannot back out before committing funds.
- **Impact:** Storage is permanently occupied by an unfunded escrow. The buyer cannot back out of a bad deal before committing funds.
- **Fix:** Add `cancel()` callable by buyer when state is `Created`. Transition to a new `Cancelled` state.

---

**#32: `EscrowState::Disputed` Is Defined But Never Used**
- **File:** `contracts/escrow/src/lib.rs:30`
- **Root cause:** The `Disputed` variant exists in the enum but no function ever sets the state to `Disputed`. This is dead code.
- **Impact:** Confusion for developers reading the code; dead code increases WASM size marginally.
- **Fix:** Either implement the dispute flow (see #24) or remove the variant until it is needed.

---

**#33: `BuyerApproved` and `SellerDelivered` Storage Keys Are Never Read**
- **File:** `contracts/escrow/src/lib.rs:25–26`
- **Root cause:** `DataKey::BuyerApproved` and `DataKey::SellerDelivered` are written but never read anywhere in the contract. This information is already encoded in `EscrowState`.
- **Impact:** Dead storage writes waste compute units on every state transition.
- **Fix:** Remove `BuyerApproved` and `SellerDelivered` from `DataKey` and all associated `set` calls.

---

**#34: `approve` Does Not Validate `expiration_ledger` Is in the Future**
- **File:** `contracts/token/src/lib.rs:200`
- **Root cause:** `approve` accepts any `expiration_ledger` value, including values in the past. The `if expiration_ledger > env.ledger().sequence()` check only gates the `extend_ttl` call — it does not reject the approval.
- **Impact:** Silent creation of useless or immediately-expired allowances.
- **Fix:** Return an error if `expiration_ledger <= env.ledger().sequence()`. Require a minimum expiration window.

---

**#35: `extend_ttl` Arguments Are Semantically Wrong**
- **File:** `contracts/token/src/lib.rs:207`
- **Root cause:** `env.storage().temporary().extend_ttl(&key, expiration_ledger, expiration_ledger)` passes an absolute ledger number as both `min_ttl` and `max_ttl`. The `extend_ttl` API takes a *duration* (number of ledgers from now), not an absolute ledger number. For example, if the current ledger is 1000 and `expiration_ledger` is 1100, the TTL is set to 1100 ledgers from now (not 100).
- **Impact:** Allowances expire far later than intended, potentially persisting for years.
- **Fix:** Compute the duration: `let ttl = expiration_ledger.saturating_sub(env.ledger().sequence()); env.storage().temporary().extend_ttl(&key, ttl, ttl);`

---

## 🟠 High Priority — Testing

---

**#36: No Tests for Event Emission**
- **File:** Both test files
- **Root cause:** Every test verifies state changes but none verify that the correct events were emitted with the correct data. Soroban's test environment provides `env.events().all()` for this purpose.
- **Impact:** Event regressions go undetected. Off-chain indexers and frontends that depend on events break silently.
- **Fix:** After every state-mutating operation in tests, call `env.events().all()` and assert the expected event topics and data.

---

**#37: No Tests for Storage TTL Expiry**
- **File:** Both test files
- **Root cause:** No test advances the ledger sequence past the storage TTL and verifies behavior. This is critical given the TTL bugs identified in #5.
- **Impact:** TTL-related bugs (data expiry, broken TTL extension) are not caught by the test suite.
- **Fix:** Add tests that use `env.ledger().with_mut(|l| l.sequence_number += LARGE_NUMBER)` to simulate TTL expiry and verify the contract handles it gracefully.

---

**#38: No Tests for Allowance Expiration**
- **File:** `contracts/token/src/test.rs`
- **Root cause:** `test_approve_and_transfer_from` sets an expiration but never advances the ledger past it to verify the allowance is rejected after expiry.
- **Impact:** The allowance expiration bug (#3) is not caught by tests.
- **Fix:** Add `test_expired_allowance` that approves with a short expiration, advances the ledger past it, and asserts `transfer_from` fails.

---

**#39: No Tests for Unauthorized Access**
- **File:** Both test files
- **Root cause:** All tests use `env.mock_all_auths()` which bypasses all authorization checks. There are no tests that verify unauthorized callers are rejected.
- **Impact:** Authorization bugs (e.g., a non-admin calling `mint`) would not be caught.
- **Fix:** Add tests without `mock_all_auths()` that attempt privileged operations from non-admin addresses and assert they fail.

---

**#40: No Tests for Invalid State Transitions**
- **File:** `contracts/escrow/src/test.rs`
- **Root cause:** Tests only cover the happy path. No test verifies that invalid transitions are rejected (e.g., calling `mark_delivered` when state is `Created`, or `fund` when already `Funded`).
- **Impact:** State machine bugs go undetected.
- **Fix:** Add a test matrix covering every invalid state transition and asserting `EscrowError::InvalidState` is returned.

---

**#41: No Tests for Zero and Boundary Amounts**
- **File:** Both test files
- **Root cause:** Tests use fixed amounts (1000, 300, 200) with no boundary testing. Zero amounts, `i128::MAX`, and negative values are never tested.
- **Impact:** Edge case bugs (overflow, zero-amount no-ops, negative amounts) are not caught.
- **Fix:** Add tests for `amount = 0`, `amount = 1`, `amount = i128::MAX`, and `amount = -1`.

---

**#42: No Integration Test Between Token and Escrow Contracts**
- **File:** Project root
- **Root cause:** Escrow tests use a mock address for the token contract. There is no test that deploys both contracts and exercises the full flow end-to-end.
- **Impact:** Integration bugs between the two contracts are not caught. The escrow's token transfer logic is never actually tested.
- **Fix:** Create `tests/integration.rs` that deploys both `TokenContract` and `EscrowContract`, mints tokens to the buyer, and runs the full escrow lifecycle.

---

**#43: Escrow Tests Use Mock Token Address — Fund/Release Path Untested**
- **File:** `contracts/escrow/src/test.rs`
- **Root cause:** Tests pass `Address::generate(&env)` as the token contract. The actual token transfer in `fund`, `release_to_seller`, and `refund_to_buyer` is never exercised against a real token contract.
- **Impact:** False confidence. The core fund/release token transfer path is completely untested.
- **Fix:** Deploy a real token contract (or use `soroban_sdk::token::StellarAssetClient`) in escrow tests.

---

**#44: No Fuzz / Property-Based Tests**
- **File:** Both test files
- **Root cause:** All tests use hardcoded inputs. Property-based testing would generate thousands of random inputs and find edge cases that manual tests miss.
- **Impact:** Edge cases in arithmetic, state transitions, and input validation are not systematically explored.
- **Fix:** Add `proptest` as a dev dependency. Write properties such as: "for any valid mint followed by burn of the same amount, balance returns to original" and "total supply always equals sum of all balances."

---

**#45: No Benchmark / Gas Usage Tests**
- **File:** Both contracts
- **Root cause:** There are no benchmarks measuring compute unit consumption for each operation. Soroban charges fees based on compute units.
- **Impact:** Gas regressions go undetected. Users may be surprised by high fees.
- **Fix:** Add a `benches/` directory with criterion benchmarks. Measure and document the compute unit cost of each public function. Add a CI check that fails if costs exceed defined thresholds.

---

## 🟡 Medium Priority — Documentation

---

**#46: No Architecture Decision Records (ADRs)**
- **File:** `docs/`
- **Root cause:** Key design decisions (why instance vs. persistent storage, why admin-only burn, why tuple return from `get_escrow_info`) are not documented anywhere.
- **Impact:** New contributors cannot understand *why* the code is structured as it is, leading to repeated debates and inconsistent changes.
- **Fix:** Create `docs/adr/` directory. Write ADRs for: storage tier choices, error handling strategy, admin model, escrow state machine design.

---

**#47: No Security Considerations Document**
- **File:** `docs/`
- **Root cause:** There is no document explaining the trust model, known limitations, and threat model for each contract.
- **Impact:** Developers deploying these contracts in production don't know what security assumptions they are making.
- **Fix:** Create `docs/security.md` covering: admin key management, reentrancy considerations, storage expiry risks, arbiter trust model, and recommended audit steps before mainnet deployment.

---

**#48: Missing `# Errors`, `# Panics`, `# Examples` in Doc Comments**
- **File:** Both contracts
- **Root cause:** Some functions have doc comments but none include `# Errors`, `# Panics`, or `# Examples` sections. Functions like `transfer_impl`, `balance_of`, `release_to_seller`, and `refund_to_buyer` have no docs at all.
- **Impact:** `cargo doc` generates incomplete documentation. Developers integrating the contract have no reference for error conditions.
- **Fix:** Add complete rustdoc to every `pub fn` and `pub` type, including `# Arguments`, `# Returns`, `# Errors`, and `# Panics` sections.

---

**#49: No Gas Cost Documentation**
- **File:** `docs/`
- **Root cause:** There is no documentation of the approximate compute unit cost for each operation.
- **Impact:** Integrators cannot estimate transaction costs. Users are surprised by fees.
- **Fix:** Add `docs/gas-costs.md` with a table of measured compute unit costs for each function, updated with each release.

---

**#50: Deploy Scripts Use Deprecated `soroban` CLI Instead of `stellar`**
- **File:** `contracts/token/scripts/deploy.sh`, `contracts/escrow/scripts/deploy.sh`
- **Root cause:** Contract-level scripts use `soroban contract build` and `soroban contract deploy`, but the CLI was renamed to `stellar`. The root `scripts/deploy.sh` correctly uses `stellar`, creating inconsistency.
- **Impact:** Developers following the contract-level scripts get `command not found: soroban` errors.
- **Fix:** Update all scripts to use `stellar contract build` and `stellar contract deploy` consistently.

---

**#51: No `CONTRIBUTING.md`**
- **File:** Project root
- **Root cause:** No contribution guide explaining how to set up the dev environment, run tests, submit PRs, or follow code style.
- **Impact:** External contributors don't know how to contribute effectively.
- **Fix:** Create `CONTRIBUTING.md` covering: prerequisites, dev setup, test commands, PR process, code style, and commit message format.

---

**#52: No `CHANGELOG.md`**
- **File:** Project root
- **Root cause:** No changelog exists. There is no record of what changed between versions.
- **Impact:** Users upgrading cannot determine what changed, what broke, or what was fixed.
- **Fix:** Create `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) format.

---

**#53: No Vulnerability Disclosure Policy**
- **File:** Project root
- **Root cause:** No `SECURITY.md`. Security researchers don't know how to report vulnerabilities.
- **Impact:** Vulnerabilities may be disclosed publicly before a fix is available, putting deployed contracts at risk.
- **Fix:** Create `SECURITY.md` with a responsible disclosure process, contact email, and expected response timeline.

---

**#54: Stray `/// script` Comment in Escrow `lib.rs`**
- **File:** `contracts/escrow/src/lib.rs:6`
- **Root cause:** Line 6 contains ` /// script` — an apparent copy-paste artifact. It appears as a doc comment attached to the `use` statement.
- **Impact:** Confusing to readers; generates a spurious doc comment in `cargo doc` output.
- **Fix:** Remove the ` /// script` line.

---

**#55: `README.md` Does Not Document Error Codes**
- **File:** `README.md`
- **Root cause:** The README describes features but does not list or explain the error codes that each contract can return. Integrators must read the source to understand failure modes.
- **Impact:** Poor developer experience for integrators.
- **Fix:** Add an "Error Reference" section listing each error code, its numeric value, and when it is returned.

---

## 🟡 Medium Priority — CI/CD

---

**#56: CI Pipeline Has No Rust Steps**
- **File:** `.github/workflows/ci.yml`
- **Root cause:** The entire CI workflow consists of Node.js steps (npm ci, TypeScript check, lint, vitest, vite build). There are no steps to build or test the Rust contracts. The contracts could be completely broken and CI would still pass.
- **Impact:** Contract regressions are never caught in CI. The CI gives false confidence.
- **Fix:** Add a `contracts` job: `rustup target add wasm32-unknown-unknown`, `cargo test --workspace`, `cargo clippy --workspace -- -D warnings`, `cargo fmt --check`, `stellar contract build` for each contract.

---

**#57: No `cargo clippy` in CI**
- **File:** `.github/workflows/ci.yml`
- **Root cause:** Clippy is not run anywhere in CI. The contracts have several patterns clippy would flag (unnecessary clones, redundant closures, etc.).
- **Impact:** Code quality degrades over time as clippy warnings accumulate.
- **Fix:** Add `cargo clippy --workspace --all-targets -- -D warnings` to CI.

---

**#58: No `cargo fmt --check` in CI**
- **File:** `.github/workflows/ci.yml`
- **Root cause:** Rustfmt is not enforced in CI. Formatting inconsistencies accumulate.
- **Impact:** Noisy diffs, inconsistent style across contributors.
- **Fix:** Add `cargo fmt --workspace --check` to CI.

---

**#59: No `cargo audit` / Dependency Vulnerability Scanning**
- **File:** `.github/workflows/ci.yml`
- **Root cause:** No security scanning of Rust dependencies. Known vulnerabilities in transitive dependencies go undetected.
- **Impact:** Contracts may depend on crates with known CVEs.
- **Fix:** Add `cargo install cargo-audit && cargo audit` to CI. Consider adding `cargo-deny` for license and duplicate dependency checks.

---

**#60: No WASM Size Check in CI**
- **File:** `.github/workflows/ci.yml`
- **Root cause:** Soroban contracts have a maximum WASM size limit. There is no CI check to catch size regressions before deployment.
- **Impact:** A contract that exceeds the size limit will fail to deploy, discovered only at deployment time.
- **Fix:** After `stellar contract build`, add a size check: `wasm_size=$(wc -c < path/to/contract.wasm); [ $wasm_size -le 65536 ] || (echo "WASM too large"; exit 1)`.

---

## 🟡 Medium Priority — Infrastructure & Docker

---

**#61: `infra.yml` References Non-Existent `infra/` Directory**
- **File:** `.github/workflows/infra.yml`
- **Root cause:** The workflow runs `terraform -chdir=infra/terraform/envs/staging init` and `bash scripts/infra.sh compliance`, but neither `infra/` nor `scripts/infra.sh` exist in the repository.
- **Impact:** Every push to `main` that touches `infra/**` triggers a workflow that immediately fails. The compliance and plan jobs always error out.
- **Fix:** Either scaffold the missing `infra/terraform/` directory structure with at least a stub `main.tf`, or remove the `infra.yml` workflow until infrastructure code is added.

---

**#62: `infra.yml` Terraform Plan Uses `-backend=false` — State Is Never Persisted**
- **File:** `.github/workflows/infra.yml:60`
- **Root cause:** Both the `plan` and `validate` steps pass `-backend=false`, which disables remote state. The `apply` step then tries to `init` with a real backend but downloads the plan artifact that was generated without backend state.
- **Impact:** The apply step will fail because the plan was generated against a different (empty) state than what the backend holds. Infrastructure drift goes undetected.
- **Fix:** Configure a real backend (S3 + DynamoDB for AWS) in `infra/terraform/envs/staging/backend.tf`. Remove `-backend=false` from plan/validate steps. Use `terraform init -reconfigure` in CI.

---

**#63: `infra.yml` `apply` Job Downloads Plan Artifact But `init` Re-Runs Without It**
- **File:** `.github/workflows/infra.yml:95–110`
- **Root cause:** The apply job downloads the `tfplan` artifact, then runs `terraform init` again. If the init re-downloads providers, the plan hash may no longer match, causing `terraform apply tfplan` to fail with "saved plan is stale."
- **Impact:** Apply jobs fail intermittently depending on provider version availability.
- **Fix:** Pin provider versions in `required_providers`. Cache the `.terraform` directory between plan and apply using `actions/cache`. Ensure the same init flags are used in both jobs.

---

**#64: `infra.yml` `destroy` Action Is Listed as Input Option But Has No Job**
- **File:** `.github/workflows/infra.yml:20`
- **Root cause:** The `workflow_dispatch` input lists `destroy` as a valid `action` option, but there is no `destroy` job in the workflow. Selecting `destroy` silently does nothing.
- **Impact:** Operators who trigger a destroy via the UI believe it ran successfully when it did not.
- **Fix:** Add a `destroy` job gated on `github.event.inputs.action == 'destroy'` with an explicit `environment` protection rule requiring manual approval, and run `terraform destroy -auto-approve`.

---

**#65: `infra.yml` AWS Credentials Use Long-Lived Access Keys**
- **File:** `.github/workflows/infra.yml:65–70`
- **Root cause:** The workflow uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets — long-lived IAM user credentials. This is an AWS security anti-pattern.
- **Impact:** If the secrets are leaked (e.g., via a log), an attacker has persistent AWS access. Long-lived keys are not automatically rotated.
- **Fix:** Replace with OIDC-based authentication: configure an IAM OIDC provider for GitHub Actions and use `role-to-assume` in `aws-actions/configure-aws-credentials`. No long-lived keys needed.

---

**#66: `docker-compose.yml` Uses `stellar/quickstart:latest` — Non-Deterministic Builds**
- **File:** `docker/docker-compose.yml:20`
- **Root cause:** `image: stellar/quickstart:latest` pulls whatever is current at build time. The `latest` tag changes without notice.
- **Impact:** A developer who set up their environment last month may be running a different node version than a new contributor today, causing subtle RPC API differences and test failures that are hard to diagnose.
- **Fix:** Pin to a specific digest or tag, e.g., `stellar/quickstart:v0.0.5-testing`. Document the pinned version and the process for updating it.

---

**#67: `docker-compose.yml` `contracts` Service Has No Entry Point — Exits Immediately**
- **File:** `docker/docker-compose.yml:12`
- **Root cause:** The `contracts` service builds the `Dockerfile.contracts` image but specifies no `command`. The Dockerfile likely has no long-running process, so the container exits immediately after starting.
- **Impact:** `docker compose up contracts` starts and stops instantly. Developers expecting a persistent build environment are confused.
- **Fix:** Either add `command: sleep infinity` for an interactive dev container, or redesign as a one-shot build service with `restart: "no"` and document that it is run with `docker compose run contracts cargo test`.

---

**#68: `Dockerfile.contracts` Has No Multi-Stage Build — Final Image Contains Build Tools**
- **File:** `docker/Dockerfile.contracts`
- **Root cause:** The contracts Dockerfile installs Rust, the Soroban CLI, and all build dependencies in a single stage. The final image retains all build tooling.
- **Impact:** The image is unnecessarily large (likely 2–4 GB). Deploying or distributing the built WASM artifacts requires pulling the entire build environment.
- **Fix:** Use a multi-stage build: `FROM rust:latest AS builder` for compilation, then `FROM debian:slim AS runtime` copying only the compiled `.wasm` files. This reduces the final image to a few MB.

---

**#69: `docker-compose.yml` Mounts Entire Repo Into `frontend` Container**
- **File:** `docker/docker-compose.yml:8`
- **Root cause:** `volumes: - ..:/app` mounts the entire repository root into the container, including `.git`, `target/`, and `contracts/`. This exposes sensitive files and makes the container slow due to the large `target/` directory.
- **Impact:** Build performance degrades significantly. `.git` history and any secrets in `.env` are accessible inside the container.
- **Fix:** Mount only the necessary directories (e.g., `../src:/app/src`, `../public:/app/public`). Add `target/` and `.git/` to `.dockerignore`.

---

**#70: No `.dockerignore` File**
- **File:** Project root
- **Root cause:** There is no `.dockerignore` file. Every `docker build` sends the entire repository context to the Docker daemon, including `target/` (hundreds of MB of compiled artifacts), `.git/`, and `node_modules/`.
- **Impact:** Docker builds are extremely slow. The build context transfer alone can take minutes.
- **Fix:** Create `.dockerignore` with at minimum: `target/`, `.git/`, `node_modules/`, `*.md`, `docs/`, `.env`.

---

**#71: `scripts/deploy.sh` Does Not Validate Prerequisites Before Running**
- **File:** `scripts/deploy.sh`
- **Root cause:** The deploy script calls `stellar`, `cargo`, and other tools without first checking they are installed. If a tool is missing, the script fails mid-execution with a cryptic error.
- **Impact:** Partial deployments: the script may have already created on-chain state before failing, leaving the system in an inconsistent state.
- **Fix:** Add a `check_prerequisites` function at the top that verifies each required tool is in `$PATH` and exits with a clear error message if any are missing.

---

**#72: `scripts/deploy.sh` Hardcodes Network RPC URLs**
- **File:** `scripts/deploy.sh`
- **Root cause:** RPC endpoint URLs are hardcoded in the script rather than read from environment variables or a config file.
- **Impact:** When Stellar updates testnet/mainnet RPC endpoints (which has happened multiple times), every hardcoded URL must be manually updated. Scripts break silently if the old URL redirects rather than errors.
- **Fix:** Read URLs from environment variables with documented defaults: `RPC_URL=${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}`.

---

**#73: `scripts/setup.sh` Uses `curl | bash` Pattern — Supply Chain Risk**
- **File:** `scripts/setup.sh`
- **Root cause:** The setup script likely uses `curl https://... | bash` to install Rust (rustup) and the Stellar CLI. This pattern executes arbitrary remote code without verification.
- **Impact:** If the remote server is compromised or the URL is intercepted (MITM), malicious code runs with the user's privileges.
- **Fix:** Download the installer to a temp file, verify its SHA256 checksum against a pinned expected value, then execute. Document the expected checksum and how to update it.

---

**#74: `scripts/local-net.sh` Does Not Wait for Node Readiness Before Exiting**
- **File:** `scripts/local-net.sh`
- **Root cause:** The script starts the Docker container but does not poll the node's health endpoint before returning. Scripts that call `local-net.sh` then immediately try to deploy contracts against a node that is still initializing.
- **Impact:** Race condition: deploy scripts fail with connection errors when run immediately after `local-net.sh`.
- **Fix:** Add a readiness loop: `until curl -sf http://localhost:${LOCAL_RPC_PORT:-8000}/; do sleep 2; done` after starting the container.

---

**#75: `infra.yml` `compliance` Job Has No Actual Compliance Checks**
- **File:** `.github/workflows/infra.yml:35`
- **Root cause:** `bash scripts/infra.sh compliance` runs a script that does not exist. Even if it did, there are no defined compliance rules (no OPA policies, no tfsec, no checkov).
- **Impact:** The compliance job name gives false assurance. No security or policy checks are actually performed.
- **Fix:** Integrate `tfsec` or `checkov` for Terraform security scanning. Define at minimum: no public S3 buckets, encryption at rest required, no hardcoded secrets.

---

**#76: `infra.yml` Triggers on `infra/**` Path But No `infra/` Directory Exists**
- **File:** `.github/workflows/infra.yml:5`
- **Root cause:** `paths: ['infra/**', 'scripts/infra.sh']` — neither path exists. The workflow never triggers on push (only on `workflow_dispatch`), making the path filter meaningless.
- **Impact:** Misleading workflow configuration. Developers adding infrastructure files won't get automatic CI runs because the path filter matches files that don't exist yet.
- **Fix:** Either create the `infra/` directory structure or remove the path filter until it is needed.

---

**#77: No `healthcheck` for `frontend` or `contracts` Services in `docker-compose.yml`**
- **File:** `docker/docker-compose.yml`
- **Root cause:** Only `stellar-node` has a `healthcheck`. The `frontend` and `contracts` services have no health checks, so `depends_on` only waits for the container to start, not for the service to be ready.
- **Impact:** The frontend may start before the Stellar node is fully ready, causing connection errors on startup.
- **Fix:** Add a healthcheck to the `frontend` service (e.g., `curl -f http://localhost:3000/`). Use `depends_on: stellar-node: condition: service_healthy` to enforce ordering.

---

**#78: `docker-compose.yml` `cargo-cache` Volume Is Never Cleaned**
- **File:** `docker/docker-compose.yml:30`
- **Root cause:** The `cargo-cache` named volume accumulates compiled artifacts indefinitely. There is no documented process for clearing it when dependencies change.
- **Impact:** Stale cached artifacts can cause mysterious build failures after dependency updates. The volume can grow to several GB.
- **Fix:** Document `docker volume rm soroban-starter-kit_cargo-cache` as the cache-busting command. Consider using a bind mount to a local `.cargo-cache/` directory that is listed in `.gitignore` for easier management.

---

**#79: Deploy Scripts Do Not Capture or Log Contract IDs After Deployment**
- **File:** `contracts/token/scripts/deploy.sh`, `contracts/escrow/scripts/deploy.sh`
- **Root cause:** After `stellar contract deploy`, the contract ID is printed to stdout but not saved to a file or environment variable. Subsequent scripts that need the contract ID must re-run the deploy or manually copy the ID.
- **Impact:** Multi-step deployment workflows (deploy token → deploy escrow with token address) are fragile and require manual intervention.
- **Fix:** Capture the output: `CONTRACT_ID=$(stellar contract deploy ...)` and write it to a `.contract-ids` file or export it as an environment variable for downstream scripts.

---

**#80: No Smoke Test Script After Deployment**
- **File:** `scripts/`
- **Root cause:** There is no post-deployment verification script. After deploying to testnet, there is no automated way to confirm the contract is live and responding correctly.
- **Impact:** Silent deployment failures: the deploy script exits 0 but the contract may be unresponsive due to network issues or initialization errors.
- **Fix:** Add `scripts/smoke-test.sh` that calls `stellar contract invoke` on each deployed contract's read-only functions (e.g., `name`, `decimals`, `get_state`) and asserts expected return values.

---

## 🟡 Medium Priority — Dependency Management & Workspace

---

**#81: `soroban-sdk` Pinned to Major Version `21` — Minor/Patch Updates Not Locked**
- **File:** `Cargo.toml:8`
- **Root cause:** `soroban-sdk = "21"` uses a bare major version, which Cargo resolves to `>=21.0.0, <22.0.0`. Minor and patch releases are pulled in automatically on `cargo update`.
- **Impact:** A minor release of `soroban-sdk` that changes host function behavior or ABI could silently break contracts without any change to `Cargo.toml`. `Cargo.lock` pins the exact version, but only if it is committed and not regenerated.
- **Fix:** Pin to an exact version: `soroban-sdk = "=21.7.1"` (or whatever the current patch). Commit `Cargo.lock`. Document the process for intentional upgrades.

---

**#82: `Cargo.lock` Is Not Committed for a Binary/Deployable Project**
- **File:** Project root
- **Root cause:** Smart contracts are deployable artifacts — the equivalent of binaries. Cargo recommends committing `Cargo.lock` for binaries to ensure reproducible builds. The `.gitignore` may be excluding it.
- **Impact:** Two developers running `cargo build` at different times may compile against different dependency versions, producing different WASM bytecode. This breaks reproducible builds and makes audits harder.
- **Fix:** Ensure `Cargo.lock` is committed (remove it from `.gitignore` if present). Add a CI step that runs `cargo update --locked` to verify the lockfile is up to date.

---

**#83: No `[profile.release]` Optimization Settings for WASM Builds**
- **File:** `Cargo.toml`
- **Root cause:** There is no `[profile.release]` section in the workspace `Cargo.toml`. Soroban contracts benefit significantly from `opt-level = "z"` (optimize for size), `lto = true`, and `codegen-units = 1`.
- **Impact:** Release WASM binaries are larger than necessary, increasing deployment costs and potentially exceeding the WASM size limit.
- **Fix:** Add to `Cargo.toml`:
  ```toml
  [profile.release]
  opt-level = "z"
  overflow-checks = true
  debug = 0
  strip = "symbols"
  lto = true
  codegen-units = 1
  ```

---

**#84: `overflow-checks` Not Enabled in Release Profile**
- **File:** `Cargo.toml`
- **Root cause:** Rust disables integer overflow checks in release builds by default. Without `overflow-checks = true` in the release profile, arithmetic overflows silently wrap in release mode even if `checked_add` is not used everywhere.
- **Impact:** The overflow bugs identified in #1 are only caught in debug builds. Release WASM (the actual deployed artifact) silently wraps on overflow.
- **Fix:** Add `overflow-checks = true` to `[profile.release]` in `Cargo.toml`.

---

**#85: Each Contract Has Its Own `Cargo.toml` With Duplicated Dependency Declarations**
- **File:** `contracts/token/Cargo.toml`, `contracts/escrow/Cargo.toml`
- **Root cause:** Both contracts independently declare `soroban-sdk` as a dependency rather than inheriting from `[workspace.dependencies]`. The workspace already defines `soroban-sdk` but the contracts don't use `soroban-sdk.workspace = true`.
- **Impact:** When upgrading `soroban-sdk`, both files must be updated separately. Version skew between contracts is possible.
- **Fix:** In each contract's `Cargo.toml`, replace `soroban-sdk = "21"` with `soroban-sdk = { workspace = true }`.

---

**#86: No `[workspace.metadata]` License or Repository Fields Used by Contracts**
- **File:** `Cargo.toml`
- **Root cause:** The workspace `[workspace.metadata]` block defines `license` and other fields, but individual contract `Cargo.toml` files do not inherit or declare these. `cargo publish` and `cargo metadata` will show missing license info per crate.
- **Impact:** If contracts are ever published to crates.io or audited, missing metadata causes warnings and incomplete audit trails.
- **Fix:** Add `license`, `repository`, `description`, and `authors` to each contract's `Cargo.toml`, or use `[workspace.package]` inheritance (Cargo 1.64+).

---

**#87: `soroban-sdk` Feature Flags Not Explicitly Configured**
- **File:** `contracts/token/Cargo.toml`, `contracts/escrow/Cargo.toml`
- **Root cause:** `soroban-sdk` has feature flags (e.g., `testutils`) that should only be enabled in `[dev-dependencies]`, not in the main dependency. If `testutils` is enabled in the main dependency, test utilities are compiled into the production WASM.
- **Impact:** Larger WASM size; test-only code paths present in production contracts.
- **Fix:** Ensure `soroban-sdk` in `[dependencies]` has no extra features. Add `soroban-sdk = { workspace = true, features = ["testutils"] }` only under `[dev-dependencies]`.

---

**#88: No `cargo-deny` Configuration for License and Duplicate Dependency Checks**
- **File:** Project root
- **Root cause:** There is no `deny.toml` and `cargo-deny` is not run in CI. Transitive dependencies could introduce GPL-licensed crates or duplicate versions of the same crate.
- **Impact:** License compliance issues; duplicate crate versions increase WASM size and compile time.
- **Fix:** Add `deny.toml` with `[licenses]` allowing only `Apache-2.0`, `MIT`, `ISC`, and `BSD-*`. Add `[bans]` to deny duplicate versions of key crates. Run `cargo deny check` in CI.

---

**#89: Workspace Does Not Define `[workspace.lints]`**
- **File:** `Cargo.toml`
- **Root cause:** Rust 1.74+ supports `[workspace.lints]` to share lint configuration across all crates. Neither the workspace nor individual crates define lint levels.
- **Impact:** Lint configuration must be duplicated in each crate's `lib.rs` with `#![deny(...)]` attributes, or lints are inconsistent across crates.
- **Fix:** Add to `Cargo.toml`:
  ```toml
  [workspace.lints.rust]
  unsafe_code = "forbid"
  unused_must_use = "deny"
  [workspace.lints.clippy]
  all = "warn"
  ```

---

**#90: No `rust-toolchain.toml` — Rust Version Is Not Pinned**
- **File:** Project root
- **Root cause:** There is no `rust-toolchain.toml` file. The Rust version used to compile the contracts depends on whatever is installed in the developer's environment or the CI runner's default.
- **Impact:** Different Rust versions can produce different WASM bytecode. A new Rust release could introduce a regression that breaks the build. Reproducible builds are impossible without a pinned toolchain.
- **Fix:** Create `rust-toolchain.toml`:
  ```toml
  [toolchain]
  channel = "1.81.0"
  targets = ["wasm32-unknown-unknown"]
  components = ["rustfmt", "clippy"]
  ```

---

**#91: `contracts/token/Cargo.toml` and `contracts/escrow/Cargo.toml` Missing `[lib] crate-type`**
- **File:** `contracts/token/Cargo.toml`, `contracts/escrow/Cargo.toml`
- **Root cause:** Soroban contracts must be compiled as `cdylib` to produce a `.wasm` file. If `[lib] crate-type = ["cdylib", "rlib"]` is missing, `stellar contract build` may fail or produce an incorrect artifact.
- **Impact:** Build failures or incorrect WASM output when building for deployment.
- **Fix:** Verify both `Cargo.toml` files contain:
  ```toml
  [lib]
  crate-type = ["cdylib", "rlib"]
  ```
  The `rlib` target is needed for tests; `cdylib` for the deployable WASM.

---

**#92: No Dependabot or Renovate Configuration for Rust Dependencies**
- **File:** Project root
- **Root cause:** There is no `.github/dependabot.yml` or `renovate.json` configured for the Rust ecosystem. Security patches to `soroban-sdk` or transitive dependencies are not automatically surfaced.
- **Impact:** Known CVEs in dependencies go unnoticed until manually discovered.
- **Fix:** Add `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: cargo
      directory: "/"
      schedule:
        interval: weekly
  ```

---

**#93: `Cargo.toml` `[workspace.metadata]` Fields Are Non-Standard**
- **File:** `Cargo.toml`
- **Root cause:** `[workspace.metadata]` is a free-form section for tool-specific data. Using it for `name`, `description`, `authors`, and `license` is non-standard — these belong in `[workspace.package]` (Cargo 1.64+) so they can be inherited by member crates.
- **Impact:** `cargo metadata` and tooling that reads package metadata will not find these fields in the expected location.
- **Fix:** Replace `[workspace.metadata]` with `[workspace.package]` for standard fields.

---

**#94: No `[patch]` Section for Local Development Overrides**
- **File:** `Cargo.toml`
- **Root cause:** There is no documented way to use a local or forked version of `soroban-sdk` for development. Developers who need to debug SDK issues must manually edit `Cargo.toml`.
- **Impact:** Friction for contributors who need to test against unreleased SDK changes.
- **Fix:** Add a commented-out `[patch.crates-io]` example to `Cargo.toml` showing how to override `soroban-sdk` with a local path or git branch.

---

**#95: Contract `Cargo.toml` Files Have No `version` Field**
- **File:** `contracts/token/Cargo.toml`, `contracts/escrow/Cargo.toml`
- **Root cause:** If the `[package]` section lacks a `version` field, `cargo` defaults to `0.0.0`. This makes it impossible to track which version of the contract is deployed.
- **Impact:** No version tracking for deployed contracts. Audit trails are incomplete.
- **Fix:** Add `version = "0.1.0"` to each contract's `[package]` section. Increment on each breaking change.

---

**#96: No `build.rs` to Embed Git Commit Hash in Contract**
- **File:** Both contracts
- **Root cause:** There is no mechanism to embed the git commit hash or build timestamp into the compiled WASM. Once deployed, there is no way to determine which source version a contract was built from.
- **Impact:** Debugging deployed contracts is harder. Auditors cannot verify which source code corresponds to a deployed contract ID.
- **Fix:** Add a `build.rs` that reads `GIT_HASH` from the environment and exposes it via a `version() -> String` contract function, or embed it as a contract constant.

---

**#97: `Cargo.lock` Contains Duplicate Versions of Several Crates**
- **File:** `Cargo.lock`
- **Root cause:** The lockfile contains multiple versions of crates like `serde`, `serde_json`, `proc-macro2`, and `quote` (visible from the `target/debug/.fingerprint/` directory listing). This is common with complex dependency trees but should be minimized.
- **Impact:** Increased compile times and WASM binary size. Potential for subtle behavior differences if two versions of the same crate are used in the same binary.
- **Fix:** Run `cargo tree --duplicates` to identify duplicate crates. Use `[patch]` or dependency version alignment to reduce duplicates. Add `cargo deny check bans` to CI to prevent new duplicates.

---

**#98: No `[features]` for Optional Contract Functionality**
- **File:** Both contracts
- **Root cause:** Features like the pause mechanism (#22), upgrade path (#23), and max supply cap (#17) are all-or-nothing. There is no Cargo feature flag system to enable/disable optional contract features at compile time.
- **Impact:** Developers who want a minimal contract must manually edit source code rather than toggling a feature flag.
- **Fix:** Define Cargo features for optional functionality: `features = ["pausable", "upgradeable", "capped-supply"]`. Gate the corresponding code with `#[cfg(feature = "pausable")]`.

---

**#99: `contracts/token/src/bin/` and `contracts/escrow/src/bin/` Directories Are Empty**
- **File:** `contracts/token/src/bin/`, `contracts/escrow/src/bin/`
- **Root cause:** Both contracts have a `src/bin/` directory but it appears to contain no files. Empty `bin/` directories in a Rust crate are confusing and may cause `cargo` to warn about missing binary targets.
- **Impact:** Developer confusion; potential spurious cargo warnings.
- **Fix:** Remove the empty `bin/` directories, or add a `src/bin/deploy.rs` CLI tool that wraps the deployment logic currently in shell scripts.

---

**#100: No `[workspace.dependencies]` Entry for `dev-dependencies`**
- **File:** `Cargo.toml`
- **Root cause:** The workspace defines `soroban-sdk` as a shared dependency but does not define shared dev-dependencies. Each contract independently declares its test dependencies, which can diverge.
- **Impact:** Test dependency versions can differ between contracts. Adding a new test dependency requires editing multiple files.
- **Fix:** Add common dev-dependencies to `[workspace.dependencies]` (e.g., `soroban-sdk = { version = "=21.x.x", features = ["testutils"] }`) and reference them with `.workspace = true` in each contract's `[dev-dependencies]`.

---

## 🟢 Low Priority — Code Improvements

---

**#101: `balance_of` Returns `0` for Unknown Addresses — Indistinguishable From Zero Balance**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** `balance_of` returns `0` when no storage entry exists for an address. This makes it impossible to distinguish between "this address has never interacted with the contract" and "this address has a zero balance."
- **Impact:** Minor: off-chain analytics cannot distinguish new addresses from zero-balance addresses. Not a security issue.
- **Fix:** Consider returning `Option<i128>` where `None` means "never seen" and `Some(0)` means "explicitly zeroed." Or document the current behavior clearly.

---

**#102: `transfer_impl` Is a Private Function With No Doc Comment**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** `transfer_impl` contains the core transfer logic shared by `transfer` and `transfer_from`, but has no documentation explaining its preconditions, what it validates, and what it does not validate.
- **Impact:** Future contributors may add validation in one call site but forget the other, creating inconsistency.
- **Fix:** Add a doc comment to `transfer_impl` listing its preconditions (caller must have already checked auth and allowance) and what it does (balance arithmetic, event emission).

---

**#103: Magic Numbers Used for Storage TTL Values**
- **File:** Both contracts
- **Root cause:** Any TTL extension calls use inline integer literals (e.g., `extend_ttl(100, 1000)`) with no explanation of what these numbers represent in ledger time.
- **Impact:** Reviewers cannot verify whether the TTL values are appropriate. Changing them requires understanding the implicit ledger-time conversion.
- **Fix:** Define named constants: `const LEDGER_BUMP_AMOUNT: u32 = 17280; // ~1 day at 5s/ledger` and `const LEDGER_LIFETIME_THRESHOLD: u32 = 120960; // ~1 week`. Use these constants in all TTL calls.

---

**#104: `EscrowState` Enum Derives No Useful Traits**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** `EscrowState` derives only what `#[contracttype]` requires. It does not derive `PartialEq`, `Eq`, or `Debug`, making it impossible to compare states in tests without pattern matching.
- **Impact:** Test code is more verbose. `assert_eq!(state, EscrowState::Funded)` does not compile without `PartialEq`.
- **Fix:** Add `#[derive(Debug, PartialEq, Eq)]` to `EscrowState` (compatible with `#[contracttype]`).

---

**#105: `TokenError` and `EscrowError` Enums Have No `Display` Implementation**
- **File:** Both contracts
- **Root cause:** Error enums derive only `#[contracterror]` and basic traits. There is no human-readable string representation.
- **Impact:** Log messages and off-chain error reporting show numeric codes rather than descriptive names.
- **Fix:** Implement `core::fmt::Display` for each error enum, mapping each variant to a descriptive string. This is compatible with `no_std` environments.

---

**#106: `DataKey` Enum Variants Are Not Documented**
- **File:** Both contracts
- **Root cause:** `DataKey` variants (`Admin`, `Balance`, `Allowance`, `TotalSupply`, etc.) have no doc comments explaining what data they store, what type is stored, and the storage tier used.
- **Impact:** New contributors must read all usages to understand the storage layout.
- **Fix:** Add a doc comment to each `DataKey` variant: `/// Stores the admin Address in instance storage.`

---

**#107: `get_state` in Escrow Returns `EscrowState::Created` as Default — Misleading**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** `env.storage().instance().get(&DataKey::State).unwrap_or(EscrowState::Created)` returns `Created` if the key is missing, which happens both when the contract is uninitialized and when it was initialized but the state key expired.
- **Impact:** Callers cannot distinguish "not yet initialized" from "initialized and in Created state." This is a subtle correctness issue.
- **Fix:** Return `Option<EscrowState>` or `Result<EscrowState, EscrowError::NotInitialized>`. Remove the `unwrap_or` default.

---

**#108: Unused `use` Imports May Exist After Refactoring**
- **File:** Both contracts
- **Root cause:** As the contracts evolved, some `use` statements may have become unused. `cargo clippy` would catch these, but clippy is not run in CI (see #57).
- **Impact:** Minor: dead imports add noise and slightly increase compile time.
- **Fix:** Run `cargo clippy --fix` to automatically remove unused imports. Add clippy to CI to prevent recurrence.

---

**#109: `fund` Function Does Not Emit a `Funded` Event**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** `fund` transitions the escrow to `Funded` state and transfers tokens, but does not emit an event. Other state transitions (`release_to_seller`, `refund_to_buyer`) do emit events.
- **Impact:** Off-chain indexers cannot detect when an escrow is funded without polling state. Inconsistent event coverage.
- **Fix:** Add `env.events().publish((Symbol::new(&env, "funded"), buyer), amount)` at the end of the `fund` function.

---

**#110: `initialize` Functions Do Not Emit an `Initialized` Event**
- **File:** Both contracts
- **Root cause:** Neither contract emits an event when `initialize` is called. Off-chain systems cannot detect contract initialization via event subscription.
- **Impact:** Indexers must poll `get_state` or `admin()` to detect initialization rather than reacting to events.
- **Fix:** Emit an `initialized` event at the end of each `initialize` function with the key parameters (admin address for token; buyer, seller, amount for escrow).

---

**#111: `set_admin` Does Not Emit an `AdminChanged` Event**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** `set_admin` updates the admin in storage but emits no event. Off-chain systems tracking admin changes must poll storage.
- **Impact:** Admin changes are invisible to event-based monitoring systems. A compromised admin silently transferring control goes undetected.
- **Fix:** Emit `env.events().publish((Symbol::new(&env, "admin_changed"), old_admin), new_admin)`.

---

**#112: `approve` Emits No Event When Allowance Is Set to Zero (Revocation)**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** When `approve` is called with `amount = 0`, it effectively revokes the allowance. No event distinguishes a revocation from a new approval of zero.
- **Impact:** Off-chain allowance trackers cannot distinguish "approved for 0" from "revoked." Wallets may show stale non-zero allowances.
- **Fix:** Emit a distinct `revoke` event when `amount == 0`, or ensure the `approve` event with `amount = 0` is consistently emitted and documented as the revocation signal.

---

**#113: `release_to_seller` and `refund_to_buyer` Have Identical State Validation Logic**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** Both functions read state, check it is in the correct state, and return `EscrowError::InvalidState` if not. This pattern is duplicated rather than extracted into a helper.
- **Impact:** Minor duplication. If the state validation logic changes, it must be updated in two places.
- **Fix:** Extract `fn require_state(env: &Env, expected: EscrowState) -> Result<(), EscrowError>` and call it from both functions.

---

**#114: No `total_supply()` Function in Token Contract**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** The token tracks `TotalSupply` in storage (updated by `mint` and `burn`) but does not expose it as a public function. Callers cannot query the total supply.
- **Impact:** DeFi protocols and frontends that need total supply must use workarounds or read storage directly.
- **Fix:** Add `pub fn total_supply(env: Env) -> i128` that reads and returns `DataKey::TotalSupply`.

---

**#115: `transfer_impl` Does Not Check That `from != to`**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** Transferring tokens from an address to itself is a no-op that wastes gas. There is no guard against self-transfers.
- **Impact:** Minor gas waste. Some protocols use self-transfer as a signal (e.g., to trigger a callback), but this is not documented.
- **Fix:** Add `if from == to { return Ok(()); }` at the top of `transfer_impl`, or document that self-transfers are intentionally allowed.

---

**#116: Escrow `deadline_ledger` Is Stored as `u32` — Will Overflow in ~2106**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** `deadline_ledger` is stored as `u32`. Stellar ledger sequence numbers are currently in the hundreds of millions and will overflow `u32` (max ~4.3 billion) in approximately 80 years at current ledger rates.
- **Impact:** Low urgency, but contracts deployed today may still be in use when this becomes relevant. A `u64` future-proofs the design.
- **Fix:** Change `deadline_ledger: u32` to `deadline_ledger: u64` throughout. Update storage reads/writes accordingly.

---

**#117: No `#[allow(dead_code)]` or Removal of Unused `EscrowState::Disputed`**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** `EscrowState::Disputed` is defined but never constructed (see #32). The Rust compiler will emit a dead code warning for this variant.
- **Impact:** Compiler warnings in the build output. If `#![deny(warnings)]` is added to CI, this becomes a build failure.
- **Fix:** Either implement the dispute flow (preferred, see #24) or remove the variant and add a `// TODO: implement dispute flow` comment.

---

**#118: `contracts/token/src/lib.rs` Has No Module-Level Doc Comment**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** The file starts directly with `use` statements. There is no `//! Module documentation` explaining what the contract does, its design decisions, or how to use it.
- **Impact:** `cargo doc` generates a contract page with no description. New contributors have no orientation.
- **Fix:** Add a `//!` module doc comment at the top of each `lib.rs` with a brief description, key design decisions, and a usage example.

---

**#119: `contracts/escrow/src/lib.rs` Line 6 Has Stray `/// script` Comment**
- **File:** `contracts/escrow/src/lib.rs:6`
- **Root cause:** A `/// script` doc comment appears to be a copy-paste artifact attached to a `use` statement. It generates a spurious doc comment in `cargo doc` output.
- **Impact:** Confusing documentation output. Minor code quality issue.
- **Fix:** Remove the `/// script` line entirely.

---

**#120: Both Contracts Lack `#![no_std]` Attribute**
- **File:** `contracts/token/src/lib.rs`, `contracts/escrow/src/lib.rs`
- **Root cause:** Soroban contracts run in a WASM environment without the standard library. While `soroban-sdk` handles this internally, explicitly marking contracts as `#![no_std]` makes the constraint visible and prevents accidentally importing `std`-only crates.
- **Impact:** A developer could accidentally add a `std`-only dependency that compiles in tests (which run natively) but fails when building for WASM.
- **Fix:** Add `#![no_std]` at the top of each `lib.rs`. This will surface any accidental `std` usage at compile time.

---

## 🟢 Low Priority — Developer Experience

---

**#121: No `Makefile` or `justfile` for Common Tasks**
- **File:** Project root
- **Root cause:** All common tasks (build, test, deploy, format, lint) require remembering multi-argument commands. There is no task runner to simplify workflows.
- **Impact:** Steeper learning curve for new contributors. Inconsistent command usage across the team.
- **Fix:** Add a `Makefile` or `justfile` with targets: `make build`, `make test`, `make deploy-testnet`, `make fmt`, `make lint`, `make clean`.

---

**#122: No Pre-Commit Hook Configuration**
- **File:** Project root
- **Root cause:** There is no `.pre-commit-config.yaml` or git hook setup. Developers can commit code that fails CI checks (formatting, linting, tests).
- **Impact:** CI failures on trivial issues that could have been caught locally. Wasted CI minutes and developer time.
- **Fix:** Add a `.pre-commit-config.yaml` with hooks for `cargo fmt --check`, `cargo clippy`, and `cargo test`. Document installation: `pre-commit install`.

---

**#123: No `CODEOWNERS` File**
- **File:** `.github/`
- **Root cause:** There is no `CODEOWNERS` file. Pull requests are not automatically assigned reviewers based on the files changed.
- **Impact:** PRs sit unreviewed until someone manually assigns a reviewer.
- **Fix:** Create `.github/CODEOWNERS` with at minimum: `* @maintainer-username` and `contracts/ @contract-team`.

---

**#124: No Issue Templates**
- **File:** `.github/ISSUE_TEMPLATE/`
- **Root cause:** GitHub issue templates are not configured. Bug reports and feature requests have inconsistent structure.
- **Impact:** Issues lack critical information (reproduction steps, environment details), requiring back-and-forth to triage.
- **Fix:** Add `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml` with structured fields.

---

**#125: No Pull Request Template**
- **File:** `.github/`
- **Root cause:** There is no `.github/pull_request_template.md`. PRs have inconsistent descriptions.
- **Impact:** Reviewers must ask for context, test results, and breaking change notes that should have been in the PR description.
- **Fix:** Create `.github/pull_request_template.md` with sections: Description, Changes, Testing, Breaking Changes, Checklist.

---

**#126: No `examples/` Directory with Usage Examples**
- **File:** Project root
- **Root cause:** There are no runnable examples showing how to interact with the deployed contracts from a client application.
- **Impact:** Integrators must reverse-engineer the test code to understand how to call the contracts.
- **Fix:** Add `examples/token-transfer.rs` and `examples/escrow-flow.rs` demonstrating end-to-end usage with the Soroban SDK client.

---

**#127: No `scripts/clean.sh` to Remove Build Artifacts**
- **File:** `scripts/`
- **Root cause:** There is no script to clean all build artifacts (`target/`, `node_modules/`, Docker volumes, contract IDs). Developers must manually run multiple commands.
- **Impact:** Stale artifacts cause mysterious build failures. Disk space accumulates.
- **Fix:** Add `scripts/clean.sh` that runs `cargo clean`, `rm -rf node_modules/`, `docker compose down -v`, and removes any generated contract ID files.

---

**#128: No `scripts/test-all.sh` to Run All Tests (Rust + JS)**
- **File:** `scripts/`
- **Root cause:** There is no single command to run all tests. Developers must remember to run both `cargo test --workspace` and `npm test`.
- **Impact:** Developers may forget to run one test suite, causing CI failures.
- **Fix:** Add `scripts/test-all.sh` that runs both test suites and exits with a non-zero code if either fails.

---

**#129: No `docs/troubleshooting.md`**
- **File:** `docs/`
- **Root cause:** Common issues (RPC connection errors, WASM size exceeded, storage TTL expiry) are not documented with solutions.
- **Impact:** Developers repeatedly ask the same questions in issues or chat.
- **Fix:** Create `docs/troubleshooting.md` with a FAQ covering: RPC timeouts, WASM size optimization, storage expiry, and common error codes.

---

**#130: No `docs/architecture.md` Explaining Contract Design**
- **File:** `docs/`
- **Root cause:** There is no high-level architecture document explaining the design decisions, storage layout, and interaction patterns.
- **Impact:** New contributors must read all the code to understand the system design.
- **Fix:** Create `docs/architecture.md` covering: storage tier choices, state machine diagrams for escrow, token standard compliance, and upgrade strategy.

---

**#131: No `docs/testing.md` Explaining Test Strategy**
- **File:** `docs/`
- **Root cause:** There is no documentation of the test strategy, coverage goals, or how to write new tests.
- **Impact:** Contributors don't know what level of test coverage is expected or how to structure tests.
- **Fix:** Create `docs/testing.md` covering: unit vs. integration tests, how to use `soroban-sdk` test utilities, coverage goals (e.g., 80% line coverage), and how to run tests locally.

---

**#132: No `docs/deployment.md` Separate from `deployment-guide.md`**
- **File:** `docs/`
- **Root cause:** `deployment-guide.md` exists but may not cover all deployment scenarios (local, testnet, mainnet, multi-contract deployments).
- **Impact:** Incomplete deployment documentation leads to ad-hoc deployment processes.
- **Fix:** Expand `deployment-guide.md` or create a separate `docs/deployment.md` covering: environment setup, network selection, contract initialization, and post-deployment verification.

---

**#133: No `docs/api-reference.md` for Contract Functions**
- **File:** `docs/`
- **Root cause:** There is no API reference listing all public contract functions, their parameters, return types, and error codes.
- **Impact:** Integrators must read the source code or `cargo doc` output to understand the API.
- **Fix:** Generate `docs/api-reference.md` from `cargo doc` output or write it manually. Include function signatures, descriptions, and example invocations.

---

**#134: No `docs/upgrading.md` for Contract Upgrade Process**
- **File:** `docs/`
- **Root cause:** There is no documentation of how to upgrade a deployed contract (see #23 for the missing implementation).
- **Impact:** When the upgrade feature is implemented, there will be no guide for operators.
- **Fix:** Create `docs/upgrading.md` covering: when to upgrade vs. redeploy, state migration strategies, testing upgrades on testnet, and rollback procedures.

---

**#135: No `docs/security.md` Explaining Security Model**
- **File:** `docs/`
- **Root cause:** There is no document explaining the security assumptions, threat model, and recommended operational security practices.
- **Impact:** Deployers don't know what security guarantees the contracts provide or what operational practices are required.
- **Fix:** Create `docs/security.md` covering: admin key management, reentrancy protections, storage expiry risks, and recommended audit steps before mainnet deployment.

---

**#136: No `docs/contributing.md` Beyond Basic `CONTRIBUTING.md`**
- **File:** `docs/`
- **Root cause:** If `CONTRIBUTING.md` exists, it may not cover advanced topics like: how to add a new contract, how to propose a breaking change, or the release process.
- **Impact:** Contributors don't know the full contribution workflow.
- **Fix:** Expand `CONTRIBUTING.md` or create `docs/contributing.md` with sections on: adding new contracts, proposing features, the PR review process, and the release checklist.

---

**#137: No `docs/glossary.md` for Soroban-Specific Terms**
- **File:** `docs/`
- **Root cause:** Terms like "ledger sequence," "TTL," "instance storage," "persistent storage," "temporary storage," and "host function" are used throughout the docs without definition.
- **Impact:** Developers new to Soroban are confused by unfamiliar terminology.
- **Fix:** Create `docs/glossary.md` defining all Soroban-specific terms with links to official Soroban documentation.

---

**#138: No `docs/faq.md`**
- **File:** `docs/`
- **Root cause:** Frequently asked questions are not documented. Common questions (e.g., "Why is my storage expiring?", "How do I estimate gas costs?") are answered repeatedly in issues.
- **Impact:** Wasted time answering the same questions.
- **Fix:** Create `docs/faq.md` with answers to common questions. Link to it from the README.

---

**#139: No `docs/roadmap.md` or Public Roadmap**
- **File:** `docs/`
- **Root cause:** There is no public roadmap showing planned features, known limitations, and future work.
- **Impact:** Contributors don't know what features are planned or where help is needed.
- **Fix:** Create `docs/roadmap.md` listing: planned features (e.g., dispute flow, partial releases, upgrade mechanism), known limitations, and contribution opportunities.

---

**#140: No `docs/changelog.md` or `CHANGELOG.md` in Root**
- **File:** Project root
- **Root cause:** There is no changelog documenting what changed between versions (see #52).
- **Impact:** Users upgrading cannot determine what changed, what broke, or what was fixed.
- **Fix:** Create `CHANGELOG.md` in the root following [Keep a Changelog](https://keepachangelog.com) format. Add a CI check that fails if a PR modifies code without updating the changelog.

---

## 🟢 Low Priority — Miscellaneous & Future Features

---

**#141: No Multi-Sig Admin Support**
- **File:** Both contracts
- **Root cause:** Admin is a single `Address`. There is no support for multi-signature admin operations (e.g., requiring 2-of-3 admin keys to approve a mint or upgrade).
- **Impact:** A single compromised admin key can drain the token or redirect escrow funds. For high-value deployments, single-key admin is a significant risk.
- **Fix:** Add an optional multi-sig admin mode: store a list of admin addresses and a threshold. Admin operations require `threshold` of the admins to call `approve_action(action_id)` before execution.

---

**#142: No Time-Lock on Admin Operations**
- **File:** Both contracts
- **Root cause:** Admin operations (mint, set_admin, upgrade) take effect immediately. There is no delay that would allow token holders to react to a malicious admin action.
- **Impact:** A compromised admin can instantly mint unlimited tokens or transfer admin control before anyone can respond.
- **Fix:** Add an optional time-lock: admin operations are queued with a `TimelockAction` and can only be executed after `TIMELOCK_DELAY` ledgers. Add `cancel_action(action_id)` for the admin to cancel queued actions.

---

**#143: No On-Chain Governance Integration**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** The token contract has no hooks for on-chain governance (e.g., vote delegation, snapshot balances for voting). Governance tokens typically need these features.
- **Impact:** The token cannot be used for on-chain governance without significant modification.
- **Fix:** Add optional governance extensions: `delegate(to: Address)`, `get_votes(account: Address) -> i128`, and `get_past_votes(account: Address, ledger: u32) -> i128` using checkpointed balance snapshots.

---

**#144: No Escrow Fee Mechanism**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** The escrow has no fee mechanism. In production, escrow services typically charge a small fee (e.g., 0.1% of the escrow amount) to the arbiter or protocol.
- **Impact:** The contract cannot be used as a fee-generating service without modification.
- **Fix:** Add an optional `fee_bps: u32` (basis points) parameter to `initialize`. On `release_to_seller`, deduct `amount * fee_bps / 10000` and transfer it to a `fee_recipient` address.

---

**#145: No Escrow Renewal / Extension Mechanism**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** Once an escrow is created with a deadline, the deadline cannot be extended. If a delivery is delayed, the only option is to let the escrow expire and create a new one.
- **Impact:** Legitimate deadline extensions require a full escrow cycle (refund + re-fund), wasting gas and creating a window where funds are not in escrow.
- **Fix:** Add `extend_deadline(new_deadline: u32)` callable by both buyer and seller (requiring both to agree, or just the buyer). Validate the new deadline is in the future.

---

**#146: No Support for Native XLM as Escrow Token**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** The escrow only supports Soroban token contracts. Native XLM uses a different interface (`stellar_sdk::token::StellarAssetClient`). Many users will want to escrow XLM directly.
- **Impact:** Users who want to escrow XLM must first wrap it as a Soroban token, adding friction.
- **Fix:** Accept both Soroban token contracts and the native XLM asset contract. Use `soroban_sdk::token::TokenClient` which abstracts over both.

---

**#147: No Batch Transfer Function in Token Contract**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** There is no `batch_transfer` function. Sending tokens to multiple recipients requires one transaction per recipient.
- **Impact:** Airdrop operations and multi-recipient payments are expensive (one transaction per recipient).
- **Fix:** Add `batch_transfer(env, from, recipients: Vec<(Address, i128)>)` that performs multiple transfers in a single transaction, reducing total gas cost.

---

**#148: No `freeze` / `unfreeze` Account Functionality**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** There is no mechanism to freeze a specific account's ability to send or receive tokens. This is required for regulatory compliance in some jurisdictions.
- **Impact:** The token cannot be used in regulated contexts (e.g., stablecoins, security tokens) that require account freezing.
- **Fix:** Add `freeze(account: Address)` and `unfreeze(account: Address)` restricted to admin. Add a `frozen: bool` check in `transfer_impl` and `transfer_from`.

---

**#149: No `recover_tokens` Function for Accidentally Sent Tokens**
- **File:** `contracts/escrow/src/lib.rs`
- **Root cause:** If tokens are accidentally sent directly to the escrow contract address (not via `fund`), they are permanently locked. There is no recovery mechanism.
- **Impact:** User error results in permanent token loss.
- **Fix:** Add `recover_tokens(token: Address, amount: i128)` callable only by admin or buyer, restricted to tokens that are not the escrow's designated token (to prevent draining the escrow itself).

---

**#150: No `get_allowance` Public Function**
- **File:** `contracts/token/src/lib.rs`
- **Root cause:** The token stores allowances but there is no public `get_allowance(owner: Address, spender: Address) -> i128` function. Callers cannot query the current allowance.
- **Impact:** DeFi protocols and wallets cannot display or check allowances without reading raw storage.
- **Fix:** Add `pub fn allowance(env: Env, from: Address, spender: Address) -> i128` that reads and returns the stored allowance (or 0 if none).

---

**#151: No `is_initialized()` Helper Function**
- **File:** Both contracts
- **Root cause:** There is no public `is_initialized() -> bool` function. Callers must attempt to call a function and catch the `NotInitialized` error to determine if the contract is initialized.
- **Impact:** Poor developer experience for integrators who need to check initialization state before interacting.
- **Fix:** Add `pub fn is_initialized(env: Env) -> bool` that checks for the presence of the admin (token) or buyer (escrow) key in storage.

---

**#152: No `get_version()` Function**
- **File:** Both contracts
- **Root cause:** There is no `version() -> u32` function returning the contract's version number. After an upgrade (see #23), callers cannot determine which version is deployed.
- **Impact:** Integrators cannot programmatically detect which version of the contract they are interacting with.
- **Fix:** Add `pub fn version(env: Env) -> u32` returning a compile-time constant `CONTRACT_VERSION: u32 = 1`. Increment on each breaking change.

---

**#153: No Support for Contract-to-Contract Calls via Interface Trait**
- **File:** Both contracts
- **Root cause:** Neither contract exposes a client trait that other contracts can use to call it. Callers must use the raw `ContractClient` generated by `soroban-sdk`.
- **Impact:** Composability is harder. Other contracts that want to call the token or escrow must generate their own client or use dynamic dispatch.
- **Fix:** Define a `pub trait TokenInterface` and `pub trait EscrowInterface` with all public functions. Export these traits so other contracts can depend on the interface without depending on the implementation.

---

**#154: No `devcontainer.json` Extensions for Rust Development**
- **File:** `.devcontainer/devcontainer.json`
- **Root cause:** The devcontainer configuration may not include recommended VS Code extensions for Rust development (rust-analyzer, CodeLLDB, Even Better TOML).
- **Impact:** Developers using the devcontainer get a bare environment without IDE support for Rust.
- **Fix:** Add to `devcontainer.json`:
  ```json
  "customizations": {
    "vscode": {
      "extensions": ["rust-lang.rust-analyzer", "vadimcn.vscode-lldb", "tamasfe.even-better-toml", "serayuzgur.crates"]
    }
  }
  ```

---

**#155: No `devcontainer.json` Post-Create Command to Install Dependencies**
- **File:** `.devcontainer/devcontainer.json`
- **Root cause:** The devcontainer does not run `rustup target add wasm32-unknown-unknown` or install the Stellar CLI after container creation. Developers must run these manually.
- **Impact:** New contributors using the devcontainer get a broken environment until they manually run setup commands.
- **Fix:** Add `"postCreateCommand": "bash scripts/setup.sh"` to `devcontainer.json` to automatically run the setup script after container creation.

---

**#156: No `LICENSE` Header in Source Files**
- **File:** Both contracts, all source files
- **Root cause:** The project has an Apache 2.0 `LICENSE` file, but individual source files do not have the required Apache 2.0 license header comment.
- **Impact:** Technically, files without the license header are not properly licensed under Apache 2.0. This matters for open-source compliance and when files are copied into other projects.
- **Fix:** Add the standard Apache 2.0 header to each `.rs` file:
  ```rust
  // Copyright 2024 Soroban Contract Templates Contributors
  // SPDX-License-Identifier: Apache-2.0
  ```

---

**#157: No `README.md` Badge for CI Status, License, or Rust Version**
- **File:** `README.md`
- **Root cause:** The README has no status badges. Visitors cannot immediately see whether CI is passing, what license the project uses, or what Rust version is required.
- **Impact:** Reduced trust and discoverability. GitHub and crates.io users expect status badges on active projects.
- **Fix:** Add badges to the top of `README.md`:
  - CI status: `![CI](https://github.com/your-org/repo/actions/workflows/ci.yml/badge.svg)`
  - License: `![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)`
  - Rust version: `![Rust](https://img.shields.io/badge/rust-1.81.0-orange.svg)`
