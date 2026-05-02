// src/components/chat/ChatInterface.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, push, set, onValue, off, update, query, orderByChild, limitToLast, get, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Send, Paperclip, Users, Clock, CheckCheck, Search, FileText, Trash2 } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

// Cloudinary upload
const uploadToCloudinary = async (file: File): Promise<string> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary credentials missing. Check your .env file.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    { method: 'POST', body: formData }
  );
  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();
  return data.secure_url;
};

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  readBy: Record<string, boolean>;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
}

const ChatInterface = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = user?.id;
  const currentUserName = user?.name || 'Employee';
  const isAdmin = user?.role === 'admin';
  // ✅ Corrected: use adminUid (not adminId)
  const adminUid = user?.adminUid || (isAdmin ? currentUserId : null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getDmChatId = (uid1: string, uid2: string) => {
    const sorted = [uid1, uid2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  };

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      if (!currentUserId) return;
      setLoadingContacts(true);
      const contactMap = new Map<string, Contact>();
      const rootUsersSnap = await get(ref(database, 'users'));
      rootUsersSnap.forEach((child) => {
        const uid = child.key;
        if (uid === currentUserId) return;
        const userData = child.val();
        const profile = userData.profile || userData;
        if (profile?.name) {
          contactMap.set(uid, {
            id: uid,
            name: profile.name,
            email: profile.email || '',
            department: profile.department,
            role: userData.role === 'admin' ? 'admin' : 'employee',
          });
        }
      });

      if (!isAdmin && adminUid) {
        const employeesRef = ref(database, `users/${adminUid}/employees`);
        const employeesSnap = await get(employeesRef);
        employeesSnap.forEach((child) => {
          const empId = child.key;
          if (empId === currentUserId) return;
          const empData = child.val();
          if (empData?.name && !contactMap.has(empId)) {
            contactMap.set(empId, {
              id: empId,
              name: empData.name,
              email: empData.email || '',
              department: empData.department,
              role: 'employee',
            });
          }
        });
      }

      setContacts(Array.from(contactMap.values()));
      setLoadingContacts(false);
    };
    fetchContacts();
  }, [currentUserId, isAdmin, adminUid]);

  // Online presence
  useEffect(() => {
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val() as Record<string, { status?: string; lastActive?: number }> | null;
      const online = new Set<string>();
      const now = Date.now();
      if (data) {
        for (const [uid, act] of Object.entries(data)) {
          if (act.status === 'active' && now - (act.lastActive || 0) < 60000) {
            online.add(uid);
          }
        }
      }
      setOnlineUsers(online);
    });
    return () => off(activityRef);
  }, []);

  // Fetch messages
  useEffect(() => {
    if (!activeContactId || !currentUserId) return;
    let chatPath: string;
    if (activeContactId === 'global') {
      chatPath = 'chats/group_global';
    } else {
      chatPath = `chats/${getDmChatId(currentUserId, activeContactId)}`;
    }
    const messagesRef = ref(database, `${chatPath}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(50));
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<Message, 'id'>> | null;
      const msgs: Message[] = [];
      if (data) {
        for (const [id, msg] of Object.entries(data)) {
          msgs.push({
            id,
            text: msg.text,
            senderId: msg.senderId,
            senderName: msg.senderName || 'Unknown',
            timestamp: msg.timestamp,
            readBy: msg.readBy || {},
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            fileType: msg.fileType,
          });
        }
      }
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      const updates: Record<string, boolean> = {};
      msgs.forEach(msg => {
        if (msg.senderId !== currentUserId && !msg.readBy[currentUserId]) {
          updates[`${chatPath}/messages/${msg.id}/readBy/${currentUserId}`] = true;
        }
      });
      if (Object.keys(updates).length) update(ref(database), updates);
    });
    return () => off(messagesRef);
  }, [activeContactId, currentUserId]);

  // Typing indicator listener
  useEffect(() => {
    if (!activeContactId || !currentUserId) return;
    let typingPath: string;
    if (activeContactId === 'global') {
      typingPath = 'chats/group_global/typing';
    } else {
      typingPath = `chats/${getDmChatId(currentUserId, activeContactId)}/typing`;
    }
    const typingRef = ref(database, typingPath);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        setTypingUsers(data as Record<string, boolean>);
      } else {
        setTypingUsers({});
      }
    });
    return () => off(typingRef);
  }, [activeContactId, currentUserId]);

  const sendMessage = async (text: string, file?: { url: string; name: string; type: string }) => {
    if ((!text.trim() && !file) || !currentUserId || !activeContactId) return;
    let chatPath: string;
    const isGlobal = activeContactId === 'global';
    if (isGlobal) {
      chatPath = 'chats/group_global';
    } else {
      chatPath = `chats/${getDmChatId(currentUserId, activeContactId)}`;
    }
    const newMsgRef = push(ref(database, `${chatPath}/messages`));
    const messageData: Omit<Message, 'id'> = {
      text: text.trim() || (file ? '📎 File attached' : ''),
      senderId: currentUserId,
      senderName: currentUserName,
      timestamp: Date.now(),
      readBy: { [currentUserId]: true },
    };
    if (file) {
      messageData.fileUrl = file.url;
      messageData.fileName = file.name;
      messageData.fileType = file.type;
    }
    await set(newMsgRef, messageData);
    await remove(ref(database, `${chatPath}/typing/${currentUserId}`));
    setInputText('');
    const now = Date.now();
    const throttleKey = `lastGroupNotif_${currentUserId}`;
    const lastGroupNotif = localStorage.getItem(throttleKey);
    const THROTTLE_MS = 60000;
    if (isGlobal) {
      if (!lastGroupNotif || now - parseInt(lastGroupNotif) > THROTTLE_MS) {
        localStorage.setItem(throttleKey, now.toString());
        const usersSnap = await get(ref(database, 'users'));
        const notificationPromises: Promise<void>[] = [];
        usersSnap.forEach((child) => {
          const uid = child.key;
          if (uid === currentUserId) return;
          const notifRef = push(ref(database, `notifications/${uid}`));
          notificationPromises.push(set(notifRef, {
            title: `New message in Company Group from ${currentUserName}`,
            body: text.trim().substring(0, 100) || (file ? '📎 Shared a file' : ''),
            type: 'group_chat',
            read: false,
            createdAt: now,
          }));
          if (Notification.permission === 'granted') {
            new Notification(`Company Group: ${currentUserName}`, {
              body: text.trim().substring(0, 100) || (file ? 'Shared a file' : ''),
              icon: '/favicon.ico',
            });
          }
        });
        await Promise.all(notificationPromises);
      }
    } else {
      const notifRef = push(ref(database, `notifications/${activeContactId}`));
      await set(notifRef, {
        title: `New message from ${currentUserName}`,
        body: text.trim().substring(0, 100) || (file ? '📎 Sent a file' : ''),
        type: 'chat_message',
        read: false,
        createdAt: now,
      });
      if (Notification.permission === 'granted') {
        new Notification(`Message from ${currentUserName}`, {
          body: text.trim().substring(0, 100) || (file ? 'Sent a file' : ''),
          icon: '/favicon.ico',
        });
      }
    }
  };

  const deleteMessage = async (messageId: string, senderId: string) => {
    const canDelete = senderId === currentUserId || isAdmin;
    if (!canDelete) {
      toast({ title: "Access Denied", description: "You cannot delete this message", variant: "destructive" });
      return;
    }
    if (!confirm('Delete this message?')) return;
    try {
      let chatPath: string;
      if (activeContactId === 'global') {
        chatPath = 'chats/group_global';
      } else if (activeContactId) {
        chatPath = `chats/${getDmChatId(currentUserId!, activeContactId)}`;
      } else {
        return;
      }
      const messageRef = ref(database, `${chatPath}/messages/${messageId}`);
      await remove(messageRef);
      toast({ title: "Deleted", description: "Message removed" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    }
  };

  const handleTyping = useCallback(async () => {
    if (!activeContactId || !currentUserId) return;
    let typingPath: string;
    if (activeContactId === 'global') {
      typingPath = 'chats/group_global/typing';
    } else {
      typingPath = `chats/${getDmChatId(currentUserId, activeContactId)}/typing`;
    }
    await set(ref(database, `${typingPath}/${currentUserId}`), true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await remove(ref(database, `${typingPath}/${currentUserId}`));
    }, 2000);
  }, [activeContactId, currentUserId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await sendMessage('', { url, name: file.name, type: file.type });
      toast({ title: "Success", description: "File uploaded" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: "Upload Failed", description: errorMsg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const getSenderInitials = (name: string) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingContacts) {
    return (
      <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Contact List Sidebar */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-700 mb-2">Chats</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm rounded-full"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveContactId('global')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeContactId === 'global'
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Users className="h-5 w-5" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Company Group</p>
                <p className="text-xs text-gray-500">All employees & admins</p>
              </div>
            </button>
            {filteredContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => setActiveContactId(contact.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeContactId === contact.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gray-200 text-gray-700 text-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {onlineUsers.has(contact.id) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-gray-500">{contact.department || contact.role || 'Employee'}</p>
                </div>
              </button>
            ))}
            {filteredContacts.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No contacts found</div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {activeContactId ? (
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">
                {activeContactId === 'global'
                  ? 'Company Group'
                  : contacts.find(c => c.id === activeContactId)?.name || 'Chat'}
              </h2>
              {Object.keys(typingUsers).length > 0 && (
                <Badge variant="outline" className="text-xs animate-pulse">
                  {Object.keys(typingUsers).length} typing...
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={triggerFileUpload} disabled={uploading}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`max-w-[70%] flex gap-2 ${msg.senderId === currentUserId ? 'flex-row-reverse' : ''}`}>
                    {msg.senderId !== currentUserId && (
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-gray-200 text-gray-700 text-xs">
                          {getSenderInitials(msg.senderName)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          msg.senderId === currentUserId
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.fileUrl ? (
                          msg.fileType?.startsWith('image/') ? (
                            <img src={msg.fileUrl} alt="attachment" className="max-w-[200px] rounded" />
                          ) : msg.fileType?.startsWith('video/') ? (
                            <video src={msg.fileUrl} controls className="max-w-[200px] rounded" />
                          ) : (
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1">
                              <FileText className="h-4 w-4" /> {msg.fileName}
                            </a>
                          )
                        ) : (
                          <p className="text-sm break-words">{msg.text}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <span>{formatDistanceToNow(msg.timestamp, { addSuffix: true })}</span>
                        {msg.senderId === currentUserId && (
                          <span>
                            {msg.readBy && Object.keys(msg.readBy).length > 1 ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {(msg.senderId === currentUserId || isAdmin) && (
                      <button
                        onClick={() => deleteMessage(msg.id, msg.senderId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 self-center text-gray-400 hover:text-red-500"
                        title="Delete message"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {uploading && (
                <div className="flex justify-end">
                  <div className="bg-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">Uploading...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                onInput={handleTyping}
                placeholder="Type a message..."
                className="flex-1"
                disabled={uploading}
              />
              <Button onClick={() => sendMessage(inputText)} disabled={!inputText.trim() || uploading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Select a contact to start chatting
        </div>
      )}
    </div>
  );
};

export default ChatInterface;