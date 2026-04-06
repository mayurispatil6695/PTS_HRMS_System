// hooks/useIdleDetection.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, update, set } from 'firebase/database';

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
    department
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const idleStartTimeRef = useRef<number | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const notificationSentRef = useRef<boolean>(false);

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
        timestamp: Date.now()
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
        status: 'resolved'
      });
    } catch (error) {
      console.error('Error clearing idle notification:', error);
    }
  }, [userId, adminId]);

  const resetIdleTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (isIdle) {
      const idleDuration = idleStartTimeRef.current ? Date.now() - idleStartTimeRef.current : 0;
      if (idleDuration > 500) {
        console.log(`User ${employeeName || userId} returned after ${idleDuration}ms`);
        onIdleEnd?.();
        clearIdleNotification();
      }
      setIsIdle(false);
      idleStartTimeRef.current = null;
    }

    idleTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityTimeRef.current;
      
      if (inactiveTime >= idleTimeout && !isIdle) {
        console.log(`User ${employeeName || userId} became idle`);
        setIsIdle(true);
        idleStartTimeRef.current = now;
        onIdleStart?.();
        sendIdleNotification();
      }
    }, idleTimeout);
  }, [isIdle, idleTimeout, onIdleStart, onIdleEnd, userId, adminId, employeeName, sendIdleNotification, clearIdleNotification]);

  // ✅ Only updates lastActive – never touches status
  const updateUserActivity = useCallback(async () => {
    if (userId && adminId && !isIdle) {
      try {
        const activityRef = ref(database, `users/${adminId}/employees/${userId}/lastActive`);
        await update(activityRef, {
          timestamp: Date.now(),
          lastSeen: new Date().toISOString()
          // ❌ No 'status' field here
        });
      } catch (error) {
        console.error('Error updating activity:', error);
      }
    }
  }, [userId, adminId, isIdle]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus', 'load'];
    
    const handleActivity = () => {
      resetIdleTimer();
      updateUserActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    resetIdleTimer();

    checkIntervalRef.current = setInterval(() => {
      if (isIdle && idleStartTimeRef.current) {
        const currentIdleTime = Date.now() - idleStartTimeRef.current;
        const idleSeconds = Math.floor(currentIdleTime / 1000);
        
        if (idleSeconds > 0 && idleSeconds % 30 === 0 && !notificationSentRef.current) {
          sendIdleNotification();
        }
      }
    }, checkInterval);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      
      if (userId && adminId && isIdle) {
        clearIdleNotification();
      }
    };
  }, [resetIdleTimer, updateUserActivity, isIdle, checkInterval, userId, adminId, sendIdleNotification, clearIdleNotification]);

  return { isIdle, resetIdleTimer };
};