import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { walletService } from '../services/wallet';
import type { WalletState, WalletId, WalletPreferences } from '../services/wallet';

interface WalletContextType extends WalletState {
  connect: (walletId: WalletId) => Promise<void>;
  disconnect: () => void;
  switchWallet: (walletId: WalletId) => Promise<void>;
  autoReconnect: () => Promise<boolean>;
  detectWallets: () => WalletId[];
  touchConnection: () => void;
  updatePreferences: (patch: Partial<WalletPreferences>) => void;
  clearError: () => void;
  getAnalytics: () => ReturnType<typeof walletService.getAnalytics>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<WalletState>(walletService.getState());

  useEffect(() => {
    const unsub = walletService.subscribe(setState);
    // Detect wallets and attempt auto-reconnect on mount
    walletService.detectWallets();
    walletService.autoReconnect();
    return unsub;
  }, []);

  const value: WalletContextType = {
    ...state,
    connect: (id) => walletService.connect(id),
    disconnect: () => walletService.disconnect(),
    switchWallet: (id) => walletService.switchWallet(id),
    autoReconnect: () => walletService.autoReconnect(),
    detectWallets: () => walletService.detectWallets(),
    touchConnection: () => walletService.touchConnection(),
    updatePreferences: (patch) => walletService.updatePreferences(patch),
    clearError: () => walletService.clearError(),
    getAnalytics: () => walletService.getAnalytics(),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}

export default WalletContext;
