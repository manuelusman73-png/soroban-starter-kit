/**
 * User Analytics Service
 *
 * Privacy-compliant tracking of user behavior, feature adoption, journeys,
 * A/B test assignment, cohort analysis, and user segmentation.
 * No PII is stored — all identifiers are anonymized session tokens.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureEvent {
  feature: string;
  action: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  events: FeatureEvent[];
  cohortWeek: string; // ISO week string e.g. "2025-W12"
  segment: UserSegment;
}

export type UserSegment = 'new' | 'casual' | 'regular' | 'power';

export interface FeatureAdoption {
  feature: string;
  totalInteractions: number;
  uniqueSessions: number;
  adoptionRate: number; // 0-1
  firstUsed: number;
  lastUsed: number;
  trend: 'up' | 'down' | 'stable';
}

export interface JourneyStep {
  feature: string;
  count: number;
  dropOffRate: number; // 0-1
}

export interface ABTest {
  id: string;
  name: string;
  variants: ABVariant[];
  startTime: number;
  endTime?: number;
  status: 'active' | 'concluded' | 'paused';
}

export interface ABVariant {
  id: string;
  name: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  uplift?: number; // relative to control
}

export interface CohortData {
  cohortWeek: string;
  startSize: number;
  retention: number[]; // retention % per week (week 0 = 100%)
}

export interface AnalyticsOverview {
  totalSessions: number;
  activeSessions: number;
  avgSessionDuration: number; // ms
  totalEvents: number;
  topFeatures: Array<{ feature: string; interactions: number }>;
  segmentBreakdown: Record<UserSegment, number>;
  eventsLast24h: number;
  engagementRate: number; // 0-1
}

export interface UXInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'success';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  relatedFeature?: string;
}

// ─── Seed Data Helpers ────────────────────────────────────────────────────────

const FEATURES = [
  'balances', 'analytics', 'transfer', 'build-transaction',
  'workflows', 'search', 'dashboard', 'settings', 'help',
  'wallet-connect', 'table-view', 'notifications',
];

const ACTIONS = ['view', 'click', 'submit', 'export', 'filter', 'search'];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function classifySegment(eventCount: number): UserSegment {
  if (eventCount === 0) return 'new';
  if (eventCount < 5) return 'casual';
  if (eventCount < 15) return 'regular';
  return 'power';
}

function generateSeedSessions(count: number): Session[] {
  const sessions: Session[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const startOffset = Math.random() * 30 * 24 * 60 * 60 * 1000; // last 30 days
    const startTime = now - startOffset;
    const duration = 60_000 + Math.random() * 20 * 60_000; // 1–21 min
    const eventCount = Math.floor(2 + Math.random() * 20);

    const events: FeatureEvent[] = Array.from({ length: eventCount }, (_, j) => ({
      feature: randomChoice(FEATURES),
      action: randomChoice(ACTIONS),
      timestamp: startTime + (duration / eventCount) * j,
      sessionId: `session-${i}`,
    }));

    sessions.push({
      id: `session-${i}`,
      startTime,
      endTime: startTime + duration,
      events,
      cohortWeek: isoWeek(new Date(startTime)),
      segment: classifySegment(eventCount),
    });
  }

  return sessions;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class UserAnalyticsService {
  private sessions: Session[] = [];
  private currentSession: Session | null = null;
  private abTests: ABTest[] = [];
  private consentGiven = false;

  constructor() {
    this.sessions = generateSeedSessions(80);
    this._initCurrentSession();
    this._initABTests();
  }

  // ── Privacy / Consent ──────────────────────────────────────────────────────

  grantConsent(): void {
    this.consentGiven = true;
  }

  revokeConsent(): void {
    this.consentGiven = false;
    // In production: purge stored data here
  }

  hasConsent(): boolean {
    return this.consentGiven;
  }

  // ── Session Management ────────────────────────────────────────────────────

  private _initCurrentSession(): void {
    const id = `session-live-${Date.now()}`;
    this.currentSession = {
      id,
      startTime: Date.now(),
      events: [],
      cohortWeek: isoWeek(new Date()),
      segment: 'new',
    };
  }

  trackEvent(feature: string, action: string, metadata?: Record<string, string | number | boolean>): void {
    if (!this.consentGiven || !this.currentSession) return;

    const event: FeatureEvent = {
      feature,
      action,
      timestamp: Date.now(),
      sessionId: this.currentSession.id,
      metadata,
    };

    this.currentSession.events.push(event);
    this.currentSession.segment = classifySegment(this.currentSession.events.length);
  }

  endCurrentSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.sessions.push({ ...this.currentSession });
      this._initCurrentSession();
    }
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  getOverview(): AnalyticsOverview {
    const allSessions = this.currentSession
      ? [...this.sessions, this.currentSession]
      : this.sessions;

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;

    const completedSessions = allSessions.filter((s) => s.endTime);
    const avgDuration =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.endTime! - s.startTime), 0) /
          completedSessions.length
        : 0;

    const allEvents = allSessions.flatMap((s) => s.events);
    const events24h = allEvents.filter((e) => e.timestamp >= last24h);

    const featureCount: Record<string, number> = {};
    allEvents.forEach((e) => {
      featureCount[e.feature] = (featureCount[e.feature] ?? 0) + 1;
    });
    const topFeatures = Object.entries(featureCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([feature, interactions]) => ({ feature, interactions }));

    const segmentBreakdown: Record<UserSegment, number> = { new: 0, casual: 0, regular: 0, power: 0 };
    allSessions.forEach((s) => {
      segmentBreakdown[s.segment]++;
    });

    const engagementRate =
      allSessions.length > 0
        ? allSessions.filter((s) => s.events.length > 3).length / allSessions.length
        : 0;

    return {
      totalSessions: allSessions.length,
      activeSessions: this.currentSession ? 1 : 0,
      avgSessionDuration: avgDuration,
      totalEvents: allEvents.length,
      topFeatures,
      segmentBreakdown,
      eventsLast24h: events24h.length,
      engagementRate,
    };
  }

  // ── Feature Adoption ──────────────────────────────────────────────────────

  getFeatureAdoption(): FeatureAdoption[] {
    const allSessions = [...this.sessions];
    const allEvents = allSessions.flatMap((s) => s.events);

    return FEATURES.map((feature) => {
      const featureEvents = allEvents.filter((e) => e.feature === feature);
      const sessionIds = new Set(featureEvents.map((e) => e.sessionId));
      const timestamps = featureEvents.map((e) => e.timestamp);

      const now = Date.now();
      const recentCutoff = now - 7 * 24 * 60 * 60 * 1000;
      const oldCutoff = now - 14 * 24 * 60 * 60 * 1000;
      const recentCount = featureEvents.filter((e) => e.timestamp >= recentCutoff).length;
      const oldCount = featureEvents.filter(
        (e) => e.timestamp >= oldCutoff && e.timestamp < recentCutoff
      ).length;

      let trend: FeatureAdoption['trend'] = 'stable';
      if (recentCount > oldCount * 1.1) trend = 'up';
      else if (recentCount < oldCount * 0.9) trend = 'down';

      return {
        feature,
        totalInteractions: featureEvents.length,
        uniqueSessions: sessionIds.size,
        adoptionRate: allSessions.length > 0 ? sessionIds.size / allSessions.length : 0,
        firstUsed: timestamps.length > 0 ? Math.min(...timestamps) : 0,
        lastUsed: timestamps.length > 0 ? Math.max(...timestamps) : 0,
        trend,
      };
    }).sort((a, b) => b.totalInteractions - a.totalInteractions);
  }

  // ── User Journey ─────────────────────────────────────────────────────────

  getJourneySteps(): JourneyStep[] {
    const allSessions = [...this.sessions];
    const featureCounts: Record<string, number> = {};
    const totalSessions = allSessions.length;

    // Count how many sessions visited each feature at each ordinal position
    const positionFeatures: string[][] = [[], [], [], [], []];
    allSessions.forEach((s) => {
      const visited = s.events.map((e) => e.feature);
      positionFeatures[0].push(...new Set(visited.slice(0, 1)));
      if (visited.length > 1) positionFeatures[1].push(...new Set(visited.slice(1, 2)));
      if (visited.length > 2) positionFeatures[2].push(...new Set(visited.slice(2, 3)));
      if (visited.length > 3) positionFeatures[3].push(...new Set(visited.slice(3, 4)));
      if (visited.length > 4) positionFeatures[4].push(...new Set(visited.slice(4, 5)));
    });

    // Aggregate all events
    allSessions.flatMap((s) => s.events).forEach((e) => {
      featureCounts[e.feature] = (featureCounts[e.feature] ?? 0) + 1;
    });

    const sorted = Object.entries(featureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    let prevCount = totalSessions;
    return sorted.map(([feature, count]) => {
      const sessionVisits = allSessions.filter((s) =>
        s.events.some((e) => e.feature === feature)
      ).length;
      const dropOffRate = prevCount > 0 ? Math.max(0, 1 - sessionVisits / prevCount) : 0;
      prevCount = sessionVisits;
      return { feature, count: sessionVisits, dropOffRate };
    });
  }

  // ── A/B Testing ──────────────────────────────────────────────────────────

  private _initABTests(): void {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;

    this.abTests = [
      {
        id: 'test-nav-layout',
        name: 'Navigation Layout Redesign',
        status: 'active',
        startTime: now - 2 * week,
        variants: [
          {
            id: 'control',
            name: 'Current Nav',
            sessions: 412,
            conversions: 148,
            conversionRate: 0.359,
          },
          {
            id: 'variant-a',
            name: 'Tabbed Nav',
            sessions: 398,
            conversions: 167,
            conversionRate: 0.42,
            uplift: 0.17,
          },
        ],
      },
      {
        id: 'test-onboarding',
        name: 'Onboarding Flow v2',
        status: 'active',
        startTime: now - week,
        variants: [
          {
            id: 'control',
            name: 'Tutorial Overlay',
            sessions: 203,
            conversions: 61,
            conversionRate: 0.30,
          },
          {
            id: 'variant-a',
            name: 'Interactive Checklist',
            sessions: 211,
            conversions: 89,
            conversionRate: 0.422,
            uplift: 0.407,
          },
        ],
      },
      {
        id: 'test-cta-color',
        name: 'Transfer CTA Color',
        status: 'concluded',
        startTime: now - 4 * week,
        endTime: now - 2 * week,
        variants: [
          {
            id: 'control',
            name: 'Blue Button',
            sessions: 890,
            conversions: 267,
            conversionRate: 0.30,
          },
          {
            id: 'variant-a',
            name: 'Green Button',
            sessions: 902,
            conversions: 324,
            conversionRate: 0.359,
            uplift: 0.197,
          },
        ],
      },
    ];
  }

  getABTests(): ABTest[] {
    return this.abTests;
  }

  // ── Cohort Analysis ───────────────────────────────────────────────────────

  getCohortData(): CohortData[] {
    const cohortMap: Record<string, Session[]> = {};

    this.sessions.forEach((s) => {
      if (!cohortMap[s.cohortWeek]) cohortMap[s.cohortWeek] = [];
      cohortMap[s.cohortWeek].push(s);
    });

    const sortedWeeks = Object.keys(cohortMap).sort().slice(-6);

    return sortedWeeks.map((week, weekIndex) => {
      const cohortSessions = cohortMap[week];
      const startSize = cohortSessions.length;

      // Simulate week-over-week retention with realistic decay
      const baseRetention = 1;
      const retention = [100];
      for (let w = 1; w <= 5 - weekIndex; w++) {
        const decay = Math.max(0.1, baseRetention - w * (0.15 + Math.random() * 0.1));
        retention.push(Math.round(decay * 100));
      }

      return { cohortWeek: week, startSize, retention };
    });
  }

  // ── Segmentation ─────────────────────────────────────────────────────────

  getSegmentDetails(): Array<{
    segment: UserSegment;
    count: number;
    avgEvents: number;
    avgDuration: number;
    topFeature: string;
    conversionRate: number;
  }> {
    const segments: UserSegment[] = ['new', 'casual', 'regular', 'power'];

    return segments.map((segment) => {
      const segSessions = this.sessions.filter((s) => s.segment === segment);
      if (segSessions.length === 0) {
        return { segment, count: 0, avgEvents: 0, avgDuration: 0, topFeature: '-', conversionRate: 0 };
      }

      const avgEvents =
        segSessions.reduce((sum, s) => sum + s.events.length, 0) / segSessions.length;

      const completedSessions = segSessions.filter((s) => s.endTime);
      const avgDuration =
        completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + (s.endTime! - s.startTime), 0) /
            completedSessions.length
          : 0;

      const featureCount: Record<string, number> = {};
      segSessions.flatMap((s) => s.events).forEach((e) => {
        featureCount[e.feature] = (featureCount[e.feature] ?? 0) + 1;
      });
      const topFeature =
        Object.entries(featureCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '-';

      // Conversion = sessions that used transfer or build-transaction
      const converted = segSessions.filter((s) =>
        s.events.some((e) => e.feature === 'transfer' || e.feature === 'build-transaction')
      ).length;
      const conversionRate = segSessions.length > 0 ? converted / segSessions.length : 0;

      return { segment, count: segSessions.length, avgEvents, avgDuration, topFeature, conversionRate };
    });
  }

  // ── Insights ─────────────────────────────────────────────────────────────

  getInsights(): UXInsight[] {
    const adoption = this.getFeatureAdoption();
    const overview = this.getOverview();
    const segments = this.getSegmentDetails();
    const insights: UXInsight[] = [];

    // Low adoption features
    adoption
      .filter((f) => f.adoptionRate < 0.1 && f.totalInteractions > 0)
      .slice(0, 2)
      .forEach((f) => {
        insights.push({
          id: `low-adoption-${f.feature}`,
          type: 'opportunity',
          title: `Low adoption: ${f.feature}`,
          description: `Only ${(f.adoptionRate * 100).toFixed(1)}% of sessions use "${f.feature}". Users may not be discovering it.`,
          impact: 'medium',
          recommendation: `Consider adding a tooltip or onboarding prompt to highlight "${f.feature}" to new users.`,
          relatedFeature: f.feature,
        });
      });

    // Trending up
    adoption
      .filter((f) => f.trend === 'up' && f.adoptionRate > 0.2)
      .slice(0, 1)
      .forEach((f) => {
        insights.push({
          id: `trending-up-${f.feature}`,
          type: 'success',
          title: `Growing feature: ${f.feature}`,
          description: `"${f.feature}" is seeing increased usage this week (+10%+ week-over-week).`,
          impact: 'low',
          recommendation: `Keep investing in "${f.feature}" — users are engaging more. Consider expanding its capabilities.`,
          relatedFeature: f.feature,
        });
      });

    // Low engagement rate
    if (overview.engagementRate < 0.4) {
      insights.push({
        id: 'low-engagement',
        type: 'warning',
        title: 'Below-average session engagement',
        description: `Only ${(overview.engagementRate * 100).toFixed(0)}% of sessions have more than 3 interactions. Many users are bouncing quickly.`,
        impact: 'high',
        recommendation: 'Improve the landing experience and add contextual calls-to-action to guide users toward core features.',
      });
    }

    // Power users are a small slice
    const powerFraction =
      overview.totalSessions > 0
        ? overview.segmentBreakdown.power / overview.totalSessions
        : 0;
    if (powerFraction < 0.15) {
      insights.push({
        id: 'few-power-users',
        type: 'opportunity',
        title: 'Activate more power users',
        description: `Power users represent only ${(powerFraction * 100).toFixed(0)}% of sessions. Increasing this ratio drives retention and referrals.`,
        impact: 'high',
        recommendation: 'Implement a progressive engagement ladder: reward users who reach milestones (first transfer, first workflow, etc.).',
      });
    }

    // Conversion gap between segments
    const newConv = segments.find((s) => s.segment === 'new')?.conversionRate ?? 0;
    const powerConv = segments.find((s) => s.segment === 'power')?.conversionRate ?? 0;
    if (powerConv - newConv > 0.3) {
      insights.push({
        id: 'conversion-gap',
        type: 'opportunity',
        title: 'Large new-user conversion gap',
        description: `New users convert at ${(newConv * 100).toFixed(0)}% vs power users at ${(powerConv * 100).toFixed(0)}%. There is a significant drop-off before users reach proficiency.`,
        impact: 'high',
        recommendation: 'Introduce a "First Transaction" guided flow to reduce friction for new users attempting their first transfer.',
      });
    }

    return insights;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const userAnalyticsService = new UserAnalyticsService();
