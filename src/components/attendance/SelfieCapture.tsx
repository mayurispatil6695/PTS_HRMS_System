import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

interface SelfieCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  employeeName: string;
  punchType?: 'Punch In' | 'Punch Out';
}

const SelfieCapture: React.FC<SelfieCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
  employeeName,
  punchType = 'Punch In',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Stop all tracks and clean up
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  // Start camera with explicit play()
  const startCamera = useCallback(async () => {
    stopCamera(); // Ensure previous stream is gone
    setError(null);
    setIsCameraReady(false);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Explicitly play and wait for it
        await videoRef.current.play();
        // Check that video dimensions are available
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
          setIsCameraReady(true);
        } else {
          // Fallback: wait for loadedmetadata
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
          };
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      let errorMsg = 'Unable to access camera. ';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') errorMsg += 'Permission denied.';
        else if (err.name === 'NotFoundError') errorMsg += 'No camera found.';
        else errorMsg += err.message;
      }
      setError(errorMsg);
    }
  }, [stopCamera]);

  // Capture image from video stream
  const captureSelfie = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError('Camera or canvas not available');
      return;
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera not ready. Please try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      stopCamera(); // release camera immediately after capture
    }
  }, [stopCamera]);

  // Countdown then capture
  const startCountdown = useCallback(() => {
    if (!isCameraReady) {
      setError('Camera is not ready. Please wait.');
      return;
    }
    setIsCapturing(true);
    setCountdown(3);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          captureSelfie();
          setIsCapturing(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isCameraReady, captureSelfie]);

  const retakeSelfie = () => {
    setCapturedImage(null);
    setError(null);
    setCountdown(null);
    startCamera();
  };

  const confirmSelfie = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    setCountdown(null);
    setIsCapturing(false);
    onClose();
  };

  // Start camera when dialog opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {punchType} Selfie – {employeeName}
          </DialogTitle>
          <DialogDescription>
            Please capture a clear selfie for {punchType.toLowerCase()} verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!capturedImage ? (
            <div className="relative">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isCameraReady && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="text-white text-7xl font-bold animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <Button
                onClick={startCountdown}
                className="w-full mt-4"
                disabled={!isCameraReady || isCapturing || countdown !== null}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isCapturing
                  ? 'Preparing...'
                  : countdown !== null
                  ? `Capturing in ${countdown}...`
                  : 'Capture Selfie'}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <img
                src={capturedImage}
                alt="Captured selfie"
                className="w-48 h-48 rounded-full object-cover border-4 border-green-500 mx-auto"
              />
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={retakeSelfie}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={confirmSelfie}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm {punchType}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelfieCapture;