use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, Debug)]
pub enum TokenError {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    NotInitialized = 5,
    InvalidAmount = 6,
    Overflow = 7,
}

impl core::fmt::Display for TokenError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            TokenError::InsufficientBalance => write!(f, "insufficient balance"),
            TokenError::InsufficientAllowance => write!(f, "insufficient allowance"),
            TokenError::Unauthorized => write!(f, "unauthorized"),
            TokenError::AlreadyInitialized => write!(f, "already initialized"),
            TokenError::NotInitialized => write!(f, "not initialized"),
            TokenError::InvalidAmount => write!(f, "invalid amount"),
            TokenError::Overflow => write!(f, "arithmetic overflow"),
        }
    }
}
