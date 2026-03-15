#!/bin/bash

# Soroban Escrow Template Example Usage
# Usage: ./invoke-example.sh <CONTRACT_ID> [network]

set -e

CONTRACT_ID=$1
NETWORK=${2:-testnet}

if [ -z "$CONTRACT_ID" ]; then
    echo "❌ Error: Contract ID required"
    echo "Usage: ./invoke-example.sh <CONTRACT_ID> [network]"
    exit 1
fi

echo "🧪 Testing Soroban Escrow Template"
echo "Contract ID: $CONTRACT_ID"
echo "Network: $NETWORK"
echo ""

# Example addresses (replace with real addresses)
BUYER_ADDRESS="GDXY2OEZQHIFKHDN7SWZQYN3JGMVGXD3UYEQMY4FIBWMHQPD5NEKZFIN"
SELLER_ADDRESS="GCKFBEIYTKP5RDBQMTVVALONAOPBXICILMAFOOBN244UFKB3LCFWKS7L"
ARBITER_ADDRESS="GABC3SQ6K6RIRUQC5OZPQF52FJMYQRQHQSDWWGKFOES2OPTFRHDD6IHI"

echo "📊 Getting escrow information..."

# Get escrow info
echo "Escrow Details:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- get_escrow_info

echo ""
echo "Current State:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- get_state

echo ""
echo "Deadline Status:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- is_deadline_passed

echo ""
echo "💰 Testing escrow flow..."

# Step 1: Fund the escrow (buyer)
echo "Step 1: Buyer funding escrow..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- fund

echo "✅ Escrow funded"

# Check state after funding
echo "State after funding:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- get_state

echo ""
echo "📦 Step 2: Seller marking delivery..."

# Step 2: Mark delivered (seller)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- mark_delivered

echo "✅ Delivery marked"

# Check state after delivery
echo "State after delivery:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- get_state

echo ""
echo "✅ Step 3: Buyer approving delivery..."

# Step 3: Approve delivery (buyer)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- approve_delivery

echo "✅ Delivery approved - funds released!"

# Check final state
echo "Final state:"
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network $NETWORK \
  -- get_state

echo ""
echo "🎉 Escrow flow completed successfully!"
echo ""
echo "📝 Alternative flows to test:"
echo ""
echo "🔄 Refund Flow:"
echo "1. Fund escrow"
echo "2. Wait for deadline to pass"
echo "3. Call request_refund()"
echo ""
echo "⚖️ Dispute Resolution:"
echo "1. Fund escrow"
echo "2. Call resolve_dispute(true/false) as arbiter"
echo ""
echo "💡 Tips:"
echo "- Replace example addresses with real ones for production"
echo "- Ensure proper token approvals before funding"
echo "- Test deadline scenarios in controlled environments"
echo "- Always verify escrow state before operations"