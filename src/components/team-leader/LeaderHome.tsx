import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const LeaderHome = () => {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Team Leader Dashboard</h2>
      <p>Welcome, {user?.name}. Manage daily tasks, breaks, and attendance.</p>
    </div>
  );
};
export default LeaderHome;