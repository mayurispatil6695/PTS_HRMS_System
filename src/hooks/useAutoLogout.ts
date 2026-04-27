// import { useEffect, useRef } from 'react';
// import { useAuth } from './useAuth';
// import { useNavigate } from 'react-router-dom';
// import { toast } from 'react-hot-toast';

// export const useAutoLogout = (logoutTime: string = '18:30') => {
//   const { logout } = useAuth();
//   const navigate = useNavigate();
//   const reminderShown = useRef(false);

//   useEffect(() => {
//     const checkLogout = () => {
//       const now = new Date();
//       const target = new Date();
//       const [hours, minutes] = logoutTime.split(':').map(Number);
//       target.setHours(hours, minutes, 0, 0);

//       const diffMs = target.getTime() - now.getTime();
//       const diffMinutes = diffMs / (1000 * 60);

//       // 10 minutes before – show reminder (without JSX)
//       if (diffMinutes <= 10 && diffMinutes > 0 && !reminderShown.current) {
//         reminderShown.current = true;
//         toast(`⚠️ Logout in ${Math.round(diffMinutes)} minutes (${logoutTime}). Please punch out.`, {
//           duration: 10000,
//         });
        
//         // Browser notification
//         if (Notification.permission === 'granted') {
//           new Notification('Logout Reminder', {
//             body: `You will be logged out at ${logoutTime}. Please punch out.`,
//             icon: '/logo.png'
//           });
//         }
//       }

//       // Auto logout at exact time
//       if (diffMs <= 0) {
//         logout();
//         navigate('/login');
//         toast.error('Auto logged out due to end of work day');
//       }
//     };

//     const interval = setInterval(checkLogout, 60000); // check every minute
//     checkLogout();

//     return () => clearInterval(interval);
//   }, [logoutTime, logout, navigate]);
// };