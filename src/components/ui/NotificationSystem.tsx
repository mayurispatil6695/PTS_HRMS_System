import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, off, update, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, FolderOpen, Calendar, AlertTriangle, UserCheck, Trash2 } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Badge } from './badge';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'task_assigned' | 'task_due' | 'mention' | 'leave_approved' | 'leave_rejected' | 'project_assigned' | 'escalation' | 'group_chat' | 'chat_message';
  read: boolean;
  createdAt: number;
  taskId?: string;
  projectId?: string;
  leaveId?: string;
  messageId?: string;
  chatType?: 'global' | 'dm';
}

interface FirebaseNotification {
  title?: string;
  body?: string;
  type?: string;
  read?: boolean;
  createdAt?: number;
  taskId?: string;
  projectId?: string;
  leaveId?: string;
  messageId?: string;
  chatType?: string;
}

interface NavigationState {
  highlightMessageId?: string;
}

const NotificationSystem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const notifRef = ref(database, `notifications/${user.id}`);
    const unsubscribe = onValue(notifRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseNotification> | null;
      const list: Notification[] = [];
      if (data) {
        Object.entries(data).forEach(([id, notif]) => {
          list.push({
            id,
            title: notif.title || 'Notification',
            body: notif.body || '',
            type: (notif.type as Notification['type']) || 'task_assigned',
            read: notif.read || false,
            createdAt: notif.createdAt || Date.now(),
            taskId: notif.taskId,
            projectId: notif.projectId,
            leaveId: notif.leaveId,
            messageId: notif.messageId,
            chatType: notif.chatType as 'global' | 'dm',
          });
        });
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    });
    return () => off(notifRef);
  }, [user?.id]);

  // Centralised browser notifications with deduplication and visibility check
  useEffect(() => {
    if (Notification.permission !== 'granted') return;
    // Do not show notifications if the tab is currently visible
    if (document.visibilityState === 'visible') return;

    notifications.forEach((n) => {
      if (shownNotifications.current.has(n.id)) return;
      if (!n.read) {
        shownNotifications.current.add(n.id);
        new Notification(n.title, {
          body: n.body,
          icon: '/favicon.ico',
        });
      }
    });
  }, [notifications]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    await update(ref(database, `notifications/${user.id}/${id}`), { read: true });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const updates: Record<string, boolean> = {};
    notifications.forEach(n => {
      updates[`${n.id}/read`] = true;
    });
    await update(ref(database, `notifications/${user.id}`), updates);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    if (!user?.id) return;
    await remove(ref(database, `notifications/${user.id}/${id}`));
  };

  const clearAllNotifications = async () => {
    if (!user?.id) return;
    await remove(ref(database, `notifications/${user.id}`));
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    let targetRoute = '/employee';
    let state: NavigationState | undefined = undefined;
    switch (notification.type) {
      case 'task_assigned':
      case 'task_due':
        targetRoute = '/employee/my-work';
        break;
      case 'project_assigned':
        targetRoute = '/employee/my-projects';
        break;
      case 'leave_approved':
      case 'leave_rejected':
        targetRoute = '/employee/leaves';
        break;
      case 'mention':
      case 'group_chat':
      case 'chat_message':
        targetRoute = '/employee/chat';
        if (notification.messageId) {
          state = { highlightMessageId: notification.messageId };
        }
        break;
      default:
        targetRoute = '/employee';
    }
    try {
      navigate(targetRoute, { state });
    } catch (err) {
      console.error('Navigation error:', err);
    } finally {
      setShowDropdown(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <FolderOpen className="h-4 w-4 text-blue-600" />;
      case 'task_due': return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'mention': return <UserCheck className="h-4 w-4 text-purple-600" />;
      case 'escalation': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setShowDropdown(!showDropdown)} className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-80 max-w-sm z-50"
          >
            <Card className="shadow-lg border-border">
              <CardContent className="p-0">
                {/* Fixed header with flex-wrap to prevent button overflow */}
                <div className="flex items-center justify-between gap-2 p-4 border-b border-border flex-wrap">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  <div className="flex gap-2 flex-wrap">
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                        <Check className="h-3 w-3 mr-1" /> Mark all read
                      </Button>
                    )}
                    {notifications.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllNotifications}>
                        <Trash2 className="h-3 w-3 mr-1" /> Clear all
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setShowDropdown(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-border">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 hover:bg-muted/50 cursor-pointer transition ${
                          !n.read ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="flex items-start gap-3">
                          {getIcon(n.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground">{n.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                            <p className="text-xs text-muted-foreground/70 mt-2">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;