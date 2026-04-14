// src/components/employee/TaskUpdateHistory.tsx
import React from 'react';
import { format } from 'date-fns';

interface Update {
  timestamp: string;
  updatedBy: string;
  updatedByRole?: string;
  changes: { field: string; oldValue: any; newValue: any }[];
  note?: string;
}

const TaskUpdateHistory: React.FC<{ updates: Update[] }> = ({ updates }) => {
  if (!updates.length) return null;
  return (
    <div className="border-t pt-3">
      <h4 className="text-sm font-medium mb-2">Update History</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {updates.map((update, idx) => (
          <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
            <div className="flex justify-between">
              <span className="font-medium">
                {update.updatedByRole === 'admin' ? 'Admin' : update.updatedByRole === 'team_lead' ? 'Team Lead' : update.updatedBy}
              </span>
              <span className="text-gray-500">{format(new Date(update.timestamp), 'MMM dd, HH:mm')}</span>
            </div>
            {update.changes.map((change, i) => (
              <p key={i}>
                Changed <span className="font-medium">{change.field}</span> from
                <span className="italic"> "{change.oldValue}"</span> to
                <span className="font-medium"> "{change.newValue}"</span>
              </p>
            ))}
            {update.note && <p className="mt-1 italic">Note: "{update.note}"</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskUpdateHistory;