import { useCallback, useEffect, useRef } from 'react';
import { checkSyncSignals, type SyncSignals } from '../gas/client';

/** Base interval 60s with ±10s jitter */
const BASE_INTERVAL_MS = 60_000;
const JITTER_MS = 10_000;
/** Max backoff interval 10 minutes */
const MAX_INTERVAL_MS = 600_000;

function jitteredInterval(base: number): number {
  return base + (Math.random() * 2 - 1) * JITTER_MS;
}

function isConcurrentOverload(err: Error): boolean {
  return err.message.toLowerCase().includes('simultaneously') ||
    err.message.toLowerCase().includes('too many scripts');
}

export type DomainRefreshers = Partial<Record<keyof SyncSignals, () => Promise<void>>>;

/**
 * Real-time sync polling hook
 *
 * - Calls checkSyncSignals every 60s with ±10s jitter
 * - Fires refreshers only for domains whose signal value changed
 * - Pauses while document.hidden; immediately polls on tab visibility restore
 * - On error, doubles interval (up to 10 min); resets to 60s on success
 */
export function useSyncPolling(refreshers: DomainRefreshers): void {
  const refreshersRef = useRef(refreshers);
  refreshersRef.current = refreshers;

  const prevSignalsRef = useRef<SyncSignals | null>(null);
  const intervalRef = useRef(BASE_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (document.hidden) {
      console.debug('[SyncPolling] skipped (tab hidden)', new Date().toISOString());
      return;
    }
    console.debug('[SyncPolling] poll fired', new Date().toISOString(), { intervalMs: intervalRef.current });

    try {
      const signals = await checkSyncSignals();

      const prev = prevSignalsRef.current;
      console.debug('[SyncPolling] signals received', { prev, current: signals });
      if (prev !== null) {
        const domains = Object.keys(signals) as Array<keyof SyncSignals>;
        for (const domain of domains) {
          const changed = signals[domain] !== null && signals[domain] !== prev[domain];
          if (changed && refreshersRef.current[domain]) {
            console.debug('[SyncPolling] refresh firing', { domain, prev: prev[domain], next: signals[domain] });
            void refreshersRef.current[domain]!();
          }
        }
      }
      prevSignalsRef.current = signals;
      intervalRef.current = BASE_INTERVAL_MS;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isConcurrentOverload(e)) {
        intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL_MS);
      } else {
        intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL_MS);
      }
      console.debug('[SyncPolling] error', { message: e.message, nextIntervalMs: intervalRef.current });
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void poll().finally(schedule);
    }, jitteredInterval(intervalRef.current));
  }, [poll]);

  useEffect(() => {
    // Start first polling cycle
    schedule();

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // On tab restore, poll immediately before resuming the schedule
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        void poll().finally(schedule);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll, schedule]);
}
