// // components/attendance/FaceVerification.tsx
// import React, { useRef, useState, useEffect } from 'react';
// import Webcam from 'react-webcam';
// import * as faceapi from 'face-api.js';
// import { ref, get } from 'firebase/database';
// import { database } from '../../firebase';
// import { useAuth } from '../../hooks/useAuth';
// import { Button } from '../ui/button';
// import { toast } from 'react-hot-toast';

// interface Props {
//   employeeId: string;
//   onSuccess: (imageData: string) => void;
//   onCancel: () => void;
// }

// export const FaceVerification: React.FC<Props> = ({ employeeId, onSuccess, onCancel }) => {
//   const { user } = useAuth();
//   const webcamRef = useRef<Webcam>(null);
//   const [loading, setLoading] = useState(false);
//   const [modelsLoaded, setModelsLoaded] = useState(false);

//   useEffect(() => {
//     const loadModels = async () => {
//       await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
//       await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
//       await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
//       setModelsLoaded(true);
//     };
//     loadModels();
//   }, []);

//   const verifyAndProceed = async () => {
//     if (!webcamRef.current || !user?.adminUid) return;
//     setLoading(true);
//     try {
//       // 1. Capture image from webcam
//       const imageData = webcamRef.current.getScreenshot();
//       if (!imageData) throw new Error('No image captured');

//       // 2. Convert to HTMLImageElement for FaceAPI
//       const img = new Image();
//       img.src = imageData;
//       await new Promise((resolve) => (img.onload = resolve));

//       // 3. Detect face and compute descriptor
//       const detection = await faceapi
//         .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
//         .withFaceLandmarks()
//         .withFaceDescriptor();

//       if (!detection) {
//         toast.error('No face detected. Please position yourself well.');
//         return;
//       }

//       // 4. Liveness check: ask user to blink or move head slightly?
//       // For simplicity, we can just rely on the fact that a live camera stream is used.
//       // Advanced: implement random challenge (blink detection, smile, etc.)
//       // We'll skip full liveness for brevity but you can add a simple "blink" instruction.

//       // 5. Retrieve stored descriptor from Firebase
//       const descriptorRef = ref(database, `users/${user.adminUid}/employees/${employeeId}/faceDescriptor`);
//       const snapshot = await get(descriptorRef);
//       const storedDescriptor = snapshot.val();

//       if (!storedDescriptor) {
//         toast.error('Face not registered. Please contact admin.');
//         return;
//       }

//       // 6. Compare descriptors using Euclidean distance
//       const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(storedDescriptor));
//       const threshold = 0.6; // typical value, tune as needed
//       if (distance > threshold) {
//         toast.error('Face does not match registered employee. Access denied.');
//         return;
//       }

//       // 7. Success – pass the image data to parent (for storage)
//       onSuccess(imageData);
//     } catch (error) {
//       console.error(error);
//       toast.error('Verification failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!modelsLoaded) return <div>Loading security models...</div>;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg max-w-md w-full">
//         <h2 className="text-xl font-bold mb-4">Face Verification</h2>
//         <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-lg w-full" />
//         <div className="flex gap-3 mt-4">
//           <Button onClick={verifyAndProceed} disabled={loading} className="flex-1">
//             {loading ? 'Verifying...' : 'Verify & Proceed'}
//           </Button>
//           <Button variant="outline" onClick={onCancel} className="flex-1">
//             Cancel
//           </Button>
//         </div>
//         <p className="text-xs text-gray-500 mt-3">Make sure your face is clearly visible and well‑lit.</p>
//       </div>
//     </div>
//   );
// };