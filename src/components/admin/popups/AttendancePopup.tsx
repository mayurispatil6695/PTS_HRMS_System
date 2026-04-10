import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Clock, User, CalendarClock } from 'lucide-react';

// Define the missing AttendanceRecord type
interface AttendanceRecord {
  id: string;
  employeeName: string;
  department?: string;
  punchIn: string;
  punchOut?: string;
  hoursWorked?: number;
  date: string;
  status: 'present' | 'late' | 'half-day' | 'on-leave' | 'absent';
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
}
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
                <div key={record.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="font-medium">{record.employeeName}</p>
                      <p className="text-sm text-gray-600">{record.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-red-600">{record.punchIn}</p>
                    <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Half-Day Employees */}
          <div>
            <h3 className="text-lg font-semibold text-amber-600 mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Half-Day ({halfDayEmployees.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {halfDayEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getStatusBadge('half-day')}
                      {record.hoursWorked && (
                        <span className="text-xs text-amber-700">
                          {record.hoursWorked.toFixed(1)} hrs
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {record.punchIn} - {record.punchOut || 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Present Employees */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-3">Present ({presentEmployees.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {presentEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department}</p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge('present')}
                    <p className="text-xs text-gray-500 mt-1">
                      {record.punchIn} - {record.punchOut || 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* On Leave Employees */}
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-3">On Leave ({onLeaveEmployees.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {onLeaveEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department}</p>
                  </div>
                  <div>
                    {getStatusBadge('on-leave')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Absent Employees */}
          <div>
            <h3 className="text-lg font-semibold text-gray-600 mb-3">Absent ({absentEmployees.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {absentEmployees.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <p className="text-sm text-gray-600">{record.department}</p>
                  </div>
                  <div>
                    {getStatusBadge('absent')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendancePopup;