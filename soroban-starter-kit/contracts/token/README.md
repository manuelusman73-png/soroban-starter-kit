# Soroban Token Template

A production-ready fungible token contract for Soroban that implements the standard token interface with administrative controls.

## Features

- ✅ **Standard Token Interface**: Full compatibility with Soroban token standards
- ✅ **Administrative Controls**: Mint, burn, and admin management
- ✅ **Metadata Support**: Name, symbol, and decimals
- ✅ **Allowance System**: Approve and transfer_from functionality
- ✅ **Event Emission**: All operations emit events for tracking
- ✅ **Error Handling**: Custom error types for better debugging

## Contract Functions

### Administrative Functions (Admin Only)

- `initialize(admin, name, symbol, decimals)` - Initialize the token
- `mint(to, amount)` - Mint new tokens to an address
- `burn(from, amount)` - Burn tokens from an address
- `set_admin(new_admin)` - Transfer admin rights

### Standard Token Functions

- `transfer(from, to, amount)` - Transfer tokens
- `approve(from, spender, amount, expiration)` - Approve spending allowance
- `transfer_from(spender, from, to, amount)` - Transfer via allowance
- `balance(address)` - Get token balance
- `allowance(from, spender)` - Get spending allowance

### View Functions

- `admin()` - Get current admin address
- `name()` - Get token name
- `symbol()` - Get token symbol
- `decimals()` - Get token decimals
- `total_supply()` - Get total token supply

## Quick Start

### Build the Contract

```bash
soroban contract build
```

### Run Tests

```bash
cargo test
```

### Deploy to Testnet

```bash
# Deploy the contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_token_template.wasm \
  --source alice \
  --network testnet

# Initialize the token
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --name "My Token" \
  --symbol "MTK" \
  --decimals 18
```

### Example Usage

```bash
# Mint tokens
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- mint \
  --to <RECIPIENT_ADDRESS> \
  --amount 1000000000000000000000

# Transfer tokens
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- transfer \
  --from <FROM_ADDRESS> \
  --to <TO_ADDRESS> \
  --amount 100000000000000000000

# Check balance
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- balance \
  --id <ADDRESS>
```

## Use Cases

- **DeFi Tokens**: Create tokens for decentralized finance applications
- **Governance Tokens**: Enable voting and governance in DAOs
- **Utility Tokens**: Power application features and services
- **Reward Tokens**: Distribute rewards and incentives
- **Stablecoins**: Create pegged or algorithmic stablecoins

## Security Considerations

- Only the admin can mint and burn tokens
- Admin rights can be transferred to another address
- All operations require proper authentication
- Balances and allowances are properly validated
- Events are emitted for all state changes

## Integration

This contract can be easily integrated into:
- DeFi protocols (AMMs, lending, etc.)
- NFT marketplaces (payment tokens)
- Gaming applications (in-game currency)
- Subscription services (payment tokens)
- Cross-border payments

## Frontend Integration

See `examples/frontend/` for a complete example of integrating this contract with a web application using Freighter wallet.