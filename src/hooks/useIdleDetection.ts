// hooks/useIdleDetection.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, push, set, update, get, increment } from 'firebase/database';

interface IdleDetectionOptions {
  idleTimeout: number;
  onIdleStart?: () => void;
  onIdleEnd?: () => void;
  userId?: string;
  employeeName?: string;
}

export const useIdleDetection = (options: IdleDetectionOptions) => {
  const {
    idleTimeout = 10000,
    onIdleStart,
    onIdleEnd,
    userId,
    employeeName,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const idleStartTimeRef = useRef<number | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const currentSessionIdRef = useRef<string | null>(null);

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const startIdleSession = useCallback(async () => {
    if (!userId) return;
    const today = getTodayString();
    const sessionsRef = ref(database, `idleLogs/${userId}/${today}/sessions`);
    const newSessionRef = push(sessionsRef);
    currentSessionIdRef.current = newSessionRef.key;
    await set(newSessionRef, { startTime: new Date().toISOString() });
    console.log(`🟡 Idle started: ${employeeName}`);
  }, [userId, employeeName]);

  const endIdleSession = useCallback(async () => {
    if (!userId || !currentSessionIdRef.current) return;
    const today = getTodayString();
    const sessionRef = ref(database, `idleLogs/${userId}/${today}/sessions/${currentSessionIdRef.current}`);
    const snapshot = await get(sessionRef);
    const sessionData = snapshot.val();
    if (sessionData?.startTime) {
      const startTime = new Date(sessionData.startTime).getTime();
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      if (durationMs > 0) {
        await update(sessionRef, { endTime: new Date(endTime).toISOString(), durationMs });
        const totalRef = ref(database, `idleLogs/${userId}/${today}/totalIdleMs`);
        const totalSnap = await get(totalRef);
        if (totalSnap.exists()) {
          await update(totalRef, { totalIdleMs: increment(durationMs) });
        } else {
          await set(totalRef, durationMs);
        }
        console.log(`✅ Idle ended: ${durationMs}ms`);
      }
    }
    currentSessionIdRef.current = null;
  }, [userId]);

  const resetIdleTimer = useCallback(async () => {
    lastActivityTimeRef.current = Date.now();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (isIdle) {
      const idleDuration = idleStartTimeRef.current ? Date.now() - idleStartTimeRef.current : 0;
      if (idleDuration > 1000) {
        await endIdleSession();
      }
      onIdleEnd?.();
      setIsIdle(false);
      idleStartTimeRef.current = null;
    }

    idleTimerRef.current = setTimeout(() => {
      const inactiveTime = Date.now() - lastActivityTimeRef.current;
      if (inactiveTime >= idleTimeout && !isIdle) {
        setIsIdle(true);
        idleStartTimeRef.current = Date.now();
        startIdleSession();
        onIdleStart?.();
      }
    }, idleTimeout);
  }, [isIdle, idleTimeout, startIdleSession, endIdleSession, onIdleStart, onIdleEnd]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetIdleTimer();
    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetIdleTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (isIdle) endIdleSession();
    };
  }, [resetIdleTimer, isIdle, endIdleSession]);

  return { isIdle, resetIdleTimer };
};