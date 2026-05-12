import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { ref, onValue, push, set, get, remove } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/button';
import { Send, Paperclip, File, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import MentionDropdown from '../../ui/MentionDropdown';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  timestamp: number;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

type FirebaseMessage = Omit<ChatMessage, 'id'>;

interface ProjectChatProps {
  projectId: string;
}

const ProjectChat: React.FC<ProjectChatProps> = memo(({ projectId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAdminOrTeamLead, setIsAdminOrTeamLead] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false); // ✅ prevent duplicate sends

  // Fetch project members (for mentions)
  useEffect(() => {
    const fetchMembers = async () => {
      const projectSnap = await get(ref(database, `projects/${projectId}`));
      const project = projectSnap.val();
      if (!project) return;
      setProjectName(project.name || 'Project');
      const memberIds = new Set<string>();
      if (project.assignedEmployees) (project.assignedEmployees as string[]).forEach(id => memberIds.add(id));
      if (project.assignedTeamLeader) memberIds.add(project.assignedTeamLeader);
      const usersSnap = await get(ref(database, 'users'));
      usersSnap.forEach(child => {
        const userData = child.val();
        if (userData.role === 'admin') memberIds.add(child.key);
      });
      const members: { id: string; name: string }[] = [];
      for (const id of memberIds) {
        const profileSnap = await get(ref(database, `users/${id}/profile`));
        const profile = profileSnap.val();
        if (profile?.name) members.push({ id, name: profile.name });
        else {
          const userSnap = await get(ref(database, `users/${id}`));
          const userData = userSnap.val();
          if (userData?.name) members.push({ id, name: userData.name });
        }
      }
      setAvailableUsers(members);
    };
    fetchMembers();
  }, [projectId]);

  // Check role (admin or team lead)
  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) return;
      if (user.role === 'admin') {
        setIsAdminOrTeamLead(true);
        return;
      }
      const projectSnap = await get(ref(database, `projects/${projectId}`));
      const project = projectSnap.val();
      setIsAdminOrTeamLead(project?.assignedTeamLeader === user.id);
    };
    checkRole();
  }, [user, projectId]);

  // Listen for messages
  useEffect(() => {
    const chatRef = ref(database, `chats/${projectId}/messages`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseMessage> | null;
      if (data) {
        const msgs: ChatMessage[] = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));
        setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
        scrollToBottom();
      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [projectId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Cloudinary upload
  const uploadFileToCloudinary = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      toast.error('Failed to upload file');
      return null;
    }
  };

  // ✅ Send notifications for mentions – only to Firebase, NO browser popup
  const notifyMentionedUsers = useCallback(async (messageText: string, senderName: string) => {
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentionedNames = new Set<string>();
    while ((match = mentionRegex.exec(messageText)) !== null) {
      mentionedNames.add(match[1]);
    }
    for (const name of mentionedNames) {
      const targetUser = availableUsers.find(u => u.name === name);
      if (targetUser && targetUser.id !== user?.id) {
        const notifRef = push(ref(database, `notifications/${targetUser.id}`));
        await set(notifRef, {
          title: `🔔 Mentioned in ${projectName}`,
          body: `${senderName} mentioned you: "${messageText.substring(0, 80)}"`,
          type: 'mention',
          read: false,
          createdAt: Date.now(),
          projectId,
          chatType: 'project',
        });
        // ❌ REMOVED: new Notification(...)
      }
    }
  }, [availableUsers, projectName, projectId, user]);

  // ✅ Send general chat notifications – only to Firebase, NO browser popup
  const sendChatNotifications = useCallback(async (messageText: string, senderName: string, fileUrl?: string) => {
    try {
      const projectSnap = await get(ref(database, `projects/${projectId}`));
      const project = projectSnap.val();
      if (!project) return;
      const teamMemberIds: string[] = [];
      if (project.assignedEmployees) teamMemberIds.push(...project.assignedEmployees);
      if (project.assignedTeamLeader && !teamMemberIds.includes(project.assignedTeamLeader)) {
        teamMemberIds.push(project.assignedTeamLeader);
      }
      const notificationBody = fileUrl
        ? `${senderName} sent a file in chat: ${messageText || '📎 Attachment'}`
        : `${senderName}: ${messageText.substring(0, 100)}`;
      for (const memberId of teamMemberIds) {
        if (memberId === user?.id) continue;
        const notifRef = push(ref(database, `notifications/${memberId}`));
        await set(notifRef, {
          title: `💬 New message in ${project.name || 'project'}`,
          body: notificationBody,
          type: 'chat_message',
          read: false,
          createdAt: Date.now(),
          projectId,
        });
        // ❌ REMOVED: new Notification(...)
      }
    } catch (error) {
      console.error('Error sending chat notifications:', error);
    }
  }, [projectId, user]);

  // ✅ Send message – with sendingRef to prevent duplicates
  const sendMessage = useCallback(async () => {
    if (sendingRef.current) return;
    if ((!newMessage.trim() && !selectedFile) || !user?.id) return;
    sendingRef.current = true;
    setUploading(true);
    try {
      let fileUrl = null, fileName = null, fileType = null;
      if (selectedFile) {
        fileUrl = await uploadFileToCloudinary(selectedFile);
        if (fileUrl) {
          fileName = selectedFile.name;
          fileType = selectedFile.type;
        }
      }
      const chatRef = ref(database, `chats/${projectId}/messages`);
      const newMsgRef = push(chatRef);
      const messageText = newMessage.trim();
      await set(newMsgRef, {
        text: messageText,
        userId: user.id,
        userName: user.name || 'Employee',
        timestamp: Date.now(),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
      });
      if (messageText) await notifyMentionedUsers(messageText, user.name || 'Employee');
      await sendChatNotifications(messageText, user.name || 'Employee', fileUrl || undefined);
      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error(error);
      toast.error('Failed to send message');
    } finally {
      sendingRef.current = false;
      setUploading(false);
    }
  }, [newMessage, selectedFile, user, projectId, sendChatNotifications, notifyMentionedUsers]);

  // Delete message (unchanged)
  const deleteMessage = useCallback(async (messageId: string, messageUserId: string) => {
    if ((messageUserId !== user?.id && !isAdminOrTeamLead)) {
      toast.error('You are not authorized to delete this message');
      return;
    }
    if (!window.confirm('Delete this message?')) return;
    try {
      await remove(ref(database, `chats/${projectId}/messages/${messageId}`));
      toast.success('Message deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete message');
    }
  }, [user, isAdminOrTeamLead, projectId]);

  // Mention detection (unchanged)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w\s]*)$/);
    if (atMatch && atMatch[1] !== undefined) {
      setMentionFilter(atMatch[1]);
      setMentionOpen(true);
      const rect = e.target.getBoundingClientRect();
      setMentionPosition({ top: rect.top - 50, left: rect.left + 10 });
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (userName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = newMessage.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = newMessage.slice(0, atIndex);
      const afterCursor = newMessage.slice(cursorPos);
      const newText = beforeAt + `@${userName} ` + afterCursor;
      setNewMessage(newText);
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = atIndex + userName.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    setMentionOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };
  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="border rounded-lg p-3 bg-white h-[450px] flex flex-col relative">
      <h4 className="font-semibold text-sm mb-2 border-b pb-1">💬 Team Chat</h4>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-xs text-center">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg) => {
          const isSender = msg.userId === user?.id;
          const showDelete = isSender || isAdminOrTeamLead;
          let highlightedText: React.ReactNode = msg.text;
          if (msg.text) {
            const parts = msg.text.split(/(@\w+)/g);
            highlightedText = parts.map((part, idx) =>
              part.startsWith('@') ? <span key={idx} className="bg-blue-100 text-blue-800 px-1 rounded">{part}</span> : part
            );
          }
          return (
            <div
              key={msg.id}
              className={`text-sm p-2 rounded-lg max-w-[80%] relative group ${
                isSender ? 'bg-blue-100 ml-auto text-right' : 'bg-gray-100'
              }`}
            >
              <div className="font-semibold text-xs text-gray-600">{msg.userName}</div>
              <div>{highlightedText}</div>
              {msg.fileUrl && (
                <div className="mt-1">
                  {msg.fileType?.startsWith('image/') || isImage(msg.fileUrl) ? (
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.fileUrl} alt="attachment" className="max-w-full max-h-32 rounded border" />
                    </a>
                  ) : (
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500">
                      <File className="h-4 w-4" />
                      {msg.fileName}
                    </a>
                  )}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
              {showDelete && (
                <button onClick={() => deleteMessage(msg.id, msg.userId)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow">
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {selectedFile && (
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded mb-2">
          <Paperclip className="h-4 w-4" />
          <span className="text-sm truncate">{selectedFile.name}</span>
          <button onClick={removeSelectedFile} className="ml-auto text-red-500"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 relative">
        <textarea
          ref={textareaRef}
          className="flex-1 border rounded p-2 text-sm resize-none"
          rows={2}
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (use @ to mention a team member)"
          disabled={uploading}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" id={`file-upload-${projectId}`} />
        <label htmlFor={`file-upload-${projectId}`} className="p-2 border rounded cursor-pointer hover:bg-gray-50 self-start sm:self-auto">
          <Paperclip className="h-4 w-4" />
        </label>
        <Button size="sm" onClick={sendMessage} disabled={uploading} className="self-end sm:self-auto">
          <Send className="h-4 w-4" />
        </Button>
        {mentionOpen && (
          <MentionDropdown
            isOpen={mentionOpen}
            position={mentionPosition}
            users={availableUsers}
            filter={mentionFilter}
            onSelect={insertMention}
          />
        )}
      </div>
    </div>
  );
});

ProjectChat.displayName = 'ProjectChat';
export default ProjectChat;