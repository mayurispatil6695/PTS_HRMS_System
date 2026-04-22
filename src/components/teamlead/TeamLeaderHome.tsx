import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Users, Clock, Calendar, CheckSquare } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const TeamLeaderHome = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Lead Overview</h1>
        <p className="text-gray-600">Manage your team's projects, tasks, and attendance</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><Users className="h-8 w-8 text-purple-500" /><div><p className="text-sm text-gray-500">Team Size</p><p className="text-2xl font-bold">8</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><FolderOpen className="h-8 w-8 text-blue-500" /><div><p className="text-sm text-gray-500">Active Projects</p><p className="text-2xl font-bold">3</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><CheckSquare className="h-8 w-8 text-green-500" /><div><p className="text-sm text-gray-500">Pending Tasks</p><p className="text-2xl font-bold">12</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><Clock className="h-8 w-8 text-orange-500" /><div><p className="text-sm text-gray-500">Present Today</p><p className="text-2xl font-bold">6</p></div></div></CardContent></Card>
      </div>
    </div>
  );
};

export default TeamLeaderHome;