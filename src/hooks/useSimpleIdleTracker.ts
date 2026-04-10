import { useEffect, useRef } from 'react';
import { ref, update, increment, set, get } from 'firebase/database';
import { database } from '../firebase';

interface SimpleIdleTrackerOptions {
  userId?: string;
  idleThresholdMs?: number; // default 10000 (10 seconds)
  checkIntervalMs?: number; // default 60000 (1 minute)
}

export const useSimpleIdleTracker = ({
  userId,
  idleThresholdMs = 10000,
  checkIntervalMs = 60000,
}: SimpleIdleTrackerOptions) => {
  const lastActivityRef = useRef<number>(Date.now());
  const idleStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to update last activity time
  const updateActivity = () => {
    lastActivityRef.current = Date.now();
  };

  // Function to log an idle session (called when user returns from idle)
  const logIdleSession = async (startTime: number, endTime: number) => {
    if (!userId) return;
    const durationMs = endTime - startTime;
    if (durationMs <= 0) return;

    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${startTime}`; // unique enough
    const sessionRef = ref(database, `idleLogs/${userId}/${today}/sessions/${sessionId}`);

    await set(sessionRef, {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs,
    });

    // Increment daily total
    const totalRef = ref(database, `idleLogs/${userId}/${today}/totalIdleMs`);
    const snapshot = await get(totalRef);
    if (snapshot.exists()) {
      await update(totalRef, { totalIdleMs: increment(durationMs) });
    } else {
      await set(totalRef, durationMs);
    }
    console.log(`Idle session logged: ${durationMs}ms`);
  };

  // Periodic check
  useEffect(() => {
    if (!userId) return;

    // Attach activity event listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));
    updateActivity(); // initial

    intervalRef.current = setInterval(async () => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;

      if (idleTime >= idleThresholdMs) {
        // User is currently idle
        if (idleStartTimeRef.current === null) {
          // Just became idle
          idleStartTimeRef.current = lastActivityRef.current;
          console.log(`Idle started at ${new Date(idleStartTimeRef.current).toISOString()}`);
        }
        // else already idle, do nothing
      } else {
        // User is active
        if (idleStartTimeRef.current !== null) {
          // Just became active after idle period
          const endTime = now;
          const startTime = idleStartTimeRef.current;
          await logIdleSession(startTime, endTime);
          idleStartTimeRef.current = null;
        }
      }
    }, checkIntervalMs);

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Log any ongoing idle session on unmount
      if (idleStartTimeRef.current !== null) {
        logIdleSession(idleStartTimeRef.current, Date.now());
      }
    };
  }, [userId, idleThresholdMs, checkIntervalMs]);
};