use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy)]
pub enum EscrowError {
    NotAuthorized = 1,
    InvalidState = 2,
    DeadlinePassed = 3,
    DeadlineNotReached = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InsufficientFunds = 7,
    InvalidAmount = 8,
    InvalidParties = 9,
}

impl core::fmt::Display for EscrowError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            EscrowError::NotAuthorized => write!(f, "not authorized"),
            EscrowError::InvalidState => write!(f, "invalid state"),
            EscrowError::DeadlinePassed => write!(f, "deadline passed"),
            EscrowError::DeadlineNotReached => write!(f, "deadline not reached"),
            EscrowError::AlreadyInitialized => write!(f, "already initialized"),
            EscrowError::NotInitialized => write!(f, "not initialized"),
            EscrowError::InsufficientFunds => write!(f, "insufficient funds"),
            EscrowError::InvalidAmount => write!(f, "invalid amount"),
            EscrowError::InvalidParties => write!(f, "invalid parties"),
        }
    }
}
