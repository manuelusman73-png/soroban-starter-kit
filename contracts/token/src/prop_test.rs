#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::TokenContract;
use crate::TokenContractClient;

fn setup(env: &Env) -> (TokenContractClient<'_>, Address) {
    let admin = Address::generate(env);
    let addr = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(env, &addr);
    client.initialize(
        &admin,
        &String::from_str(env, "Test Token"),
        &String::from_str(env, "TEST"),
        &18u32,
    );
    (client, admin)
}

proptest! {
    /// Mint then burn the same amount → balance returns to zero.
    #[test]
    fn prop_mint_burn_roundtrip(amount in 1i128..=i128::MAX / 2) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);
        let user = Address::generate(&env);

        client.mint(&user, &amount);
        prop_assert_eq!(client.balance(&user), amount);
        prop_assert_eq!(client.total_supply(), amount);

        client.burn_admin(&user, &amount);
        prop_assert_eq!(client.balance(&user), 0);
        prop_assert_eq!(client.total_supply(), 0);
    }

    /// Transfer is conservative: sender loses exactly what receiver gains.
    #[test]
    fn prop_transfer_conservation(
        mint in 1i128..=1_000_000i128,
        transfer in 1i128..=1_000_000i128,
    ) {
        let transfer = transfer.min(mint);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);
        let sender = Address::generate(&env);
        let receiver = Address::generate(&env);

        client.mint(&sender, &mint);
        client.transfer(&sender, &receiver, &transfer);

        prop_assert_eq!(client.balance(&sender), mint - transfer);
        prop_assert_eq!(client.balance(&receiver), transfer);
        prop_assert_eq!(client.total_supply(), mint);
    }

    /// Approve then transfer_from reduces allowance by exactly the transferred amount.
    #[test]
    fn prop_allowance_decrements_correctly(
        mint in 1i128..=1_000_000i128,
        approve in 1i128..=1_000_000i128,
        spend in 1i128..=1_000_000i128,
    ) {
        let approve = approve.min(mint);
        let spend = spend.min(approve);
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);

        client.mint(&owner, &mint);
        let expiry = env.ledger().sequence() + 1000;
        client.approve(&owner, &spender, &approve, &expiry);
        client.transfer_from(&spender, &owner, &receiver, &spend);

        prop_assert_eq!(client.allowance(&owner, &spender), approve - spend);
    }

    /// Total supply equals the sum of all individual balances after arbitrary mints.
    #[test]
    fn prop_total_supply_matches_sum_of_balances(
        amounts in proptest::collection::vec(1i128..=100_000i128, 1..=10),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let mut total = 0i128;
        for amount in &amounts {
            let user = Address::generate(&env);
            client.mint(&user, amount);
            total += amount;
        }
        prop_assert_eq!(client.total_supply(), total);
    }
}
