import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const ClientHome = () => {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Client Dashboard</h2>
      <p>Welcome, {user?.name}. Here you can track your projects and timelines.</p>
    </div>
  );
};
export default ClientHome;