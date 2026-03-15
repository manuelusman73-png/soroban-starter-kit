# React Native Integration Example

A complete React Native mobile app demonstrating integration with Soroban contract templates.

## Features

- ✅ **Wallet Integration**: Mock wallet connection (easily replaceable with real Stellar wallets)
- ✅ **Contract Interaction**: Token and Escrow contract functions
- ✅ **Mobile-First UI**: Native iOS/Android interface
- ✅ **State Management**: Persistent wallet state with AsyncStorage
- ✅ **Error Handling**: Comprehensive error handling and user feedback
- ✅ **Loading States**: Activity indicators for async operations

## Quick Start

### Prerequisites

- Node.js 16+
- React Native development environment
- iOS Simulator or Android Emulator

### Installation

```bash
cd examples/react-native
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## App Structure

### Main Components

- **Wallet Connection**: Connect/disconnect wallet functionality
- **Token Contract**: Balance, transfer, mint, and metadata functions
- **Escrow Contract**: Full escrow lifecycle management
- **Contract Deployment**: Deploy new contracts directly from mobile

### Key Features

#### Wallet Management
```typescript
interface WalletState {
  isConnected: boolean;
  publicKey: string;
  network: 'testnet' | 'mainnet';
}
```

#### Contract Interaction
```typescript
const executeContractFunction = async (
  contractType: 'token' | 'escrow',
  functionName: string,
  params?: any,
): Promise<ContractResult>
```

#### Persistent State
- Wallet connection persisted across app sessions
- Contract IDs saved for convenience
- Network selection maintained

## Integration with Real Wallets

### Freighter Mobile (Future)
```typescript
// Replace mock connection with real Freighter integration
import { FreighterApi } from '@stellar/freighter-api';

const connectWallet = async () => {
  const result = await FreighterApi.requestAccess();
  // Handle real wallet connection
};
```

### Albedo Integration
```typescript
// Alternative wallet integration
import albedo from '@albedo-link/intent';

const connectWallet = async () => {
  const result = await albedo.publicKey();
  // Handle Albedo connection
};
```

## Contract Integration

### Token Contract Functions
- `balance()` - Check token balance
- `transfer()` - Send tokens
- `mint()` - Create new tokens (admin)
- `name()`, `symbol()` - Token metadata

### Escrow Contract Functions
- `getInfo()` - Get escrow details
- `fund()` - Buyer funds escrow
- `markDelivered()` - Seller marks delivery
- `approveDelivery()` - Buyer approves and releases funds

## Stellar SDK Integration

### Real Implementation Example
```typescript
import { SorobanRpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

const callContract = async (contractId: string, method: string, params: any[]) => {
  const account = await server.getAccount(userPublicKey);
  
  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName: method,
            args: params,
          })
        ),
      })
    )
    .setTimeout(30)
    .build();

  // Sign and submit transaction
  const result = await server.sendTransaction(transaction);
  return result;
};
```

## UI Components

### Responsive Design
- Adapts to different screen sizes
- Native iOS/Android styling
- Accessibility support

### User Experience
- Loading indicators for async operations
- Error handling with user-friendly messages
- Success feedback for completed transactions
- Persistent state across app sessions

## Testing

### Unit Tests
```bash
npm test
```

### E2E Testing
```bash
# Install Detox for E2E testing
npm install -g detox-cli
detox build --configuration ios.sim.debug
detox test --configuration ios.sim.debug
```

## Deployment

### iOS App Store
1. Configure signing certificates
2. Build release version
3. Upload to App Store Connect

### Google Play Store
1. Generate signed APK
2. Upload to Google Play Console
3. Configure store listing

## Security Considerations

### Private Key Management
- Never store private keys in app
- Use secure keychain/keystore
- Implement biometric authentication

### Network Security
- Use HTTPS for all API calls
- Validate all contract responses
- Implement request signing

### User Data Protection
- Encrypt sensitive data
- Follow platform security guidelines
- Regular security audits

## Advanced Features

### Push Notifications
- Transaction confirmations
- Escrow status updates
- Price alerts

### Offline Support
- Cache contract data
- Queue transactions for later
- Sync when online

### Multi-Network Support
- Testnet/Mainnet switching
- Custom RPC endpoints
- Network status monitoring

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Freighter Wallet](https://freighter.app/)