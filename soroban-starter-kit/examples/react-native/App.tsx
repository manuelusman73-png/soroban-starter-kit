import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WalletState {
  isConnected: boolean;
  publicKey: string;
  network: 'testnet' | 'mainnet';
}

interface ContractResult {
  success: boolean;
  data?: any;
  error?: string;
}

const App = (): JSX.Element => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    publicKey: '',
    network: 'testnet',
  });
  
  const [tokenContractId, setTokenContractId] = useState('');
  const [escrowContractId, setEscrowContractId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadWalletState();
  }, []);

  const loadWalletState = async () => {
    try {
      const savedWallet = await AsyncStorage.getItem('walletState');
      if (savedWallet) {
        setWallet(JSON.parse(savedWallet));
      }
    } catch (error) {
      console.error('Error loading wallet state:', error);
    }
  };

  const saveWalletState = async (newWallet: WalletState) => {
    try {
      await AsyncStorage.setItem('walletState', JSON.stringify(newWallet));
      setWallet(newWallet);
    } catch (error) {
      console.error('Error saving wallet state:', error);
    }
  };

  const connectWallet = async () => {
    // Mock wallet connection - in real app, integrate with Stellar wallet
    const mockPublicKey = 'GDXY2OEZQHIFKHDN7SWZQYN3JGMVGXD3UYEQMY4FIBWMHQPD5NEKZFIN';
    
    Alert.alert(
      'Connect Wallet',
      'In a real app, this would connect to a Stellar wallet like Freighter or Albedo',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Mock Connect',
          onPress: () => {
            const newWallet = {
              isConnected: true,
              publicKey: mockPublicKey,
              network: 'testnet' as const,
            };
            saveWalletState(newWallet);
            Alert.alert('Success', 'Wallet connected successfully!');
          },
        },
      ],
    );
  };

  const disconnectWallet = () => {
    const newWallet = {
      isConnected: false,
      publicKey: '',
      network: 'testnet' as const,
    };
    saveWalletState(newWallet);
    setResults({});
  };

  const executeContractFunction = async (
    contractType: 'token' | 'escrow',
    functionName: string,
    params?: any,
  ): Promise<ContractResult> => {
    if (!wallet.isConnected) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    
    try {
      // Mock contract interaction - in real app, use Stellar SDK
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
      
      let mockResult = '';
      
      if (contractType === 'token') {
        switch (functionName) {
          case 'balance':
            mockResult = `Balance: 1,250.75 tokens`;
            break;
          case 'transfer':
            mockResult = `Transferred ${params?.amount || '100'} tokens to ${params?.to || 'recipient'}`;
            break;
          case 'mint':
            mockResult = `Minted ${params?.amount || '1000'} tokens to ${params?.to || 'address'}`;
            break;
          case 'name':
            mockResult = 'Token Name: Soroban Example Token';
            break;
          case 'symbol':
            mockResult = 'Symbol: SET';
            break;
          case 'totalSupply':
            mockResult = 'Total Supply: 1,000,000 tokens';
            break;
          default:
            mockResult = `Executed ${functionName} successfully`;
        }
      } else {
        switch (functionName) {
          case 'getInfo':
            mockResult = `Escrow Info:
Buyer: ${wallet.publicKey.substring(0, 20)}...
Seller: GCKFBEIYTKP5RDBQMTVVALONAOPBXICILMAFOOBN244UFKB3LCFWKS7L
Amount: 1000 tokens
State: Funded`;
            break;
          case 'fund':
            mockResult = 'Escrow funded successfully - State: Funded';
            break;
          case 'markDelivered':
            mockResult = 'Delivery marked - State: Delivered';
            break;
          case 'approveDelivery':
            mockResult = 'Delivery approved - Funds released!';
            break;
          default:
            mockResult = `Executed ${functionName} successfully`;
        }
      }

      return {success: true, data: mockResult};
    } catch (error) {
      return {success: false, error: (error as Error).message};
    } finally {
      setLoading(false);
    }
  };

  const handleTokenAction = async (action: string) => {
    if (!tokenContractId) {
      Alert.alert('Error', 'Please enter a token contract ID');
      return;
    }

    try {
      const result = await executeContractFunction('token', action);
      if (result.success) {
        setResults(prev => ({...prev, token: result.data}));
      } else {
        Alert.alert('Error', result.error || 'Transaction failed');
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleEscrowAction = async (action: string) => {
    if (!escrowContractId) {
      Alert.alert('Error', 'Please enter an escrow contract ID');
      return;
    }

    try {
      const result = await executeContractFunction('escrow', action);
      if (result.success) {
        setResults(prev => ({...prev, escrow: result.data}));
      } else {
        Alert.alert('Error', result.error || 'Transaction failed');
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const deployContract = async (type: 'token' | 'escrow') => {
    if (!wallet.isConnected) {
      Alert.alert('Error', 'Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate deployment
      
      const mockContractId = 'C' + Math.random().toString(36).substring(2, 58).toUpperCase();
      
      if (type === 'token') {
        setTokenContractId(mockContractId);
        setResults(prev => ({...prev, token: `Token deployed: ${mockContractId}`}));
      } else {
        setEscrowContractId(mockContractId);
        setResults(prev => ({...prev, escrow: `Escrow deployed: ${mockContractId}`}));
      }
      
      Alert.alert('Success', `${type} contract deployed successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Soroban Contracts</Text>
          <Text style={styles.subtitle}>Mobile Integration Example</Text>
        </View>

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet Connection</Text>
          {wallet.isConnected ? (
            <View style={styles.walletConnected}>
              <Text style={styles.connectedText}>✅ Connected</Text>
              <Text style={styles.publicKey}>
                {wallet.publicKey.substring(0, 20)}...
              </Text>
              <Text style={styles.network}>Network: {wallet.network}</Text>
              <TouchableOpacity style={styles.disconnectButton} onPress={disconnectWallet}>
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.connectButton} onPress={connectWallet}>
              <Text style={styles.buttonText}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {wallet.isConnected && (
          <>
            {/* Token Contract Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🪙 Token Contract</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Token Contract ID"
                value={tokenContractId}
                onChangeText={setTokenContractId}
                multiline
              />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryButton]} 
                  onPress={() => handleTokenAction('balance')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Balance</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryButton]} 
                  onPress={() => handleTokenAction('name')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Name</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.secondaryButton]} 
                  onPress={() => deployContract('token')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Deploy</Text>
                </TouchableOpacity>
              </View>
              
              {results.token && (
                <View style={styles.result}>
                  <Text style={styles.resultText}>{results.token}</Text>
                </View>
              )}
            </View>

            {/* Escrow Contract Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🤝 Escrow Contract</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Escrow Contract ID"
                value={escrowContractId}
                onChangeText={setEscrowContractId}
                multiline
              />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryButton]} 
                  onPress={() => handleEscrowAction('getInfo')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Info</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryButton]} 
                  onPress={() => handleEscrowAction('fund')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Fund</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.secondaryButton]} 
                  onPress={() => deployContract('escrow')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Deploy</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.successButton]} 
                  onPress={() => handleEscrowAction('markDelivered')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Deliver</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.successButton]} 
                  onPress={() => handleEscrowAction('approveDelivery')}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Approve</Text>
                </TouchableOpacity>
              </View>
              
              {results.escrow && (
                <View style={styles.result}>
                  <Text style={styles.resultText}>{results.escrow}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4299e1" />
            <Text style={styles.loadingText}>Processing transaction...</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionsText}>
            1. Connect your wallet{'\n'}
            2. Deploy contracts or enter existing contract IDs{'\n'}
            3. Test contract functions{'\n'}
            4. Try the complete escrow flow: Fund → Deliver → Approve
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  walletConnected: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#c6f6d5',
    borderRadius: 8,
  },
  connectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22543d',
    marginBottom: 5,
  },
  publicKey: {
    fontSize: 14,
    color: '#22543d',
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  network: {
    fontSize: 14,
    color: '#22543d',
    marginBottom: 10,
  },
  connectButton: {
    backgroundColor: '#4299e1',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#f56565',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#ffffff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  primaryButton: {
    backgroundColor: '#4299e1',
  },
  secondaryButton: {
    backgroundColor: '#68d391',
  },
  successButton: {
    backgroundColor: '#48bb78',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  result: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 15,
    marginTop: 10,
  },
  resultText: {
    fontSize: 14,
    color: '#2d3748',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4299e1',
  },
  instructions: {
    margin: 10,
    padding: 20,
    backgroundColor: '#edf2f7',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
});

export default App;