use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Instance storage – pending admin [`Address`] awaiting acceptance.
    PendingAdmin,
    /// Persistent storage – token balance (`i128`) for a given [`Address`].
    Balance(Address),
    Allowance(AllowanceDataKey),
    Metadata(MetadataKey),
    TotalSupply,
    /// Instance storage – whether the contract is paused (`bool`).
    Paused,
    /// Instance storage – contract version number (`u32`).
    Version,
    /// Instance storage – maximum tokens that may ever be minted (`i128`).
    MaxSupply,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceDataKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum MetadataKey {
    Name,
    Symbol,
    Decimals,
}
