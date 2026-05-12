import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, push, set, onValue, off, update, query, orderByChild, limitToLast, get, remove, runTransaction } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Send, Paperclip, Users, Clock, CheckCheck, Search, FileText, Trash2, X } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Cloudinary upload remains (no changes)
const uploadToCloudinary = async (file: File): Promise<string> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary credentials missing');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, { method: 'POST', body: formData });
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

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const mentionableUsersRef = useRef<Contact[]>([]);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Prevent duplicate sends
  const sendingRef = useRef(false);
  // Throttle mention notifications (5 seconds per user) – in‑memory only, fine
  const lastMentionNotif = useRef<Map<string, number>>(new Map());

  const currentUserId = user?.id;
  const currentUserName = user?.name || 'Employee';
  const isAdmin = user?.role === 'admin';
  const adminUid = user?.adminUid || (isAdmin ? currentUserId : null);

  const mentionableUsers = mentionableUsersRef.current.filter(u =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const getDmChatId = (uid1: string, uid2: string) => `dm_${[uid1, uid2].sort().join('_')}`;

  // Load contacts
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
          contactMap.set(uid, { id: uid, name: profile.name, email: profile.email || '', department: profile.department, role: userData.role === 'admin' ? 'admin' : 'employee' });
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
            contactMap.set(empId, { id: empId, name: empData.name, email: empData.email || '', department: empData.department, role: 'employee' });
          }
        });
      }
      const contactsList = Array.from(contactMap.values());
      setContacts(contactsList);
      mentionableUsersRef.current = contactsList;
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
          if (act.status === 'active' && now - (act.lastActive || 0) < 60000) online.add(uid);
        }
      }
      setOnlineUsers(online);
    });
    return () => off(activityRef);
  }, []);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeContactId || !currentUserId) return;
    let chatPath: string;
    if (activeContactId === 'global') chatPath = 'chats/group_global';
    else chatPath = `chats/${getDmChatId(currentUserId, activeContactId)}`;
    const messagesRef = ref(database, `${chatPath}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(50));
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<Message, 'id'>> | null;
      const msgs: Message[] = [];
      if (data) {
        for (const [id, msg] of Object.entries(data)) {
          msgs.push({ id, ...msg });
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

  // Typing listener
  useEffect(() => {
    if (!activeContactId || !currentUserId) return;
    let typingPath: string;
    if (activeContactId === 'global') typingPath = 'chats/group_global/typing';
    else typingPath = `chats/${getDmChatId(currentUserId, activeContactId)}/typing`;
    const typingRef = ref(database, typingPath);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') setTypingUsers(data as Record<string, boolean>);
      else setTypingUsers({});
    });
    return () => off(typingRef);
  }, [activeContactId, currentUserId]);

  // Mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch && atMatch[1] !== undefined) {
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
      setMentionOpen(true);
      const inputRect = e.target.getBoundingClientRect();
      const containerRect = inputContainerRef.current?.getBoundingClientRect();
      const top = inputRect.bottom - (containerRect?.top || 0);
      setMentionPosition({ top: top + 5, left: 0 });
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (userName: string) => {
    const input = inputRef.current;
    if (!input) return;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = inputText.slice(0, atIndex);
      const afterCursor = inputText.slice(cursorPos);
      const newText = beforeAt + `@${userName} ` + afterCursor;
      setInputText(newText);
      setTimeout(() => {
        input.focus();
        const newCursorPos = atIndex + userName.length + 2;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    setMentionOpen(false);
    setMentionFilter('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && mentionableUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionableUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionableUsers.length) % mentionableUsers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionableUsers[mentionIndex].name);
      } else if (e.key === 'Escape') {
        setMentionOpen(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleTyping = useCallback(async () => {
    if (!activeContactId || !currentUserId) return;
    let typingPath: string;
    if (activeContactId === 'global') typingPath = 'chats/group_global/typing';
    else typingPath = `chats/${getDmChatId(currentUserId, activeContactId)}/typing`;
    await set(ref(database, `${typingPath}/${currentUserId}`), true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await remove(ref(database, `${typingPath}/${currentUserId}`));
    }, 2000);
  }, [activeContactId, currentUserId]);

  // ✅ Helper – check last group notification throttle using Firebase
  const canSendGroupNotification = async (userId: string): Promise<boolean> => {
    const metaRef = ref(database, `users/${userId}/meta/lastGroupNotifTs`);
    const result = await runTransaction(metaRef, (current) => {
      const now = Date.now();
      const THROTTLE_MS = 60000;
      if (current && now - current < THROTTLE_MS) {
        return; // abort transaction, no update
      }
      return now;
    });
    return result.committed;
  };

  
  const sendMessage = async (text: string, file?: { url: string; name: string; type: string }) => {
    if (sendingRef.current) return;
    if ((!text.trim() && !file) || !currentUserId || !activeContactId) return;

    sendingRef.current = true;
    setUploading(true);
    try {
      let chatPath: string;
      const isGlobal = activeContactId === 'global';
      if (isGlobal) chatPath = 'chats/group_global';
      else chatPath = `chats/${getDmChatId(currentUserId, activeContactId)}`;

      const newMsgRef = push(ref(database, `${chatPath}/messages`));
      const messageId = newMsgRef.key;
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

      // Notify mentions – only save to Firebase (throttled in‑memory)
      if (text.trim()) {
        const mentionRegex = /@(\w+)/g;
        let match;
        const mentionedNames = new Set<string>();
        while ((match = mentionRegex.exec(text)) !== null) {
          mentionedNames.add(match[1]);
        }
        for (const mentionedName of mentionedNames) {
          const mentionedUser = contacts.find(c => c.name === mentionedName);
          if (mentionedUser && mentionedUser.id !== currentUserId) {
            const last = lastMentionNotif.current.get(mentionedUser.id);
            if (last && now - last < 5000) continue;
            lastMentionNotif.current.set(mentionedUser.id, now);
            const notifRef = push(ref(database, `notifications/${mentionedUser.id}`));
            await set(notifRef, {
              title: `🔔 Mention from ${currentUserName}`,
              body: `in company group: "${text.substring(0, 80)}"`,
              type: 'mention',
              read: false,
              createdAt: now,
              chatType: 'global',
              messageId: messageId,
            });
          }
        }
      }

      // Global chat throttle – using Firebase instead of 
      if (isGlobal) {
        const canSend = await canSendGroupNotification(currentUserId);
        if (canSend) {
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
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      sendingRef.current = false;
      setUploading(false);
    }
  };

  const deleteMessage = async (messageId: string, senderId: string) => {
    if (senderId !== currentUserId && !isAdmin) {
      toast({ title: "Access Denied", description: "You cannot delete this message", variant: "destructive" });
      return;
    }
    if (!window.confirm('Delete this message?')) return;
    try {
      let chatPath: string;
      if (activeContactId === 'global') chatPath = 'chats/group_global';
      else if (activeContactId) chatPath = `chats/${getDmChatId(currentUserId!, activeContactId)}`;
      else return;
      await remove(ref(database, `${chatPath}/messages/${messageId}`));
      toast({ title: "Deleted", description: "Message removed" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    }
  };

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

  const triggerFileUpload = () => fileInputRef.current?.click();

  const getSenderInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loadingContacts) return <div className="flex h-full items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Contact List Sidebar */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-700 mb-2">Chats</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm rounded-full" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button onClick={() => setActiveContactId('global')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeContactId === 'global' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>
              <Users className="h-5 w-5" />
              <div className="flex-1 text-left"><p className="text-sm font-medium">Company Group</p><p className="text-xs text-gray-500">All employees & admins</p></div>
            </button>
            {filteredContacts.map(contact => (
              <button key={contact.id} onClick={() => setActiveContactId(contact.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeContactId === contact.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>
                <div className="relative">
                  <Avatar className="h-9 w-9"><AvatarFallback className="bg-gray-200 text-gray-700 text-sm">{contact.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  {onlineUsers.has(contact.id) && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1 text-left"><p className="text-sm font-medium">{contact.name}</p><p className="text-xs text-gray-500">{contact.department || contact.role || 'Employee'}</p></div>
              </button>
            ))}
            {filteredContacts.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No contacts found</div>}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {activeContactId ? (
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{activeContactId === 'global' ? 'Company Group' : contacts.find(c => c.id === activeContactId)?.name || 'Chat'}</h2>
              {Object.keys(typingUsers).length > 0 && <Badge variant="outline" className="text-xs animate-pulse">{Object.keys(typingUsers).length} typing...</Badge>}
            </div>
            <div>
              <Button variant="ghost" size="icon" onClick={triggerFileUpload} disabled={uploading}><Paperclip className="h-4 w-4" /></Button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" />
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map(msg => {
                const isCurrentUser = msg.senderId === currentUserId;
                let highlightedText: React.ReactNode = msg.text;
                if (msg.text) {
                  const parts = msg.text.split(/(@\w+)/g);
                  highlightedText = parts.map((part, idx) =>
                    part.startsWith('@') ? <span key={idx} className="bg-blue-100 text-blue-800 px-1 rounded">{part}</span> : part
                  );
                }
                return (
                  <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`max-w-[70%] flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      {!isCurrentUser && <Avatar className="h-7 w-7"><AvatarFallback className="bg-gray-200 text-gray-700 text-xs">{getSenderInitials(msg.senderName)}</AvatarFallback></Avatar>}
                      <div>
                        <div className={`rounded-lg px-3 py-2 ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          {msg.fileUrl ? (msg.fileType?.startsWith('image/') ? <img src={msg.fileUrl} alt="attachment" className="max-w-[200px] rounded" /> : msg.fileType?.startsWith('video/') ? <video src={msg.fileUrl} controls className="max-w-[200px] rounded" /> : <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1"><FileText className="h-4 w-4" /> {msg.fileName}</a>) : <p className="text-sm break-words">{highlightedText}</p>}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <span>{formatDistanceToNow(msg.timestamp, { addSuffix: true })}</span>
                          {isCurrentUser && <span>{msg.readBy && Object.keys(msg.readBy).length > 1 ? <CheckCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}</span>}
                        </div>
                      </div>
                      {(isCurrentUser || isAdmin) && <button onClick={() => deleteMessage(msg.id, msg.senderId)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 self-center text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                );
              })}
              {uploading && <div className="flex justify-end"><div className="bg-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">Uploading...</div></div>}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div ref={inputContainerRef} className="p-3 border-t bg-white relative">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onInput={handleTyping}
                placeholder="Type a message... (use @ to mention someone)"
                className="flex-1"
                disabled={uploading}
              />
              <Button onClick={() => sendMessage(inputText)} disabled={!inputText.trim() || uploading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            <AnimatePresence>
              {mentionOpen && mentionableUsers.length > 0 && (
                <motion.div
                  ref={mentionDropdownRef}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-50 bg-white border rounded-md shadow-lg w-64 max-h-48 overflow-y-auto"
                  style={{ bottom: mentionPosition.top, left: mentionPosition.left }}
                >
                  {mentionableUsers.map((user, idx) => (
                    <div
                      key={user.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        idx === mentionIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => insertMention(user.name)}
                      onMouseEnter={() => setMentionIndex(idx)}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email || user.department || 'Employee'}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">Select a contact to start chatting</div>
      )}
    </div>
  );
};

export default ChatInterface;