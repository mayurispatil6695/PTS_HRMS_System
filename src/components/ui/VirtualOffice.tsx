import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { X, ExternalLink, Copy } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off } from 'firebase/database';

const VirtualOffice: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const globalRef = ref(database, 'globalVirtualOffice');
    const unsubscribe = onValue(globalRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.link) {
        setMeetingLink(data.link);
        setError(null);
      } else {
        setMeetingLink(null);
        setError('No virtual office set. Please ask admin to create one.');
      }
      setLoading(false);
    });

    return () => off(globalRef);
  }, [open]);

  const openInNewTab = () => {
    if (meetingLink) window.open(meetingLink, '_blank');
  };

  const copyLink = () => {
    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink);
      alert('Meeting link copied to clipboard!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-6">
        <DialogHeader className="flex flex-row justify-between items-center mb-4">
          <DialogTitle>Virtual Office – {user?.department || 'Company'}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading meeting link...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : meetingLink ? (
            <>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2">Meeting link:</p>
                <code className="text-xs bg-white p-2 rounded block break-all border">
                  {meetingLink}
                </code>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={openInNewTab} className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Meeting (New Tab)
                </Button>
                <Button variant="outline" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Click the button to open the meeting in a new browser tab.
                Make sure your camera and microphone are enabled.
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VirtualOffice;