import React, { useState, useEffect } from 'react';
import { Calendar, User, BarChart3, Clock } from 'lucide-react';
import { Badge } from '../../../components/ui/badge'; // Added missing import
import { useAuth } from '../../../hooks/useAuth';
import { database } from '../../../firebase';
import { ref, onValue, query, orderByChild } from 'firebase/database';

interface AttendanceRecord {
  id: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: string;
  timestamp: number;
}

interface AttendanceReportSummaryProps {
  employeeId?: string; // Optional prop to view specific employee's report
}

const AttendanceReportSummary: React.FC<AttendanceReportSummaryProps> = ({ employeeId }) => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    attendanceRate: 0,
    records: [] as AttendanceRecord[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const targetEmployeeId = employeeId || user.id;
    const adminUid = employeeId ? user.id : user.adminUid || user.id;

    const attendanceRef = ref(database, `users/${adminUid}/employees/${targetEmployeeId}/punching`);
    const attendanceQuery = query(attendanceRef, orderByChild('timestamp'));

    const unsubscribe = onValue(attendanceQuery, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<AttendanceRecord, 'id'>)
          }));

          // Sort records by date (newest first)
          records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Calculate stats for the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const recentRecords = records.filter(record => 
            new Date(record.date) >= thirtyDaysAgo
          );

          const presentDays = recentRecords.filter(record => 
            record.status === 'present' || record.status === 'late'
          ).length;

          const absentDays = recentRecords.filter(record => 
            record.status === 'absent'
          ).length;

          const lateDays = recentRecords.filter(record => 
            record.status === 'late'
          ).length;

          const totalDays = 30; // We're looking at the last 30 days
          const attendanceRate = Math.round((presentDays / totalDays) * 100);

          setReportData({
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            attendanceRate,
            records: recentRecords.slice(0, 5) // Show only 5 most recent records
          });
        } else {
          setReportData({
            totalDays: 30,
            presentDays: 0,
            absentDays: 30,
            lateDays: 0,
            attendanceRate: 0,
            records: []
          });
        }
      } catch (error) {
        console.error("Error processing attendance data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, employeeId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-blue-600">{reportData.totalDays}</p>
          <p className="text-sm text-gray-600">Total Days</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <User className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{reportData.presentDays}</p>
          <p className="text-sm text-gray-600">Present Days</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <Calendar className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{reportData.absentDays}</p>
          <p className="text-sm text-gray-600">Absent Days</p>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-600">{reportData.lateDays}</p>
          <p className="text-sm text-gray-600">Late Days</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-purple-600">{reportData.attendanceRate}%</p>
          <p className="text-sm text-gray-600">Attendance Rate</p>
        </div>
      </div>
      
      {reportData.records.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Attendance Records</h3>
          <div className="space-y-2">
            {reportData.records.map((record, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                  <Badge 
                    variant="outline"
                    className={
                      record.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' :
                      record.status === 'absent' ? 'bg-red-100 text-red-700 border-red-200' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      'bg-gray-100 text-gray-700 border-gray-200'
                    }
                  >
                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                  </Badge>
                </div>
                <div className="text-right text-sm">
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-green-500" />
                    In: {record.punchIn || '-'}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-red-500" />
                    Out: {record.punchOut || '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No attendance records found for the last 30 days
        </div>
      )}
    </>
  );
};

export default AttendanceReportSummary;