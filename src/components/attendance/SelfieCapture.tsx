// src/components/attendance/SelfieCapture.tsx
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
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  // Stop all tracks and clean up intervals
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
    setIsLoadingCamera(false);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    stopCamera(); // Ensure previous stream is gone
    setError(null);
    setIsCameraReady(false);
    setIsLoadingCamera(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
            .then(() => {
              if (videoRef.current && videoRef.current.videoWidth > 0) {
                setIsCameraReady(true);
              } else {
                setError('Camera stream has no dimensions. Please refresh.');
              }
            })
            .catch((err) => {
              console.error('Video play error:', err);
              setError('Failed to start video stream.');
            });
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      let errorMsg = 'Unable to access camera. ';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') errorMsg += 'Please allow camera permission.';
        else if (err.name === 'NotFoundError') errorMsg += 'No camera found on this device.';
        else errorMsg += err.message;
      } else if (err instanceof Error) {
        errorMsg += err.message;
      }
      setError(errorMsg);
    } finally {
      setIsLoadingCamera(false);
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

  const retakeSelfie = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    setCountdown(null);
    setIsCapturing(false);
    startCamera();
  }, [startCamera]);

  const confirmSelfie = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  }, [capturedImage, onCapture, onClose]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    setCountdown(null);
    setIsCapturing(false);
    onClose();
  }, [stopCamera, onClose]);

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

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Camera className="h-5 w-5" />
            {punchType} Selfie – {employeeName}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Please capture a clear selfie for {punchType.toLowerCase()} verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="break-words">{error}</span>
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
                {(isLoadingCamera || (!isCameraReady && !error)) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="text-white text-6xl sm:text-7xl font-bold animate-pulse">
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
                  : isLoadingCamera
                  ? 'Loading camera...'
                  : 'Capture Selfie'}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <img
                src={capturedImage}
                alt="Captured selfie"
                className="w-32 h-32 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-green-500 mx-auto"
              />
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={retakeSelfie} className="text-sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={confirmSelfie} className="text-sm">
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

export default React.memo(SelfieCapture);