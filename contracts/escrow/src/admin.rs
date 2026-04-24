use soroban_sdk::{token, Address, Env};
use crate::storage::DataKey;
use crate::errors::EscrowError;

pub fn require_admin(env: &Env) -> Result<Address, EscrowError> {
    soroban_common::try_get_admin(env).ok_or(EscrowError::NotInitialized)
}

#[allow(dead_code)]
pub fn transfer_token(env: &Env, from: &Address, to: &Address, amount: i128) {
    let token_contract: Address = soroban_common::get_instance(env, &DataKey::TokenContract);
    token::Client::new(env, &token_contract).transfer(from, to, &amount);
}
