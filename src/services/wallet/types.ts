export type WalletId = 'freighter' | 'albedo' | 'xbull' | 'rabet';
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type NetworkPassphrase = 'testnet' | 'mainnet';

export interface WalletInfo {
  id: WalletId;
  name: string;
  icon: string;
  downloadUrl: string;
}

export interface WalletAccount {
  publicKey: string;
  network: NetworkPassphrase;
}

export interface WalletConnection {
  walletId: WalletId;
  account: WalletAccount;
  connectedAt: number;
  lastActiveAt: number;
}

export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'switched' | 'error' | 'account_changed';
  walletId?: WalletId;
  publicKey?: string;
  error?: string;
  timestamp: number;
}

export interface WalletState {
  activeConnection: WalletConnection | null;
  status: WalletStatus;
  error: string | null;
  detectedWallets: WalletId[];
  connectionHistory: ConnectionEvent[];
  preferences: WalletPreferences;
}

export interface WalletPreferences {
  preferredWallet: WalletId | null;
  autoReconnect: boolean;
  network: NetworkPassphrase;
}
