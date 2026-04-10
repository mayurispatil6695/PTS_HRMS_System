import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const ManagerHome = () => {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="text-2xl font-bold">Manager Home</h2>
      <p>Welcome, {user?.name}. This is your team overview.</p>
    </div>
  );
};
export default ManagerHome;