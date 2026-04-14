// src/components/employee/TimeTracker.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Play, StopCircle, Edit, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ref, update, set, increment } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import ManualTimeLogModal from './ManualTimeLogModal';

interface TimeTrackerProps {
  projectId: string;
  taskId: string;
  currentTotalMs?: number;
  onTimeLogged: () => void;
}

const TimeTracker: React.FC<TimeTrackerProps> = ({ projectId, taskId, currentTotalMs = 0, onTimeLogged }) => {
  const { user } = useAuth();
  const [runningTimer, setRunningTimer] = useState<{ logId: string; startTime: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (runningTimer) {
      interval = setInterval(() => {
        setElapsed(Date.now() - runningTimer.startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [runningTimer]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const startTimer = async () => {
    if (runningTimer) return;
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user?.id,
      employeeName: user?.name,
      startTime: Date.now(),
      endTime: null,
      durationMs: 0,
      note: '',
      loggedAt: Date.now(),
      isRunning: true,
    });
    setRunningTimer({ logId, startTime: Date.now() });
    setElapsed(0);
  };

  const stopTimer = async () => {
    if (!runningTimer) return;
    const endTime = Date.now();
    const duration = endTime - runningTimer.startTime;
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${runningTimer.logId}`);
    await update(logRef, { endTime, durationMs: duration, isRunning: false });
    const taskRef = ref(database, `projects/${projectId}/tasks/${taskId}`);
    await update(taskRef, { totalTimeSpentMs: increment(duration) });
    setRunningTimer(null);
    toast.success(`Logged ${Math.round(duration / 60000)} minutes`);
    onTimeLogged();
  };

  const handleManualLog = async (hours: number, minutes: number, note: string) => {
    const durationMs = (hours * 60 + minutes) * 60000;
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user?.id,
      employeeName: user?.name,
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      note,
      loggedAt: Date.now(),
      isRunning: false,
    });
    const taskRef = ref(database, `projects/${projectId}/tasks/${taskId}`);
    await update(taskRef, { totalTimeSpentMs: increment(durationMs) });
    toast.success('Time logged manually');
    onTimeLogged();
  };

  return (
    <div className="border-t pt-3">
      <h4 className="text-sm font-medium mb-2">Time Tracking</h4>
      <div className="flex items-center gap-3">
        {runningTimer ? (
          <Button size="sm" variant="outline" onClick={stopTimer} className="bg-red-50">
            <StopCircle className="h-4 w-4 mr-1" /> Stop ({formatDuration(elapsed)})
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startTimer}>
            <Play className="h-4 w-4 mr-1" /> Start Timer
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setShowManualModal(true)}>
          <Edit className="h-4 w-4 mr-1" /> Log Time
        </Button>
      </div>
      <div className="mt-2 text-sm text-gray-600">
        Total logged: {formatDuration(currentTotalMs)}
      </div>
      <ManualTimeLogModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSave={handleManualLog}
      />
    </div>
  );
};

export default TimeTracker;