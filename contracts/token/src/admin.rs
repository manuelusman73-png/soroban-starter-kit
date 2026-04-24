use soroban_sdk::{Address, Env};
use crate::errors::TokenError;
use crate::storage::DataKey;

pub fn require_admin(env: &Env) -> Result<Address, TokenError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(TokenError::NotInitialized)
}
