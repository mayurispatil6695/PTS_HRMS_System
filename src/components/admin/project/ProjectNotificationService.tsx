
interface Employee {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export const sendNotificationToEmployee = (employee: Employee, project: Project) => {
  // Create notification for employee
  const notification = {
    id: Date.now().toString(),
    type: 'project_assigned',
    title: 'New Project Assigned',
    message: `You have been assigned to project: ${project.name}`,
    projectId: project.id,
    employeeId: employee.id,
    timestamp: new Date().toISOString(),
    read: false
  };

  // Save notification to localStorage (in real app, this would be sent to backend)
  const existingNotifications = JSON.parse(localStorage.getItem(`notifications_${employee.id}`) || '[]');
  existingNotifications.push(notification);
  localStorage.setItem(`notifications_${employee.id}`, JSON.stringify(existingNotifications));

  console.log(`Notification sent to ${employee.name} for project ${project.name}`);
};
