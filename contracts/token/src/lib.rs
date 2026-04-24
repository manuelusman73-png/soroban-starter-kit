#![no_std]

use soroban_sdk::token::TokenInterface as _;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Symbol,
};
use storage::DataKey::{Admin, Allowance, Balance, Metadata, TotalSupply, Paused, Version};

use admin::require_admin;
use storage::DataKey::{Admin, Allowance, Balance, Metadata, TotalSupply};
use storage::MetadataKey::{Decimals, Name, Symbol as SymbolKey};

/// Extend storage TTL when remaining ledgers fall below this threshold.
/// 120_960 ledgers ≈ 7 days (at ~5 s/ledger).
const LEDGER_LIFETIME_THRESHOLD: u32 = 120_960;

/// Target TTL (in ledgers) after each extension.
/// 518_400 ledgers ≈ 30 days (at ~5 s/ledger).
const LEDGER_BUMP_AMOUNT: u32 = 518_400;
const CONTRACT_VERSION: u32 = 1;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(LEDGER_LIFETIME_THRESHOLD, LEDGER_BUMP_AMOUNT);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, LEDGER_LIFETIME_THRESHOLD, LEDGER_BUMP_AMOUNT);
}

/// Token contract implementing the Soroban Token Interface
///
/// This contract provides a complete implementation of a fungible token with:
/// - Standard token operations (transfer, balance, approve)
/// - Administrative controls (mint, admin_burn, set_admin)
/// - Metadata support (name, symbol, decimals)
#[contract]
pub struct TokenContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(AllowanceDataKey),
    Metadata(MetadataKey),
    TotalSupply,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceDataKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum MetadataKey {
    Name,
    Symbol,
    Decimals,
}

/// Custom errors for the token contract
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum TokenError {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    NotInitialized = 5,
}

#[contractimpl]
impl TokenContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
        max_supply: Option<i128>,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&Admin, &admin);
        env.storage().instance().set(&Metadata(Name), &name);
        env.storage().instance().set(&Metadata(SymbolKey), &symbol);
        env.storage().instance().set(&Metadata(Decimals), &decimals);
        env.storage().instance().set(&TotalSupply, &0i128);
        env.storage().instance().set(&Version, &CONTRACT_VERSION);
        // Issue #196: Store max_supply if provided
        if let Some(max) = max_supply {
            env.storage().instance().set(&DataKey::MaxSupply, &max);
        }
        bump_instance(&env);

        // Set admin
        env.storage().instance().set(&DataKey::Admin, &admin);

        // Set metadata
        env.storage()
            .instance()
            .set(&DataKey::Metadata(MetadataKey::Name), &name);
        env.storage()
            .instance()
            .set(&DataKey::Metadata(MetadataKey::Symbol), &symbol);
        env.storage()
            .instance()
            .set(&DataKey::Metadata(MetadataKey::Decimals), &decimals);

        // Initialize total supply to 0
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        // Emit initialization event
        env.events().publish(
            (Symbol::new(&env, "initialize"), admin.clone()),
            (name, symbol, decimals),
        );

        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;

        admin.require_auth();
        Self::require_not_paused(&env)?;

        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        let balance = Self::balance_of(env.clone(), to.clone());
        let new_balance = balance + amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);

        // Update total supply
        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply + amount));

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "mint"), to), amount);

        events::minted(&env, &to, amount);

    /// Burn tokens from an account (admin only)
    pub fn admin_burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;

        admin.require_auth();
        Self::require_not_paused(&env)?;
        // Issue #199: Require authorization from token holder
        from.require_auth();
        if amount < 0 {
            return Err(TokenError::InsufficientBalance);
        }
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let new_balance = balance.checked_sub(amount).ok_or(TokenError::InsufficientBalance)?;
        env.storage().persistent().set(&Balance(from.clone()), &new_balance);
        bump_persistent(&env, &Balance(from.clone()));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        bump_instance(&env);
        events::burned(&env, &from, amount);
        Ok(())
    }

        // Update balance
        let new_balance = balance - amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_balance);

        // Update total supply
        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply - amount));

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);

        Ok(())
    /// Issue #197: Propose a new admin (two-step transfer)
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::PendingAdmin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    /// Set a new admin (current admin only)
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "set_admin"),), new_admin);

    /// Unpause the contract. Admin only.
    pub fn unpause(env: Env) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Paused, &false);
        bump_instance(&env);
        Ok(())
    }

    /// Get the current admin
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

#[contractimpl]
impl token::TokenInterface for TokenContract {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey { from, spender });
        let val: AllowanceValue = match env.storage().temporary().get(&key) {
            Some(v) => v,
            None => return 0,
        };
        if env.ledger().sequence() > val.expiration_ledger {
            return 0;
    /// Issue #196: Get the maximum supply cap
    pub fn max_supply(env: Env) -> Option<i128> {
        env.storage().instance().get(&DataKey::MaxSupply)
    }

    // ── Soroban TokenInterface methods ────────────────────────────────────

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let val: Option<AllowanceValue> = env.storage().temporary().get(&key);
        match val {
            Some(v) if env.ledger().sequence() <= v.expiration_ledger => v.amount,
            _ => 0,
        }
        val.amount
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();

        if expiration_ledger <= env.ledger().sequence() {
            panic!("expiration_ledger must be in the future");
        }

        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });

        env.storage().temporary().set(&key, &amount);
        if expiration_ledger > env.ledger().sequence() {
            env.storage()
                .temporary()
                .extend_ttl(&key, expiration_ledger, expiration_ledger);
        }

        env.events()
            .publish((Symbol::new(&env, "approve"), from, spender), amount);
    }

    fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(env, id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        // Check allowance
        let key = DataKey::Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }

        // Update allowance
        env.storage().temporary().set(&key, &(allowance - amount));

        // Perform transfer
        Self::transfer_impl(env, from, to, amount).unwrap();
    }

    /// Burn tokens from the caller's own balance
    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        if amount < 0 {
            panic!("Amount must be non-negative");
        }

        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        // Update balance
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));

        // Update total supply
        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply - amount));

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);
    }

    /// Burn tokens from `from` using `spender`'s allowance
    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();

        if amount < 0 {
            panic!("Amount must be non-negative");
        }

        // Check and deduct allowance
        let key = DataKey::Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }
        env.storage().temporary().set(&key, &(allowance - amount));
        env.storage().persistent().set(&Balance(from.clone()), &(balance - amount));

        // Check and deduct balance
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));

        // Update total supply
        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply - amount));

        // Emit event — topics mirror the standard burn event (from's perspective)
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);
    }

    fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Metadata(MetadataKey::Decimals))
            .unwrap()
    }

    fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Metadata(MetadataKey::Name))
            .unwrap()
    }

    fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Metadata(MetadataKey::Symbol))
            .unwrap()
    }
}

impl TokenContract {
    fn balance_of(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    fn transfer_impl(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        Self::require_not_paused(&env)?;
    fn transfer_impl(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        // Update balances
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        let to_balance = Self::balance_of(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "transfer"), from, to), amount);

        Ok(())
    }
}

mod test;
