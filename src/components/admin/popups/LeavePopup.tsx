
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Plane, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
}

interface LeavePopupProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequests: LeaveRequest[];
}

const LeavePopup: React.FC<LeavePopupProps> = ({
  isOpen,
  onClose,
  leaveRequests
}) => {
  const navigate = useNavigate();

  const handleViewRequest = (requestId: string) => {
    onClose();
    navigate(`/admin/leaves?highlight=${requestId}`);
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Pending Leave Requests ({leaveRequests.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {leaveRequests.map((request) => (
            <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" />
                    <h3 className="font-semibold">{request.employeeName}</h3>
                    <Badge className="bg-yellow-100 text-yellow-700">
                      {request.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm">
                    <p><span className="font-medium">Employee ID:</span> {request.employeeId}</p>
                    <p><span className="font-medium">Leave Type:</span> {request.leaveType}</p>
                    <p><span className="font-medium">Duration:</span> {calculateDays(request.startDate, request.endDate)} days</p>
                    <p><span className="font-medium">Applied:</span> {new Date(request.appliedAt).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm"><span className="font-medium">Period:</span> {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}</p>
                    <p className="text-sm"><span className="font-medium">Reason:</span> {request.reason}</p>
                  </div>
                </div>
                
                <Button
                  onClick={() => handleViewRequest(request.id)}
                  className="ml-4"
                >
                  Review Request
                </Button>
              </div>
            </div>
          ))}
          
          {leaveRequests.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No pending leave requests
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeavePopup;
