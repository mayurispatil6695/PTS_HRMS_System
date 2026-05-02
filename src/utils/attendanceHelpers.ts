import { BreakRecord } from '@/types/attendance';

export const convertTimeToMinutes = (timeStr: string): number => {
  try {
    let hours = 0, minutes = 0;
    const trimmed = timeStr.trim().toUpperCase();
    if (!trimmed.includes('AM') && !trimmed.includes('PM')) {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else {
      const [time, period] = trimmed.split(' ');
      const [h, m] = time.split(':').map(Number);
      hours = h;
      minutes = m;
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

export const parseDurationToMinutes = (durationStr: string): number => {
  if (!durationStr) return 0;
  const colonMatch = durationStr.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  const hoursMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutesMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*m/i);
  let total = 0;
  if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
  if (minutesMatch) total += parseFloat(minutesMatch[1]);
  return Math.round(total);
};

export const calculateNetWorkDuration = (
  punchIn: string,
  punchOut: string | null,
  breaks?: Record<string, BreakRecord>
): string => {
  if (!punchOut) return 'N/A';
  const startMin = convertTimeToMinutes(punchIn);
  const endMin = convertTimeToMinutes(punchOut);
  let totalMin = endMin - startMin;
  if (totalMin < 0) totalMin += 24 * 60;
  if (totalMin > 12 * 60) totalMin -= 24 * 60;
  if (totalMin < 0) totalMin = 0;

  let breakMin = 0;
  if (breaks) {
    Object.values(breaks).forEach(b => {
      if (b.duration) breakMin += parseDurationToMinutes(b.duration);
    });
  }
  const netMin = totalMin - breakMin;
  const hours = Math.floor(netMin / 60);
  const minutes = netMin % 60;
  return `${hours}h ${minutes}m`;
};

export const calculateTotalBreakTime = (breaks: Record<string, BreakRecord> | undefined): string => {
  if (!breaks) return 'N/A';
  let totalBreakMinutes = 0;
  Object.values(breaks).forEach(breakRecord => {
    if (breakRecord.breakOut && breakRecord.duration) {
      totalBreakMinutes += parseDurationToMinutes(breakRecord.duration);
    }
  });
  const hours = Math.floor(totalBreakMinutes / 60);
  const minutes = totalBreakMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export const isLateArrival = (punchIn: string, thresholdHour = 9, thresholdMinute = 40): boolean => {
  if (!punchIn) return false;
  const minutes = convertTimeToMinutes(punchIn);
  const threshold = thresholdHour * 60 + thresholdMinute;
  return minutes > threshold;
};

export const getRemark = (record: {
  punchIn: string;
  punchOut: string | null;
  status: string;
  breaks?: Record<string, BreakRecord>;
}): string => {
  const isLate = isLateArrival(record.punchIn);
  if (!record.punchOut) {
    return isLate
      ? `Punched in late (${record.punchIn}) but not yet punched out – final status pending.`
      : `On time (${record.punchIn}) but not yet punched out – final status pending.`;
  }
  const netHoursStr = calculateNetWorkDuration(record.punchIn, record.punchOut, record.breaks);
  const netHoursMatch = netHoursStr.match(/^(\d+)h/);
  const netHours = netHoursMatch ? parseInt(netHoursMatch[1], 10) : 0;
  if (record.status === 'half-day') {
    return `Half‑day because net worked hours (${netHoursStr}) < 4`;
  }
  if (record.status === 'late') {
    return `Punched in after 9:40 AM (${record.punchIn}) but worked ≥4 hours (net ${netHoursStr}) – marked as late.`;
  }
  if (isLate && record.status === 'present') {
    return `Late arrival (${record.punchIn}) but worked ≥4 hours (net ${netHoursStr}) – marked as present.`;
  }
  return `On time and worked ≥4 hours (net ${netHoursStr}).`;
};