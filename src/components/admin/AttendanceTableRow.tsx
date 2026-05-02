import React, { useState } from 'react';
import { Clock, AlertTriangle, Sun, Trash2, Eye } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AttendanceRecord } from '@/types/attendance';
import { calculateNetWorkDuration, calculateTotalBreakTime, isLateArrival, getRemark } from '../../utils/attendanceHelpers';

interface Props {
  record: AttendanceRecord;
  onMarkLate: (id: string, employeeUid: string, adminId?: string) => void;
  onMarkHalfDay: (id: string, employeeUid: string, adminId?: string) => void;
  onReset: (id: string, employeeUid: string, adminId?: string) => void;
  onDelete: (id: string, employeeUid: string, adminId?: string) => void;
  getStatusColor: (status: string) => string;
}

const AttendanceTableRow: React.FC<Props> = React.memo(({
  record,
  onMarkLate,
  onMarkHalfDay,
  onReset,
  onDelete,
  getStatusColor
}) => {
  const [imageModal, setImageModal] = useState<{ src: string; title: string } | null>(null);
  const adminId = record.adminId;
  const employeeUid = record.employeeId;

  // If adminId is missing, you can fetch from a separate map; for brevity, assume it's on record

  const renderBreaksTooltip = () => {
    if (!record.breaks || Object.keys(record.breaks).length === 0) return <span className="text-gray-400">No breaks</span>;
    return (
      <div className="max-w-xs">
        {Object.entries(record.breaks).map(([breakId, breakData]) => (
          <div key={breakId} className="mb-1 last:mb-0">
            <div className="font-medium">Break {breakId}</div>
            <div className="text-sm">
              <span className="text-green-600">{breakData.breakIn}</span> to{' '}
              {breakData.breakOut ? <span className="text-red-600">{breakData.breakOut}</span> : <span className="text-yellow-600">ongoing</span>}
              {breakData.duration && <span className="block text-gray-500">Duration: {breakData.duration}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
          <div className="text-xs text-gray-500">{record.employeeId}</div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
          {new Date(record.date).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <Clock className="h-3 w-3" /> {record.punchIn || '-'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-sm text-red-600">
            <Clock className="h-3 w-3" /> {record.punchOut || '-'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {calculateNetWorkDuration(record.punchIn, record.punchOut, record.breaks)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="group relative">
            <span className="cursor-help text-sm text-gray-700 underline decoration-dotted">
              {calculateTotalBreakTime(record.breaks)}
            </span>
            <div className="absolute z-10 hidden group-hover:block bg-white p-3 border rounded-lg shadow-lg w-64">
              {renderBreaksTooltip()}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <Badge className={`${getStatusColor(record.status)} text-xs font-medium`}>
              {record.status}
            </Badge>
            {isLateArrival(record.punchIn) && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 text-xs border-yellow-200">
                Late arrival
              </Badge>
            )}
            {record.markedLateBy && (
              <p className="text-xs text-gray-500">Late by {record.markedLateBy}</p>
            )}
            {record.markedHalfDayBy && (
              <p className="text-xs text-gray-500">Half‑day by {record.markedHalfDayBy}</p>
            )}
            <p className="text-xs text-gray-400 italic">{getRemark(record)}</p>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <Badge variant="outline" className="text-xs font-medium">{record.workMode || 'office'}</Badge>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {record.selfie ? (
            <img
              src={record.selfie}
              alt="Punch In"
              className="w-8 h-8 rounded-full object-cover cursor-pointer border border-gray-300 hover:opacity-80"
              onClick={() => setImageModal({ src: record.selfie!, title: `Punch In - ${record.employeeName}` })}
            />
          ) : <span className="text-gray-400 text-sm">—</span>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {record.selfieOut ? (
            <img
              src={record.selfieOut}
              alt="Punch Out"
              className="w-8 h-8 rounded-full object-cover cursor-pointer border border-gray-300 hover:opacity-80"
              onClick={() => setImageModal({ src: record.selfieOut!, title: `Punch Out - ${record.employeeName}` })}
            />
          ) : <span className="text-gray-400 text-sm">—</span>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex gap-1 flex-wrap">
            {record.status === 'late' ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onMarkHalfDay(record.id, employeeUid, adminId)} className="text-purple-600 h-8 px-2 text-xs">
                  <Sun className="h-3 w-3 mr-1" /> Half Day
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReset(record.id, employeeUid, adminId)} className="text-green-600 h-8 px-2 text-xs">
                  Reset
                </Button>
              </>
            ) : record.status === 'half-day' ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onMarkLate(record.id, employeeUid, adminId)} className="text-yellow-600 h-8 px-2 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Late
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReset(record.id, employeeUid, adminId)} className="text-green-600 h-8 px-2 text-xs">
                  Reset
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => onMarkLate(record.id, employeeUid, adminId)} className="text-yellow-600 h-8 px-2 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Late
                </Button>
                <Button size="sm" variant="outline" onClick={() => onMarkHalfDay(record.id, employeeUid, adminId)} className="text-purple-600 h-8 px-2 text-xs">
                  <Sun className="h-3 w-3 mr-1" /> Half Day
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => onDelete(record.id, employeeUid, adminId)} className="text-red-600 h-8 px-2">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>

      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setImageModal(null)}>
          <div className="relative max-w-3xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img src={imageModal.src} alt={imageModal.title} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            <div className="mt-4 flex justify-between items-center">
              <p className="text-white font-medium">{imageModal.title}</p>
              <button onClick={() => setImageModal(null)} className="px-4 py-2 bg-white rounded-md text-gray-800 hover:bg-gray-100">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default AttendanceTableRow;