#!/bin/bash

# Soroban Token Template Example Invocations
# Usage: ./invoke-example.sh <CONTRACT_ID> [network]

set -e

CONTRACT_ID=$1
NETWORK=${2:-testnet}

if [ -z "$CONTRACT_ID" ]; then
    echo "❌ Error: Contract ID required"
    echo "Usage: ./invoke-example.sh <CONTRACT_ID> [network]"
    exit 1
fi

echo "🧪 Testing Soroban Token Template"
echo "Contract ID: $CONTRACT_ID"
echo "Network: $NETWORK"
echo ""

# Example addresses (replace with real addresses)
ADMIN_ADDRESS="GDXY2OEZQHIFKHDN7SWZQYN3JGMVGXD3UYEQMY4FIBWMHQPD5NEKZFIN"
USER_ADDRESS="GCKFBEIYTKP5RDBQMTVVALONAOPBXICILMAFOOBN244UFKB3LCFWKS7L"

echo "📊 Getting token information..."

# Get token metadata
echo "Token Name:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- name

echo "Token Symbol:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- symbol

echo "Token Decimals:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- decimals

echo "Total Supply:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- total_supply

echo ""
echo "💰 Minting tokens..."

# Mint tokens to user
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- mint \
  --to $USER_ADDRESS \
  --amount 1000000000000000000000

echo "✅ Minted 1000 tokens to user"

echo ""
echo "📈 Checking balances..."

# Check user balance
echo "User balance:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- balance \
  --id $USER_ADDRESS

echo "Updated total supply:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- total_supply

echo ""
echo "🔄 Testing transfer..."

# Transfer tokens (this would require proper auth in real scenario)
echo "Transferring 100 tokens..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- transfer \
  --from $USER_ADDRESS \
  --to $ADMIN_ADDRESS \
  --amount 100000000000000000000

echo "✅ Transfer completed"

echo ""
echo "🎉 All tests completed successfully!"
echo ""
echo "💡 Tips:"
echo "- Replace example addresses with real ones"
echo "- Ensure proper authentication for real transactions"
echo "- Check the frontend example for web integration"