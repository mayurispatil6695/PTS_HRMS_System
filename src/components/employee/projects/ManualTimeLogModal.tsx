// src/components/employee/ManualTimeLogModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: number, minutes: number, note: string) => void;
}

const ManualTimeLogModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (hours === 0 && minutes === 0) {
      alert('Please enter time');
      return;
    }
    onSave(hours, minutes, note);
    setHours(0);
    setMinutes(0);
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Time Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Hours</Label>
              <Input type="number" min={0} value={hours} onChange={(e) => setHours(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualTimeLogModal;