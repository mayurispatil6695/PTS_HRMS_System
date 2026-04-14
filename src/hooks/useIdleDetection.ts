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
  isActive: boolean; // true = punched in and not on break
}

export const useIdleDetection = (options: IdleDetectionOptions) => {
  const {
    idleTimeout = 300000, // 5 minutes (was 10000) – adjust as needed
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

  const startIdleSession = useCallback(async () => {
    if (!userId || !adminId || !isActive) return;
    const today = getTodayString();
    const sessionsRef = ref(database, `users/${adminId}/employees/${userId}/idleLogs/${today}/sessions`);
    const newSessionRef = push(sessionsRef);
    const sessionId = newSessionRef.key;
    currentSessionIdRef.current = sessionId;
    await set(newSessionRef, { startTime: new Date().toISOString() });
    await updateActivityNode(true, Date.now());
    console.log(`Idle session started for ${employeeName || userId}`);
  }, [userId, adminId, employeeName, isActive, updateActivityNode]);

  const endIdleSession = useCallback(async () => {
    if (!userId || !adminId || !currentSessionIdRef.current) return;
    const today = getTodayString();
    const sessionRef = ref(database, `users/${adminId}/employees/${userId}/idleLogs/${today}/sessions/${currentSessionIdRef.current}`);
    const snapshot = await get(sessionRef);
    const sessionData = snapshot.val();
    if (sessionData && sessionData.startTime) {
      const startTime = new Date(sessionData.startTime).getTime();
      const endTime = Date.now();
      let durationMs = endTime - startTime;
      // Cap at 12 hours to avoid impossible values (e.g., overnight sessions)
      const maxMs = 12 * 60 * 60 * 1000;
      if (durationMs > maxMs) durationMs = maxMs;
      if (durationMs > 0) {
        await update(sessionRef, {
          endTime: new Date(endTime).toISOString(),
          durationMs,
        });
        const totalRef = ref(database, `users/${adminId}/employees/${userId}/idleLogs/${today}/totalIdleMs`);
        await update(totalRef, {
          totalIdleMs: increment(durationMs),
          lastUpdated: new Date().toISOString(),
        });
        console.log(`Idle session ended: ${durationMs}ms for ${employeeName || userId}`);
      }
    }
    currentSessionIdRef.current = null;
    await updateActivityNode(false);
  }, [userId, adminId, employeeName, updateActivityNode]);

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
        employeeName: employeeName || userId,
        employeeEmail: employeeEmail || '',
        department: department || '',
        timestamp: Date.now(),
      });
      onIdleNotification?.(idleTimeout);
      console.log(`Idle notification sent for user: ${employeeName || userId}`);
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
        console.log(`User ${employeeName || userId} returned after ${idleDuration}ms`);
        endIdleSession();
        onIdleEnd?.();
        clearIdleNotification();
      }
      setIsIdle(false);
      idleStartTimeRef.current = null;
    }

    idleTimerRef.current = setTimeout(() => {
      if (!isActive) return;
      const now = Date.now();
      const inactiveTime = now - lastActivityTimeRef.current;
      if (inactiveTime >= idleTimeout && !isIdle) {
        console.log(`User ${employeeName || userId} became idle`);
        setIsIdle(true);
        idleStartTimeRef.current = now;
        startIdleSession();
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

    // ✅ Add visibilitychange handler to avoid false idle when tab is hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible – simulate activity
        resetIdleTimer();
      } else if (document.visibilityState === 'hidden') {
        // Tab hidden – end any ongoing idle session immediately
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
      if (userId && adminId && isIdle && currentSessionIdRef.current) endIdleSession();
      if (userId && adminId && isIdle) clearIdleNotification();
    };
  }, [resetIdleTimer, updateUserActivity, isIdle, checkInterval, userId, adminId, sendIdleNotification, clearIdleNotification, endIdleSession, isActive]);

  return { isIdle, resetIdleTimer };
};