import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, set, get, remove } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/button';
import { Send, Paperclip, File, Image, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

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

interface ProjectChatProps {
  projectId: string;
}

const ProjectChat: React.FC<ProjectChatProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAdminOrTeamLead, setIsAdminOrTeamLead] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if current user is admin or team lead of this project
  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) return;
      const userRef = ref(database, `users/${user.id}`);
      const userSnap = await get(userRef);
      const userData = userSnap.val();
      const role = userData?.role;
      if (role === 'admin') {
        setIsAdminOrTeamLead(true);
        return;
      }
      // Check if user is team lead of this project
      const projectRef = ref(database, `projects/${projectId}`);
      const projectSnap = await get(projectRef);
      const project = projectSnap.val();
      if (project?.assignedTeamLeader === user.id) {
        setIsAdminOrTeamLead(true);
      } else {
        setIsAdminOrTeamLead(false);
      }
    };
    checkRole();
  }, [user, projectId]);

  useEffect(() => {
    const chatRef = ref(database, `chats/${projectId}/messages`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg,
        }));
        setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
        scrollToBottom();
      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [projectId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  // Send notifications
  const sendChatNotifications = async (messageText: string, senderName: string, fileUrl?: string) => {
    try {
      const projectRef = ref(database, `projects/${projectId}`);
      const projectSnap = await get(projectRef);
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
          projectId: projectId,
        });
        if (Notification.permission === 'granted') {
          new Notification(`💬 New message in ${project.name || 'project'}`, {
            body: notificationBody,
            icon: '/logo.png',
          });
        }
      }
    } catch (error) {
      console.error('Error sending chat notifications:', error);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !user?.id) return;
    setUploading(true);
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
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
      sendChatNotifications(messageText, user.name || 'Employee', fileUrl || undefined);
      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error(error);
      toast.error('Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  // ✅ Delete message
  const deleteMessage = async (messageId: string, messageUserId: string) => {
    // Check permission: sender, admin, or team lead
    const canDelete = messageUserId === user?.id || isAdminOrTeamLead;
    if (!canDelete) {
      toast.error('You are not authorized to delete this message');
      return;
    }
    if (!confirm('Delete this message?')) return;
    try {
      const messageRef = ref(database, `chats/${projectId}/messages/${messageId}`);
      await remove(messageRef);
      toast.success('Message deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  return (
    <div className="border rounded-lg p-3 bg-white h-[450px] flex flex-col">
      <h4 className="font-semibold text-sm mb-2 border-b pb-1">💬 Team Chat</h4>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-xs text-center">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => {
            const isSender = msg.userId === user?.id;
            const showDelete = isSender || isAdminOrTeamLead;
            return (
              <div
                key={msg.id}
                className={`text-sm p-2 rounded-lg max-w-[80%] relative group ${
                  isSender ? 'bg-blue-100 ml-auto text-right' : 'bg-gray-100'
                }`}
              >
                <div className="font-semibold text-xs text-gray-600">{msg.userName}</div>
                {msg.text && <div>{msg.text}</div>}
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
                <div className="text-[10px] text-gray-400 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                {showDelete && (
                  <button
                    onClick={() => deleteMessage(msg.id, msg.userId)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow"
                    title="Delete message"
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      {selectedFile && (
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded mb-2">
          <Paperclip className="h-4 w-4" />
          <span className="text-sm truncate">{selectedFile.name}</span>
          <button onClick={removeSelectedFile} className="ml-auto text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          id={`file-upload-${projectId}`}
        />
        <label
          htmlFor={`file-upload-${projectId}`}
          className="p-2 border rounded cursor-pointer hover:bg-gray-50"
        >
          <Paperclip className="h-4 w-4" />
        </label>
        <textarea
          className="flex-1 border rounded p-2 text-sm resize-none"
          rows={2}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={uploading}
        />
        <Button size="sm" onClick={sendMessage} disabled={uploading} className="self-end">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ProjectChat;