#!/bin/bash

# Soroban Token Template Deployment Script
# Usage: ./deploy.sh [network] [admin_address]
# Example: ./deploy.sh testnet GDXY...

set -e

NETWORK=${1:-testnet}
ADMIN_ADDRESS=${2}

echo "🚀 Deploying Soroban Token Template to $NETWORK..."

# Build the contract
echo "📦 Building contract..."
soroban contract build

# Deploy the contract
echo "🌐 Deploying to $NETWORK..."
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_token_template.wasm \
  --source alice \
  --network $NETWORK)

echo "✅ Contract deployed with ID: $CONTRACT_ID"

# Initialize if admin address provided
if [ ! -z "$ADMIN_ADDRESS" ]; then
    echo "🔧 Initializing token..."
    soroban contract invoke \
      --id $CONTRACT_ID \
      --source alice \
      --network $NETWORK \
      -- initialize \
      --admin $ADMIN_ADDRESS \
      --name "Example Token" \
      --symbol "EXT" \
      --decimals 18
    
    echo "✅ Token initialized with admin: $ADMIN_ADDRESS"
fi

echo "📋 Contract Details:"
echo "   Network: $NETWORK"
echo "   Contract ID: $CONTRACT_ID"
echo "   Admin: ${ADMIN_ADDRESS:-'Not set'}"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Save the contract ID: $CONTRACT_ID"
echo "2. Use ./invoke-example.sh to test the contract"
echo "3. Integrate with your frontend application"