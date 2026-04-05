import React, { useState, useEffect } from 'react';
import { FileText, User, Calendar, BarChart3 } from 'lucide-react';
import { database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface ProjectsReportSummaryProps {
  adminUid?: string;
}

interface ReportData {
  totalProjects: number;
  completed: number;
  inProgress: number;
  avgProgress: number;
}

const ProjectsReportSummary: React.FC<ProjectsReportSummaryProps> = ({ adminUid }) => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<ReportData>({
    totalProjects: 0,
    completed: 0,
    inProgress: 0,
    avgProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminUid && !user?.adminUid) {
      setLoading(false);
      return;
    }

    const uid = adminUid || user?.adminUid;
    const projectsRef = ref(database, `users/${uid}/projects`);

    const unsubscribe = onValue(projectsRef, (snapshot) => {
      try {
        const projectsData = snapshot.val();
        if (projectsData) {
          const projectsArray = Object.values(projectsData) as any[];
          
          const totalProjects = projectsArray.length;
          const completed = projectsArray.filter(project => project.status === 'completed').length;
          const inProgress = projectsArray.filter(project => 
            project.status === 'in_progress' || project.status === 'on_hold'
          ).length;
          
          const totalProgress = projectsArray.reduce((sum, project) => {
            return sum + (Number(project.progress) || 0);
          }, 0);
          
          const avgProgress = totalProjects > 0 ? totalProgress / totalProjects : 0;

          setReportData({
            totalProjects,
            completed,
            inProgress,
            avgProgress
          });
        } else {
          setReportData({
            totalProjects: 0,
            completed: 0,
            inProgress: 0,
            avgProgress: 0
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Error calculating report data:", error);
        toast.error("Failed to load report data");
        setLoading(false);
      }
    }, (error) => {
      console.error("Error setting up listener:", error);
      toast.error("Failed to load report data");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [adminUid, user?.adminUid]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="text-center p-4 bg-gray-50 rounded-lg animate-pulse">
            <div className="h-8 w-8 bg-gray-200 rounded-full mx-auto mb-2"></div>
            <div className="h-8 w-3/4 bg-gray-200 rounded mx-auto mb-2"></div>
            <div className="h-4 w-1/2 bg-gray-200 rounded mx-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-blue-600">{reportData.totalProjects}</p>
        <p className="text-sm text-gray-600">Total Projects</p>
      </div>
      <div className="text-center p-4 bg-green-50 rounded-lg">
        <User className="h-8 w-8 text-green-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-green-600">{reportData.completed}</p>
        <p className="text-sm text-gray-600">Completed</p>
      </div>
      <div className="text-center p-4 bg-yellow-50 rounded-lg">
        <Calendar className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-yellow-600">{reportData.inProgress}</p>
        <p className="text-sm text-gray-600">In Progress</p>
      </div>
      <div className="text-center p-4 bg-purple-50 rounded-lg">
        <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-purple-600">{Math.round(reportData.avgProgress)}%</p>
        <p className="text-sm text-gray-600">Avg Progress</p>
      </div>
    </div>
  );
};

export default ProjectsReportSummary;