import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get, push, set } from 'firebase/database';

const TaskReminder: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const checkOverdueTasks = async () => {
      if (!user?.adminUid) return;
      const today = new Date().toISOString().split('T')[0];
      const lastCheckKey = `lastOverdueCheck_${user.id}`;
      const lastCheck = localStorage.getItem(lastCheckKey);
      if (lastCheck === today) return;

      const projectsSnap = await get(ref(database, 'projects'));
      const projects = projectsSnap.val() as Record<string, any> | null;
      if (!projects) return;

      let overdueCount = 0;

      for (const [projId, proj] of Object.entries(projects)) {
        if (!proj.tasks) continue;
        for (const task of Object.values(proj.tasks) as any[]) {
          if (task.status === 'completed') continue;
          if (task.dueDate && task.dueDate < today) {
            const employeeId = task.assignedTo;
            if (!employeeId) continue;
            const employeeRef = ref(database, `users/${user.adminUid}/employees/${employeeId}`);
            const empSnap = await get(employeeRef);
            if (empSnap.exists()) overdueCount++;
          }
        }
      }

      if (overdueCount > 0) {
        const notifRef = push(ref(database, `notifications/${user.id}`));
        await set(notifRef, {
          title: '⚠️ Overdue Tasks Alert',
          body: `You have ${overdueCount} overdue task(s) in your team.`,
          type: 'overdue_tasks',
          read: false,
          createdAt: Date.now(),
        });
        if (Notification.permission === 'granted') {
          new Notification('Overdue Tasks', { body: `${overdueCount} task(s) overdue.`, icon: '/logo.png' });
        }
      }
      localStorage.setItem(lastCheckKey, today);
    };
    checkOverdueTasks();
  }, [user]);

  return null;
};

export default TaskReminder;