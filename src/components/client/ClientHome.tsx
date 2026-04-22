import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FolderOpen, MessageCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ClientHome = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Client Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.companyName || user?.name}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><FolderOpen className="h-8 w-8 text-orange-500" /><div><p className="text-sm text-gray-500">Active Projects</p><p className="text-2xl font-bold">2</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><MessageCircle className="h-8 w-8 text-blue-500" /><div><p className="text-sm text-gray-500">Open Chats</p><p className="text-2xl font-bold">3</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><TrendingUp className="h-8 w-8 text-green-500" /><div><p className="text-sm text-gray-500">Project Progress</p><p className="text-2xl font-bold">75%</p></div></div></CardContent></Card>
      </div>
    </div>
  );
};

export default ClientHome;