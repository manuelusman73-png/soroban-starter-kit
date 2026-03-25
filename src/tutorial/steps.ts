export type StepTarget =
  | { type: 'element'; selector: string }
  | { type: 'modal' }; // no anchor, centered modal

export interface TutorialMedia {
  type: 'image' | 'video';
  src: string;
  alt?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target: StepTarget;
  /** Which step id to go to next. Defaults to next in array. */
  nextId?: string;
  /** Branching: show choices instead of a single Next button */
  branches?: { label: string; nextId: string }[];
  media?: TutorialMedia;
  /** aria-live region hint */
  ariaLive?: 'polite' | 'assertive';
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  /** Trigger automatically for new users */
  autoStart?: boolean;
}

export const MAIN_TUTORIAL: Tutorial = {
  id: 'main',
  title: 'Welcome to Fidelis',
  description: 'A quick tour of the Soroban DApp',
  autoStart: true,
  steps: [
    {
      id: 'welcome',
      title: '👋 Welcome to Fidelis',
      content:
        'This app lets you interact with Soroban smart contracts on Stellar — even when you\'re offline. Let\'s take a quick tour.',
      target: { type: 'modal' },
      branches: [
        { label: '🚀 Start Tour', nextId: 'header' },
        { label: '⏭ Skip Tour',  nextId: '__end__' },
      ],
    },
    {
      id: 'header',
      title: '🔐 App Header',
      content:
        'The header shows your connectivity status and lets you toggle dark/light mode or switch color schemes.',
      target: { type: 'element', selector: '.header' },
      ariaLive: 'polite',
    },
    {
      id: 'quick-actions',
      title: '⚡ Quick Actions',
      content:
        'Queue a transfer transaction or manually trigger a sync with the Stellar network from here.',
      target: { type: 'element', selector: '.card' },
    },
    {
      id: 'tabs',
      title: '📑 Navigation Tabs',
      content:
        'Switch between your cached balances, pending (queued) transactions, and synced history.',
      target: { type: 'element', selector: '.flex.gap-md.mb-lg' },
      branches: [
        { label: 'Tell me about offline mode', nextId: 'offline' },
        { label: 'Next →', nextId: 'sidebar' },
      ],
    },
    {
      id: 'offline',
      title: '📡 Offline Mode',
      content:
        'When you lose connectivity, transactions are queued locally and replayed automatically once you\'re back online. Your balances are cached so you always have a snapshot.',
      target: { type: 'modal' },
    },
    {
      id: 'sidebar',
      title: '📊 Sync Status',
      content:
        'The sidebar shows live sync state, storage usage, and offline mode tips.',
      target: { type: 'element', selector: '.grid' },
    },
    {
      id: 'done',
      title: '✅ You\'re all set!',
      content:
        'That\'s the tour. You can restart it anytime from the Help menu. Happy building on Soroban!',
      target: { type: 'modal' },
    },
  ],
};

export const ALL_TUTORIALS: Tutorial[] = [MAIN_TUTORIAL];
