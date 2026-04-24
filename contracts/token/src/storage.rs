use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Current admin address. Type: `Address`. Storage: instance.
    Admin,
    /// Pending admin address awaiting acceptance. Type: `Address`. Storage: instance.
    PendingAdmin,
    /// Token balance for an account. Type: `i128`. Storage: persistent, keyed by `Address`.
    Balance(Address),
    /// Approved spending allowance between two accounts. Type: `AllowanceValue`. Storage: persistent, keyed by `AllowanceDataKey`.
    Allowance(AllowanceDataKey),
    /// Token metadata field (name, symbol, or decimals). Type: varies. Storage: instance, keyed by `MetadataKey`.
    Metadata(MetadataKey),
    /// Aggregate minted supply. Type: `i128`. Storage: instance.
    TotalSupply,
    /// Whether the contract is paused. Type: `bool`. Storage: instance.
    Paused,
    /// Contract version number. Type: `u32`. Storage: instance.
    Version,
    /// Maximum tokens that may ever be minted. Type: `i128`. Storage: instance.
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
