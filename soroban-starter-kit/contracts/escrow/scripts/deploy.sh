#!/bin/bash

# Soroban Escrow Template Deployment Script
# Usage: ./deploy.sh [network] [buyer] [seller] [arbiter] [token_contract] [amount] [deadline_offset]
# Example: ./deploy.sh testnet GDXY... GCKF... GABC... CDEF... 1000 100

set -e

NETWORK=${1:-testnet}
BUYER_ADDRESS=${2}
SELLER_ADDRESS=${3}
ARBITER_ADDRESS=${4}
TOKEN_CONTRACT=${5}
AMOUNT=${6:-1000000000000000000000}  # Default 1000 tokens (18 decimals)
DEADLINE_OFFSET=${7:-1000}  # Default 1000 ledgers (~1.4 hours)

echo "🚀 Deploying Soroban Escrow Template to $NETWORK..."

# Build the contract
echo "📦 Building contract..."
soroban contract build

# Deploy the contract
echo "🌐 Deploying to $NETWORK..."
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_escrow_template.wasm \
  --source alice \
  --network $NETWORK)

echo "✅ Contract deployed with ID: $CONTRACT_ID"

# Initialize if all parameters provided
if [ ! -z "$BUYER_ADDRESS" ] && [ ! -z "$SELLER_ADDRESS" ] && [ ! -z "$ARBITER_ADDRESS" ] && [ ! -z "$TOKEN_CONTRACT" ]; then
    echo "🔧 Initializing escrow..."
    
    # Calculate deadline ledger
    CURRENT_LEDGER=$(soroban network ls | grep $NETWORK -A 5 | grep "Latest Ledger" | awk '{print $3}' || echo "1000000")
    DEADLINE_LEDGER=$((CURRENT_LEDGER + DEADLINE_OFFSET))
    
    soroban contract invoke \
      --id $CONTRACT_ID \
      --source alice \
      --network $NETWORK \
      -- initialize \
      --buyer $BUYER_ADDRESS \
      --seller $SELLER_ADDRESS \
      --arbiter $ARBITER_ADDRESS \
      --token_contract $TOKEN_CONTRACT \
      --amount $AMOUNT \
      --deadline_ledger $DEADLINE_LEDGER
    
    echo "✅ Escrow initialized:"
    echo "   Buyer: $BUYER_ADDRESS"
    echo "   Seller: $SELLER_ADDRESS"
    echo "   Arbiter: $ARBITER_ADDRESS"
    echo "   Token: $TOKEN_CONTRACT"
    echo "   Amount: $AMOUNT"
    echo "   Deadline: $DEADLINE_LEDGER"
fi

echo "📋 Contract Details:"
echo "   Network: $NETWORK"
echo "   Contract ID: $CONTRACT_ID"
echo "   State: ${BUYER_ADDRESS:+Initialized}"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Save the contract ID: $CONTRACT_ID"
echo "2. Buyer should fund the escrow: soroban contract invoke --id $CONTRACT_ID ... -- fund"
echo "3. Use ./invoke-example.sh to test the full escrow flow"
echo "4. Integrate with your marketplace or application"