#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env,
};

fn create_escrow_contract<'a>(env: &'a Env) -> (EscrowContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_address);
    (client, contract_address)
}

fn setup_token(env: &Env, buyer: &Address, amount: i128) -> Address {
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    let token_admin = StellarAssetClient::new(env, &token_address);
    token_admin.mint(buyer, &amount);
    token_address
}

fn setup_funded_escrow<'a>(
    env: &'a Env,
) -> (
    EscrowContractClient<'a>,
    Address,
    Address,
    Address,
    Address,
    i128,
    u32,
) {
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let arbiter = Address::generate(env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(env, &buyer, amount);

    let (client, _) = create_escrow_contract(env);

    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    client.fund();

    (client, buyer, seller, arbiter, token_contract, amount, deadline)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(&env, &buyer, amount);

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    let info = client.get_escrow_info();
    assert_eq!(info.buyer, buyer);
    assert_eq!(info.seller, seller);
    assert_eq!(info.arbiter, arbiter);
    assert_eq!(info.amount, amount);
    assert_eq!(info.state, EscrowState::Created);
}

#[test]
fn test_fund() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(&env, &buyer, amount);

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_initialize_past_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 10);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() - 1;
    client.fund();

    assert_eq!(client.get_state(), EscrowState::Funded);
}

#[test]
fn test_mark_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, seller, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();

    assert_eq!(client.get_state(), EscrowState::Delivered);
}

#[test]
fn test_approve_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();
    client.approve_delivery();

    assert_eq!(client.get_state(), EscrowState::Completed);
}

#[test]
fn test_raise_dispute() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);

    assert_eq!(client.get_state(), EscrowState::Disputed);
}

#[test]
fn test_resolve_dispute_to_seller() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.raise_dispute();
    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);
    client.resolve_dispute(&true);

    assert_eq!(client.get_state(), EscrowState::Completed);
}

#[test]
fn test_resolve_dispute_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.raise_dispute();
    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);
    client.resolve_dispute(&false);

    assert_eq!(client.get_state(), EscrowState::Refunded);
}

#[test]
fn test_unauthorized_fund() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    
    // Only buyer can fund
    client.fund();
    assert_eq!(client.get_state(), Some(EscrowState::Funded));
}

#[test]
fn test_unauthorized_mark_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, seller, ..) = setup_funded_escrow(&env);
    
    // Only seller can mark delivered
    client.mark_delivered();
    assert_eq!(client.get_state(), Some(EscrowState::Delivered));
}

#[test]
fn test_unauthorized_approve_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, buyer, ..) = setup_funded_escrow(&env);
    client.mark_delivered();
    
    // Only buyer can approve delivery
    client.approve_delivery();
    assert_eq!(client.get_state(), Some(EscrowState::Completed));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_mark_delivered_from_created() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    // Try to mark delivered when state is Created - should fail
    client.mark_delivered();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_approve_delivery_from_created() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    // Try to approve delivery when state is Created - should fail
    client.approve_delivery();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_approve_delivery_from_funded() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);

    // Try to approve delivery when state is Funded (not Delivered) - should fail
    client.approve_delivery();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_cancel_from_funded() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);

    // Try to cancel when state is Funded (only Created can be cancelled) - should fail
    client.cancel();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_cancel_from_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.mark_delivered();

    // Try to cancel when state is Delivered - should fail
    client.cancel();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_fund_from_funded() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);

    // Try to fund when already Funded - should fail
    client.fund();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_invalid_fund_from_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.mark_delivered();

    // Try to fund when state is Delivered - should fail with InvalidState
    client.fund();
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_initialize_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    
    // Try to initialize with zero amount - should fail with InvalidAmount
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &0i128, &deadline);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_initialize_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    
    // Try to initialize with negative amount - should fail with InvalidAmount
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &-1i128, &deadline);
}

#[test]
fn test_initialize_one_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1);
    let amount = 1i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    let info = client.get_escrow_info();
    assert_eq!(info.amount, 1i128);
    assert_eq!(info.state, EscrowState::Created);
}

#[test]
fn test_initialize_max_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, i128::MAX);
    let amount = i128::MAX;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    let info = client.get_escrow_info();
    assert_eq!(info.amount, i128::MAX);
    assert_eq!(info.state, EscrowState::Created);
}

#[test]
fn test_release_partial_one_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, _, _, amount) = setup_funded_escrow(&env);
    
    // Release 1 token
    client.release_partial(&1i128);

    let info = client.get_escrow_info();
    assert_eq!(info.amount, amount - 1i128);
    assert_eq!(info.state, EscrowState::Funded);
}

#[test]
fn test_release_partial_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, _, _, amount) = setup_funded_escrow(&env);
    
    // Release 0 tokens - should succeed but not change amount
    client.release_partial(&0i128);

    let info = client.get_escrow_info();
    assert_eq!(info.amount, amount);
    assert_eq!(info.state, EscrowState::Funded);
}
