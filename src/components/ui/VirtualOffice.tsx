import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Video, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface VirtualOfficeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VirtualOffice: React.FC<VirtualOfficeProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  const dept = (user?.department || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const roomName = `hrms-virtual-office-${dept}`;
  const jitsiUrl = `https://meet.jit.si/${roomName}`;

  const reloadIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = jitsiUrl;
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b flex-row justify-between items-center">
          <DialogTitle>Virtual Office – {user?.department || 'General'}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="flex-1 relative bg-gray-100">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <Button onClick={reloadIframe}>Retry</Button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={jitsiUrl}
              title="Virtual Office"
              className="w-full h-full border-0"
              allow="camera; microphone; display-capture; autoplay"
              onError={() => setError('Failed to load meeting. Click Retry.')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VirtualOffice;