import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Clock, User, CalendarClock } from 'lucide-react';

// ✅ Import central AttendanceRecord type
import type { AttendanceRecord } from '@/types/attendance';

interface AttendancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceData: AttendanceRecord[];
}

const AttendancePopup: React.FC<AttendancePopupProps> = ({
  isOpen,
  onClose,
  attendanceData
}) => {
  const lateEmployees = attendanceData.filter(record => record.status === 'late');
  const presentEmployees = attendanceData.filter(record => record.status === 'present');
  const halfDayEmployees = attendanceData.filter(record => record.status === 'half-day');
  const onLeaveEmployees = attendanceData.filter(record => record.status === 'on-leave');
  const absentEmployees = attendanceData.filter(record => record.status === 'absent');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="outline" className="text-green-600 border-green-200">Present</Badge>;
      case 'late':
        return <Badge variant="outline" className="text-red-600 border-red-200">Late</Badge>;
      case 'half-day':
        return <Badge variant="outline" className="text-amber-600 border-amber-200">Half Day</Badge>;
      case 'on-leave':
        return <Badge variant="outline" className="text-blue-600 border-blue-200">On Leave</Badge>;
      case 'absent':
        return <Badge variant="outline" className="text-gray-600">Absent</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Helper to format date safely
  const formatDate = (dateValue: string | Date): string => {
    if (!dateValue) return 'Invalid date';
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    }
    return dateValue.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Clock className="h-5 w-5" />
            Today's Attendance Review
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Latecomers Section */}
          <div>
            <h3 className="text-lg font-semibold text-red-600 mb-3">Latecomers ({lateEmployees.length})</h3>
            <div className="space-y-2">
              {lateEmployees.map((record) => (
                <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 gap-2">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{record.employeeName}</p>
                      <p className="text-sm text-gray-600">{record.department || '—'}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-medium text-red-600">{record.punchIn}</p>
                    <p className="text-xs text-gray-500">{formatDate(record.date)}</p>
                  </div>
                </div>
              ))}
              {lateEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic">No latecomers today</p>
              )}
            </div>
          </div>

          {/* Half-Day Employees */}
          <div>
            <h3 className="text-lg font-semibold text-amber-600 mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Half-Day ({halfDayEmployees.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {halfDayEmployees.map((record) => (
                <div key={record.id} className="flex flex-col p-3 bg-amber-50 rounded-lg border border-amber-100 gap-2">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department || '—'}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge('half-day')}
                      {record.totalHours && (
                        <span className="text-xs text-amber-700">{record.totalHours}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {record.punchIn} - {record.punchOut || 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
              {halfDayEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic">No half‑day records</p>
              )}
            </div>
          </div>

          {/* Present Employees */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-3">Present ({presentEmployees.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presentEmployees.map((record) => (
                <div key={record.id} className="flex flex-col p-3 bg-green-50 rounded-lg gap-2">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department || '—'}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {getStatusBadge('present')}
                    <p className="text-xs text-gray-500">
                      {record.punchIn} - {record.punchOut || 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
              {presentEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic">No present records</p>
              )}
            </div>
          </div>

          {/* On Leave Employees */}
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-3">On Leave ({onLeaveEmployees.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onLeaveEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department || '—'}</p>
                  </div>
                  <div>{getStatusBadge('on-leave')}</div>
                </div>
              ))}
              {onLeaveEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic">No on‑leave records</p>
              )}
            </div>
          </div>

          {/* Absent Employees */}
          <div>
            <h3 className="text-lg font-semibold text-gray-600 mb-3">Absent ({absentEmployees.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {absentEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department || '—'}</p>
                  </div>
                  <div>{getStatusBadge('absent')}</div>
                </div>
              ))}
              {absentEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic">No absent records</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendancePopup;