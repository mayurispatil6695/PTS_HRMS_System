// services/activityService.ts
import { ref, get } from 'firebase/database';
import { database } from '../firebase';

export const getDailyActivitySummary = async (userId: string, date: string) => {
  const summaryRef = ref(database, `userActivity/${userId}/${date}/summary`);
  const snapshot = await get(summaryRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return {
      totalActiveTimeMs: data.totalActiveTime || 0,
      totalIdleTimeMs: data.totalIdleTime || 0,
    };
  }
  return { totalActiveTimeMs: 0, totalIdleTimeMs: 0 };
};

// Helper to format milliseconds into "HH:MM:SS"
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};