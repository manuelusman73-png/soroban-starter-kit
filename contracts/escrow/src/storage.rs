use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Buyer's address. Type: `Address`. Storage: instance.
    Buyer,
    /// Seller's address. Type: `Address`. Storage: instance.
    Seller,
    /// Arbiter's address for dispute resolution. Type: `Address`. Storage: instance.
    Arbiter,
    /// Address of the token contract holding escrowed funds. Type: `Address`. Storage: instance.
    TokenContract,
    /// Escrowed token amount. Type: `i128`. Storage: instance.
    Amount,
    /// Ledger sequence number after which refunds become claimable. Type: `u32`. Storage: instance.
    Deadline,
    /// Current lifecycle state of the escrow. Type: `EscrowState`. Storage: instance.
    State,
    /// Whether the buyer has approved delivery. Type: `bool`. Storage: instance.
    BuyerApproved,
    /// Whether the seller has marked delivery complete. Type: `bool`. Storage: instance.
    SellerDelivered,
    /// Whether the contract is paused. Type: `bool`. Storage: instance.
    Paused,
    /// Contract version number. Type: `u32`. Storage: instance.
    Version,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowState {
    Created = 0,
    Funded = 1,
    Delivered = 2,
    Disputed = 3,
    Completed = 4,
    Refunded = 5,
    Cancelled = 6,
    Completed = 3,
    Refunded = 4,
    Disputed = 5,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowInfo {
    pub buyer: Address,
    pub seller: Address,
    pub arbiter: Address,
    pub token_contract: Address,
    pub amount: i128,
    pub deadline: u32,
    pub state: EscrowState,
}
