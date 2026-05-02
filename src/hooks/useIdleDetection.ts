// src/hooks/useIdleDetection.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, update, set, push, get, increment } from 'firebase/database';

interface IdleDetectionOptions {
  idleTimeout: number;
  checkInterval?: number;
  onIdleStart?: () => void;
  onIdleEnd?: () => void;
  onIdleNotification?: (idleTime: number) => void;
  userId?: string;
  adminId?: string;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  isActive: boolean;
}

export const useIdleDetection = (options: IdleDetectionOptions) => {
  const {
    idleTimeout = 10000,
    checkInterval = 1000,
    onIdleStart,
    onIdleEnd,
    onIdleNotification,
    userId,
    adminId,
    employeeName,
    employeeEmail,
    department,
    isActive,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const idleStartTimeRef = useRef<number | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const notificationSentRef = useRef<boolean>(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const sessionEndingRef = useRef<boolean>(false);

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const updateActivityNode = useCallback(async (isIdleNow: boolean, startTime?: number) => {
    if (!userId) return;
    const activityRef = ref(database, `activity/${userId}`);
    await set(activityRef, {
      isIdle: isIdleNow,
      status: isIdleNow ? 'idle' : 'active',
      idleStartTime: startTime || null,
      lastActive: lastActivityTimeRef.current,
      timestamp: Date.now(),
      ...(employeeName && { employeeName }),
      ...(employeeEmail && { employeeEmail }),
      ...(department && { department }),
    });
  }, [userId, employeeName, employeeEmail, department]);

  const startIdleSession = useCallback(async (customStartTimestamp?: number) => {
    if (!userId || !isActive) return;
    if (currentSessionIdRef.current) return;

    const today = getTodayString();
    const sessionsRef = ref(database, `idleLogs/${userId}/${today}/sessions`);
    const newSessionRef = push(sessionsRef);
    const sessionId = newSessionRef.key;
    currentSessionIdRef.current = sessionId;
    sessionEndingRef.current = false;

    const startTime = customStartTimestamp
      ? new Date(customStartTimestamp).toISOString()
      : new Date().toISOString();
    await set(newSessionRef, { startTime });
    await updateActivityNode(true, customStartTimestamp || Date.now());

    console.log(`[Idle] Session started for ${employeeName || userId} at ${startTime}`);
  }, [userId, isActive, employeeName, updateActivityNode]);

  const endIdleSession = useCallback(async () => {
    if (!userId || !currentSessionIdRef.current) return;
    if (sessionEndingRef.current) return;
    sessionEndingRef.current = true;

    const sessionId = currentSessionIdRef.current;
    const today = getTodayString();
    const sessionRef = ref(database, `idleLogs/${userId}/${today}/sessions/${sessionId}`);
    const snapshot = await get(sessionRef);
    const sessionData = snapshot.val();

    if (sessionData && sessionData.startTime) {
      const startTime = new Date(sessionData.startTime).getTime();
      const endTime = Date.now();
      let durationMs = endTime - startTime;
      if (durationMs < 0) durationMs = 0;
      if (durationMs > 12 * 60 * 60 * 1000) durationMs = 12 * 60 * 60 * 1000;

      if (durationMs > 0) {
        await update(sessionRef, {
          endTime: new Date(endTime).toISOString(),
          durationMs,
        });
        const totalRef = ref(database, `idleLogs/${userId}/${today}/totalIdleMs`);
        const totalSnap = await get(totalRef);
        if (!totalSnap.exists()) {
          await set(totalRef, 0);
        }
        await update(totalRef, {
          totalIdleMs: increment(durationMs),
          lastUpdated: new Date().toISOString(),
        });
        console.log(`[Idle] Session ended: +${durationMs}ms for ${employeeName || userId}`);
      }
    }

    currentSessionIdRef.current = null;
    setTimeout(() => { sessionEndingRef.current = false; }, 500);
    await updateActivityNode(false);
  }, [userId, employeeName, updateActivityNode]);

  // ✅ SINGLE sendIdleNotification – notifies both admin AND the idle employee
  const sendIdleNotification = useCallback(async () => {
    if (!userId || !adminId || notificationSentRef.current) return;
    try {
      notificationSentRef.current = true;

      // 1. Notify admin (existing)
      const notificationRef = ref(database, `users/${adminId}/idleNotifications/${userId}`);
      await set(notificationRef, {
        isIdle: true,
        idleStartTime: idleStartTimeRef.current || Date.now(),
        idleDuration: idleTimeout,
        lastActive: lastActivityTimeRef.current,
        status: 'unread',
        employeeName: employeeName || userId,
        employeeEmail: employeeEmail || '',
        department: department || '',
        timestamp: Date.now(),
      });

      // 2. Notify the idle employee themselves (in‑app notification)
      const employeeNotifRef = push(ref(database, `notifications/${userId}`));
      await set(employeeNotifRef, {
        title: '⏳ Idle Reminder',
        body: `You have been idle for ${idleTimeout / 1000} seconds. Please resume work or update your status.`,
        type: 'idle_reminder',
        read: false,
        createdAt: Date.now(),
      });

      // 3. Browser notification for the employee (if permission granted)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Idle Reminder', {
          body: `You have been idle for ${idleTimeout / 1000} seconds.`,
          icon: '/logo.png',
        });
      }

      onIdleNotification?.(idleTimeout);
      console.log(`[IdleDetection] Sent idle reminder to employee ${employeeName || userId}`);
    } catch (error) {
      console.error('Error sending idle notification:', error);
    }
  }, [userId, adminId, idleTimeout, employeeName, employeeEmail, department, onIdleNotification]);

  const clearIdleNotification = useCallback(async () => {
    if (!userId || !adminId) return;
    try {
      notificationSentRef.current = false;
      const notificationRef = ref(database, `users/${adminId}/idleNotifications/${userId}`);
      await update(notificationRef, {
        isIdle: false,
        idleEndTime: Date.now(),
        status: 'resolved',
      });
    } catch (error) {
      console.error('Error clearing idle notification:', error);
    }
  }, [userId, adminId]);

  // Force end idle session when isActive becomes false
  useEffect(() => {
    if (!isActive && currentSessionIdRef.current) {
      endIdleSession();
      setIsIdle(false);
      idleStartTimeRef.current = null;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }
  }, [isActive, endIdleSession]);

  // Reset timer on user activity
  const resetIdleTimer = useCallback(() => {
    if (!isActive) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (isIdle) {
        const idleDuration = idleStartTimeRef.current ? Date.now() - idleStartTimeRef.current : 0;
        if (idleDuration > 500) {
          endIdleSession();
          onIdleEnd?.();
          clearIdleNotification();
        }
        setIsIdle(false);
        idleStartTimeRef.current = null;
      }
      return;
    }

    lastActivityTimeRef.current = Date.now();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (isIdle) {
      const idleDuration = idleStartTimeRef.current ? Date.now() - idleStartTimeRef.current : 0;
      if (idleDuration > 500) {
        endIdleSession();
        onIdleEnd?.();
        clearIdleNotification();
      }
      setIsIdle(false);
      idleStartTimeRef.current = null;
    }

    const activityMoment = Date.now();
    idleTimerRef.current = setTimeout(() => {
      if (lastActivityTimeRef.current > activityMoment) return;
      if (!isActive) return;
      const now = Date.now();
      const inactiveTime = now - activityMoment;
      if (inactiveTime >= idleTimeout && !isIdle) {
        console.log(`[Idle] User became idle after ${inactiveTime}ms`);
        setIsIdle(true);
        idleStartTimeRef.current = activityMoment;
        startIdleSession(activityMoment);
        onIdleStart?.();
        sendIdleNotification();
      }
    }, idleTimeout);
  }, [isActive, isIdle, idleTimeout, onIdleStart, onIdleEnd, userId, adminId, employeeName, sendIdleNotification, clearIdleNotification, startIdleSession, endIdleSession]);

  const updateUserActivity = useCallback(async () => {
    if (userId && adminId && !isIdle && isActive) {
      try {
        const activityRef = ref(database, `users/${adminId}/employees/${userId}/lastActive`);
        await update(activityRef, {
          timestamp: Date.now(),
          lastSeen: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error updating activity:', error);
      }
    }
  }, [userId, adminId, isIdle, isActive]);

  // Global activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus', 'load'];
    const handleActivity = () => {
      resetIdleTimer();
      updateUserActivity();
    };
    events.forEach(event => window.addEventListener(event, handleActivity));
    resetIdleTimer();

    checkIntervalRef.current = setInterval(() => {
      if (isIdle && idleStartTimeRef.current && isActive) {
        const currentIdleTime = Date.now() - idleStartTimeRef.current;
        const idleSeconds = Math.floor(currentIdleTime / 1000);
        if (idleSeconds > 0 && idleSeconds % 30 === 0 && !notificationSentRef.current) {
          sendIdleNotification();
        }
      }
    }, checkInterval);

    const handleBeforeUnload = () => {
      if (isIdle && currentSessionIdRef.current) endIdleSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetIdleTimer();
      } else if (document.visibilityState === 'hidden') {
        if (isIdle && currentSessionIdRef.current) {
          endIdleSession();
          setIsIdle(false);
          idleStartTimeRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (userId && isIdle && currentSessionIdRef.current) endIdleSession();
      if (userId && adminId && isIdle) clearIdleNotification();
    };
  }, [resetIdleTimer, updateUserActivity, isIdle, checkInterval, userId, adminId, sendIdleNotification, clearIdleNotification, endIdleSession, isActive]);

  return { isIdle, resetIdleTimer };
};