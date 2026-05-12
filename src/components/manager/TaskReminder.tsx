import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get, push, set, runTransaction } from 'firebase/database';
import { toast } from 'react-hot-toast';

// Types
interface FirebaseTask {
  status?: string;
  dueDate?: string;
  assignedTo?: string;
  [key: string]: unknown;
}

interface FirebaseProject {
  tasks?: Record<string, FirebaseTask>;
}

const TaskReminder: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const checkOverdueTasks = async () => {
      if (!user?.adminUid || !user?.id) return;

      const today = new Date().toISOString().split('T')[0];
      const lastCheckRef = ref(database, `users/${user.id}/meta/lastOverdueCheck`);

      // Use transaction to atomically read and update last check date
      let alreadyCheckedToday = false;
      await runTransaction(lastCheckRef, (current) => {
        if (current === today) {
          alreadyCheckedToday = true;
          return; // abort transaction
        }
        return today;
      });

      if (alreadyCheckedToday) return;

      try {
        const projectsSnap = await get(ref(database, 'projects'));
        const projects = projectsSnap.val() as Record<string, FirebaseProject> | null;
        if (!projects) return;

        let overdueCount = 0;

        for (const proj of Object.values(projects)) {
          if (!proj.tasks) continue;
          for (const task of Object.values(proj.tasks)) {
            if (task.status === 'completed') continue;
            if (task.dueDate && task.dueDate < today) {
              const employeeId = task.assignedTo;
              if (!employeeId) continue;
              overdueCount++;
            }
          }
        }

        if (overdueCount > 0) {
          // Only save to Firebase – browser notification handled by NotificationSystem
          const notifRef = push(ref(database, `notifications/${user.id}`));
          await set(notifRef, {
            title: '⚠️ Overdue Tasks Alert',
            body: `You have ${overdueCount} overdue task(s) in your team.`,
            type: 'overdue_tasks',
            read: false,
            createdAt: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error checking overdue tasks:', error);
        toast.error('Failed to check overdue tasks');
      }
    };

    checkOverdueTasks();
  }, [user]);

  return null;
};

export default TaskReminder;