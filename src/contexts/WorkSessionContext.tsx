// src/contexts/WorkSessionContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ref, onValue, set, update, get, increment } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth'; // ✅ import useAuth

interface WorkSessionContextType {
  isPunchedIn: boolean;
  isOnBreak: boolean;
  punchIn: () => Promise<void>;
  punchOut: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  loading: boolean;
}

const WorkSessionContext = createContext<WorkSessionContextType | undefined>(undefined);

export const useWorkSession = () => {
  const context = useContext(WorkSessionContext);
  if (!context) throw new Error('useWorkSession must be used within WorkSessionProvider');
  return context;
};

export const WorkSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [loading, setLoading] = useState(true);

  const sessionRef = user?.id ? ref(database, `workSessions/${user.id}`) : null;

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = onValue(sessionRef!, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsPunchedIn(data.isPunchedIn || false);
        setIsOnBreak(data.isOnBreak || false);
      } else {
        set(sessionRef!, { isPunchedIn: false, isOnBreak: false });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.id, sessionRef]);

  const punchIn = async () => {
    if (!user?.id) return;
    await set(sessionRef!, {
      isPunchedIn: true,
      isOnBreak: false,
      punchInTime: Date.now(),
      lastUpdated: Date.now(),
    });
  };

  const punchOut = async () => {
    if (!user?.id) return;
    await update(sessionRef!, {
      isPunchedIn: false,
      isOnBreak: false,
      punchOutTime: Date.now(),
      lastUpdated: Date.now(),
    });
  };

  const startBreak = async () => {
    if (!user?.id || !isPunchedIn || isOnBreak) return;
    await update(sessionRef!, {
      isOnBreak: true,
      breakStartTime: Date.now(),
      lastUpdated: Date.now(),
    });
  };

  const endBreak = async () => {
    if (!user?.id || !isPunchedIn || !isOnBreak) return;
    const snapshot = await get(sessionRef!);
    const data = snapshot.val();
    const breakStart = data?.breakStartTime;
    if (breakStart) {
      const breakDuration = Date.now() - breakStart;
      await update(sessionRef!, {
        isOnBreak: false,
        totalBreakDuration: increment(breakDuration),
        lastUpdated: Date.now(),
      });
    } else {
      await update(sessionRef!, { isOnBreak: false, lastUpdated: Date.now() });
    }
  };

  return (
    <WorkSessionContext.Provider value={{ isPunchedIn, isOnBreak, punchIn, punchOut, startBreak, endBreak, loading }}>
      {children}
    </WorkSessionContext.Provider>
  );
};