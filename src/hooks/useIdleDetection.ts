import { useEffect, useRef, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, update, set, push, get, increment } from 'firebase/database';

interface IdleDetectionOptions {
  idleTimeout: number;
  userId?: string;
  adminId?: string;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  isActive: boolean;
  onIdleStart?: () => void;
  onIdleEnd?: () => void;
  onIdleNotification?: (idleTime: number) => void;
}

interface IdleDetectorInstance {
  userState: 'active' | 'idle';
  addEventListener: (type: 'change', listener: () => void | Promise<void>) => void;
  start: (options: { threshold: number }) => Promise<void>;
}

declare global {
  interface Window {
    IdleDetector?: {
      requestPermission: () => Promise<'granted' | 'denied'>;
      new (): IdleDetectorInstance;
    };
  }
}

const getTodayString = (): string => new Date().toISOString().split('T')[0];

export const useIdleDetection = (options: IdleDetectionOptions) => {
  const {
    idleTimeout = 120000,
    userId,
    adminId,
    employeeName,
    employeeEmail,
    department,
    isActive,
    onIdleStart,
    onIdleEnd,
    onIdleNotification,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const setIdleState = (value: boolean) => {
    isIdleRef.current = value;
    setIsIdle(value);
  };

  const idleStartTimeRef = useRef<number | null>(null);
  const notificationSentRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const sessionEndingRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const idleDetectorRef = useRef<IdleDetectorInstance | null>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);

  // =========================================================
  // UPDATE ACTIVITY NODE – FIXED idleStartTime reset
  // =========================================================
  const updateActivityNode = useCallback(
    async (isIdleNow: boolean, startTime?: number) => {
      if (!userId) return;
      try {
        await set(ref(database, `activity/${userId}`), {
          isIdle: isIdleNow,
          status: isIdleNow ? 'idle' : 'active',
          // FIX: idleStartTime is null when active, otherwise set to startTime or now
          idleStartTime: isIdleNow ? (startTime || Date.now()) : null,
          lastActive: Date.now(),
          timestamp: Date.now(),
          ...(employeeName && { employeeName }),
          ...(employeeEmail && { employeeEmail }),
          ...(department && { department }),
        });
      } catch (error) {
        console.error('Failed to update activity node:', error);
      }
    },
    [userId, employeeName, employeeEmail, department]
  );

  // =========================================================
  // START IDLE SESSION
  // =========================================================
  const startIdleSession = useCallback(async () => {
    if (!userId || !isActive || currentSessionIdRef.current) return;
    try {
      const today = getTodayString();
      const sessionsRef = ref(database, `idleLogs/${userId}/${today}/sessions`);
      const newSessionRef = push(sessionsRef);
      const sessionId = newSessionRef.key;
      if (!sessionId) return;
      currentSessionIdRef.current = sessionId;
      sessionEndingRef.current = false;
      await set(newSessionRef, { startTime: new Date().toISOString() });
      await updateActivityNode(true, Date.now());
    } catch (error) {
      console.error('Failed to start idle session:', error);
    }
  }, [userId, isActive, updateActivityNode]);

  // =========================================================
  // END IDLE SESSION
  // =========================================================
  const endIdleSession = useCallback(async () => {
    if (!userId || !currentSessionIdRef.current || sessionEndingRef.current) return;
    sessionEndingRef.current = true;
    try {
      const sessionId = currentSessionIdRef.current;
      const today = getTodayString();
      const sessionRef = ref(database, `idleLogs/${userId}/${today}/sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      const sessionData = snapshot.val() as { startTime?: string } | null;
      if (sessionData?.startTime) {
        const startTime = new Date(sessionData.startTime).getTime();
        const endTime = Date.now();
        let durationMs = endTime - startTime;
        const MAX_IDLE_DURATION = 12 * 60 * 60 * 1000;
        if (durationMs > MAX_IDLE_DURATION) durationMs = MAX_IDLE_DURATION;
        if (durationMs > 0) {
          await update(sessionRef, {
            endTime: new Date(endTime).toISOString(),
            durationMs,
          });
          await update(ref(database, `idleLogs/${userId}/${today}`), {
            totalIdleMs: increment(durationMs),
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to end idle session:', error);
    } finally {
      currentSessionIdRef.current = null;
      sessionEndingRef.current = false;
    }
  }, [userId]);

  // =========================================================
  // NOTIFICATIONS – FIXED employeeName fallback
  // =========================================================
  const sendIdleNotification = useCallback(async () => {
    if (!userId || !adminId || notificationSentRef.current) return;
    try {
      notificationSentRef.current = true;
      const notificationRef = ref(database, `users/${adminId}/idleNotifications/${userId}`);
      await set(notificationRef, {
        isIdle: true,
        idleStartTime: idleStartTimeRef.current || Date.now(),
        idleDuration: idleTimeout,
        lastActive: lastActivityTimeRef.current,
        status: 'unread',
        // FIX: fallback to 'Unknown Employee' instead of userId
        employeeName: employeeName || 'Unknown Employee',
        employeeEmail: employeeEmail || '',
        department: department || '',
        timestamp: Date.now(),
      });
      onIdleNotification?.(idleTimeout);
    } catch (error) {
      console.error('Error sending idle notification:', error);
    }
  }, [userId, adminId, idleTimeout, employeeName, employeeEmail, department, onIdleNotification]);

  // =========================================================
  // CLEAR IDLE NOTIFICATION – FIXED full reset
  // =========================================================
  const clearIdleNotification = useCallback(async () => {
    if (!userId || !adminId) return;
    try {
      notificationSentRef.current = false;
      const notificationRef = ref(database, `users/${adminId}/idleNotifications/${userId}`);
      await update(notificationRef, {
        isIdle: false,
        idleEndTime: Date.now(),
        idleStartTime: null,
        idleDuration: 0,
        status: 'resolved',
      });
    } catch (error) {
      console.error('Error clearing idle notification:', error);
    }
  }, [userId, adminId]);

  // =========================================================
  // IDLE DETECTOR API
  // =========================================================
  useEffect(() => {
    if (!window.IdleDetector) {
      setApiSupported(false);
      return;
    }
    const initIdleDetector = async () => {
      try {
        const IdleDetectorClass = window.IdleDetector;
        const permission = await IdleDetectorClass.requestPermission();
        if (permission !== 'granted') {
          setApiSupported(false);
          return;
        }
        const detector = new IdleDetectorClass();
        detector.addEventListener('change', async () => {
          if (!isActive) return;
          if (detector.userState === 'idle' && !isIdleRef.current) {
            idleStartTimeRef.current = Date.now();
            await startIdleSession();
            setIdleState(true);
            onIdleStart?.();
            sendIdleNotification();
          }
          if (detector.userState === 'active' && isIdleRef.current) {
            await updateActivityNode(false);
            await endIdleSession();
            await clearIdleNotification();
            setIdleState(false);
            idleStartTimeRef.current = null;
            lastActivityTimeRef.current = Date.now();
            onIdleEnd?.();
          }
        });
        await detector.start({ threshold: idleTimeout });
        idleDetectorRef.current = detector;
        setApiSupported(true);
      } catch (error) {
        console.error('IdleDetector init failed:', error);
        setApiSupported(false);
      }
    };
    initIdleDetector();
    return () => { idleDetectorRef.current = null; };
  }, [idleTimeout, isActive, startIdleSession, endIdleSession, updateActivityNode, sendIdleNotification, clearIdleNotification, onIdleStart, onIdleEnd]);

  // =========================================================
  // FORCE ACTIVE DETECTION – manual events
  // =========================================================
  useEffect(() => {
    const handleUserActivity = async () => {
      if (!isIdleRef.current) return;
      await updateActivityNode(false);
      await endIdleSession();
      await clearIdleNotification();
      setIdleState(false);
      idleStartTimeRef.current = null;
      lastActivityTimeRef.current = Date.now();
      onIdleEnd?.();
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleUserActivity));
    return () => events.forEach(event => window.removeEventListener(event, handleUserActivity));
  }, [endIdleSession, clearIdleNotification, updateActivityNode, onIdleEnd]);

  // =========================================================
  // FALLBACK TIMER (when IdleDetector not supported)
  // =========================================================
  useEffect(() => {
    if (apiSupported === true) return;
    if (apiSupported === null) return;
    const resetFallbackTimer = () => {
      if (!isActive) return;
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (isIdleRef.current) {
        updateActivityNode(false).catch(console.error);
        endIdleSession();
        clearIdleNotification();
        setIdleState(false);
        idleStartTimeRef.current = null;
        onIdleEnd?.();
      }
      lastActivityTimeRef.current = Date.now();
      fallbackTimerRef.current = setTimeout(() => {
        if (!isActive) return;
        const inactiveTime = Date.now() - lastActivityTimeRef.current;
        if (inactiveTime >= idleTimeout && !isIdleRef.current) {
          idleStartTimeRef.current = Date.now();
          startIdleSession();
          setIdleState(true);
          onIdleStart?.();
          sendIdleNotification();
        }
      }, idleTimeout);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => resetFallbackTimer();
    events.forEach(ev => window.addEventListener(ev, handler));
    resetFallbackTimer();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [apiSupported, isActive, idleTimeout, startIdleSession, endIdleSession, updateActivityNode, sendIdleNotification, clearIdleNotification, onIdleStart, onIdleEnd]);

  // =========================================================
  // HEARTBEAT
  // =========================================================
  useEffect(() => {
    const heartbeat = setInterval(async () => {
      if (userId && isActive) {
        try {
          await update(ref(database, `activity/${userId}`), { lastHeartbeat: Date.now() });
        } catch (error) { console.error('Heartbeat update failed:', error); }
      }
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [userId, isActive]);

  // =========================================================
  // FORCE END IDLE
  // =========================================================
  const forceEndIdle = useCallback(async () => {
    if (!isIdleRef.current) return;
    await updateActivityNode(false);
    await endIdleSession();
    await clearIdleNotification();
    setIdleState(false);
    idleStartTimeRef.current = null;
    lastActivityTimeRef.current = Date.now();
    onIdleEnd?.();
  }, [updateActivityNode, endIdleSession, clearIdleNotification, onIdleEnd]);

  useEffect(() => {
    if (!isActive && isIdleRef.current) forceEndIdle();
  }, [isActive, forceEndIdle]);

  const resetIdleTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (isIdleRef.current) forceEndIdle();
  }, [forceEndIdle]);
// Cleanup on unmount: set activity to active
useEffect(() => {
  return () => {
    if (userId) {
      // Force activity node to active and idleStartTime null
      updateActivityNode(false).catch(console.error);
    }
  };
}, [userId, updateActivityNode]);
  return { isIdle, resetIdleTimer, forceEndIdle };
};