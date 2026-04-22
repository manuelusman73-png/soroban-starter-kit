#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::TokenError;
pub use storage::{AllowanceDataKey, DataKey, MetadataKey};

use soroban_sdk::{contract, contractimpl, Address, Env, String};

use admin::require_admin;
use storage::DataKey::{Admin, Allowance, Balance, Metadata, TotalSupply};
use storage::MetadataKey::{Decimals, Name, Symbol};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&Admin, &admin);
        env.storage().instance().set(&Metadata(Name), &name);
        env.storage().instance().set(&Metadata(Symbol), &symbol);
        env.storage().instance().set(&Metadata(Decimals), &decimals);
        env.storage().instance().set(&TotalSupply, &0i128);
        events::initialized(&env, &admin, name, symbol, decimals);
        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 { panic!("Amount must be non-negative"); }
        let balance = Self::balance_of(env.clone(), to.clone());
        env.storage().persistent().set(&Balance(to.clone()), &(balance + amount));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply + amount));
        events::minted(&env, &to, amount);
        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 { panic!("Amount must be non-negative"); }
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount { return Err(TokenError::InsufficientBalance); }
        env.storage().persistent().set(&Balance(from.clone()), &(balance - amount));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        events::burned(&env, &from, amount);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Admin, &new_admin);
        events::admin_set(&env, &new_admin);
        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&Admin).unwrap()
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&Metadata(Name)).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&Metadata(Symbol)).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&Metadata(Decimals)).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&TotalSupply).unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey { from, spender });
        env.storage().temporary().get(&key).unwrap_or(0)
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        let key = Allowance(AllowanceDataKey { from: from.clone(), spender: spender.clone() });
        env.storage().temporary().set(&key, &amount);
        if expiration_ledger > env.ledger().sequence() {
            env.storage().temporary().extend_ttl(&key, expiration_ledger, expiration_ledger);
        }
        events::approved(&env, &from, &spender, amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(env, id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::transfer_impl(env, from, to, amount).unwrap();
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let key = Allowance(AllowanceDataKey { from: from.clone(), spender: spender.clone() });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount { panic!("Insufficient allowance"); }
        env.storage().temporary().set(&key, &(allowance - amount));
        Self::transfer_impl(env, from, to, amount).unwrap();
    }
}

impl TokenContract {
    fn balance_of(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&Balance(id)).unwrap_or(0)
    }

    fn transfer_impl(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount < 0 { panic!("Amount must be non-negative"); }
        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount { return Err(TokenError::InsufficientBalance); }
        let to_balance: i128 = env.storage().persistent().get(&Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&Balance(from.clone()), &(from_balance - amount));
        env.storage().persistent().set(&Balance(to.clone()), &(to_balance + amount));
        events::transferred(&env, &from, &to, amount);
        Ok(())
    }
}
