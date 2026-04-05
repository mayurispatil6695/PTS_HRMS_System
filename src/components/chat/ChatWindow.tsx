// ChatWindow.tsx - Fixed TypeScript errors
import React, { useEffect, useState, useRef } from 'react';
import { ref, push, set, onValue, off, query, orderByChild, get, update, DataSnapshot } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import { ImagePlus, Video, Paperclip, X, MessageCircle, MoreVertical, Edit, Trash2, FileText, Link, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  content: string;
  type: string;
  timestamp: number;
  status: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  deletedForSender?: boolean;
  deletedForReceiver?: boolean;
  deletedForEveryone?: boolean;
}

interface FirebaseMessageData {
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  content: string;
  type: string;
  timestamp: number;
  status: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  deletedForSender?: boolean;
  deletedForReceiver?: boolean;
  deletedForEveryone?: boolean;
}

interface ChatWindowProps {
  selectedUser: {
    id: string;
    name: string;
    designation?: string;
    department?: string;
    profileImage?: string;
  } | null;
  messages?: Message[];
  onSendMessage?: (content: string, type?: string) => Promise<void>;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string, deleteForEveryone?: boolean) => void;
  onExitChat?: () => void;
  onTyping?: (isTyping: boolean) => void;
  typingUsers?: string[];
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  onBackToUsers?: () => void;
  onMessageSent?: () => void;
}

interface MediaGalleryProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

interface MediaPreview {
  url: string;
  type: 'image' | 'video' | 'document';
  file?: File;
  fileName?: string;
  fileSize?: number;
}

function getChatId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

function formatLastSeen(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isLink(text: string): boolean {
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
  return urlPattern.test(text);
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ messages, isOpen, onClose }) => {
  const mediaItems = messages.filter(
    (msg) => (msg.type === 'image' || msg.type === 'video') && !msg.deletedForEveryone
  );
  const documentItems = messages.filter(
    (msg) => msg.type === 'document' && !msg.deletedForEveryone
  );

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Media Gallery</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <ImagePlus className="h-5 w-5 mr-2" />
              Photos & Videos ({mediaItems.length})
            </h3>
            {mediaItems.length === 0 ? (
              <p className="text-gray-500">No photos or videos shared yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {mediaItems.map((item) => (
                  <div key={item.id} className="relative group">
                    {item.type === 'image' ? (
                      <img
                        src={item.mediaUrl}
                        alt="Shared content"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={item.mediaUrl}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg">
                      <a
                        href={item.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Documents ({documentItems.length})
            </h3>
            {documentItems.length === 0 ? (
              <p className="text-gray-500">No documents shared yet</p>
            ) : (
              <div className="space-y-3">
                {documentItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-blue-500 mr-3" />
                      <div>
                        <p className="font-medium text-sm">{item.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {item.fileSize ? formatFileSize(item.fileSize) : 'Unknown size'} • {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadFile(item.mediaUrl || '', item.fileName || 'document')}
                      className="p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-50"
                      title="Download"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  selectedUser, 
  onMessageSent,
  onEditMessage,
  onDeleteMessage,
  onTyping,
  typingUsers = [],
  messagesEndRef: externalMessagesEndRef,
  onBackToUsers
}) => {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [userStatus, setUserStatus] = useState<'online' | 'offline'>('offline');
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<{
    designation: string;
    department: string;
    profileImage?: string;
  }>({
    designation: '',
    department: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string | null;
    position: { x: number; y: number } | null;
  }>({
    messageId: null,
    position: null,
  });
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const internalMessagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = externalMessagesEndRef || internalMessagesEndRef;

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ messageId: null, position: null });
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setAttachmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !selectedUser) {
      setMessages([]);
      setUserStatus('offline');
      setLastSeen(null);
      return;
    }

    const fetchUserDetails = async () => {
      try {
        let userRef;
        if (isAdmin) {
          userRef = ref(database, `users/${selectedUser.id}`);
        } else {
          userRef = ref(database, `users/${currentUser.id}/employees/${selectedUser.id}`);
        }
        
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setUserDetails({
            designation: userData.designation || 'No designation',
            department: userData.department || 'No department',
            profileImage: userData.profileImage || '',
          });
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        toast.error('Failed to load user details');
      }
    };

    fetchUserDetails();

    const chatId = getChatId(currentUser.id, selectedUser.id);
    const messagesRef = query(ref(database, `chats/${chatId}/messages`), orderByChild('timestamp'));

    const unsubscribeMessages = onValue(messagesRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }

      const loadedMessages: Message[] = Object.entries(data).map(([key, val]) => {
        const messageData = val as FirebaseMessageData;
        return {
          id: key,
          senderId: messageData.senderId,
          senderName: messageData.senderName,
          receiverId: messageData.receiverId,
          receiverName: messageData.receiverName,
          content: messageData.content,
          type: messageData.type,
          timestamp: messageData.timestamp,
          status: messageData.status,
          mediaUrl: messageData.mediaUrl,
          fileName: messageData.fileName,
          fileSize: messageData.fileSize,
          deletedForSender: messageData.deletedForSender || false,
          deletedForReceiver: messageData.deletedForReceiver || false,
          deletedForEveryone: messageData.deletedForEveryone || false,
        };
      });

      const filteredMessages = loadedMessages.filter(msg => {
        if (msg.deletedForEveryone) return true;
        if (msg.senderId === currentUser.id && msg.deletedForSender) return false;
        if (msg.receiverId === currentUser.id && msg.deletedForReceiver) return false;
        return true;
      });

      filteredMessages.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(filteredMessages);
    });

    const statusRef = ref(database, `users/${selectedUser.id}/status`);
    const lastSeenRef = ref(database, `users/${selectedUser.id}/lastActive`);

    const unsubscribeStatus = onValue(statusRef, (snapshot: DataSnapshot) => {
      const statusVal = snapshot.val();
      if (statusVal === 'active') {
        setUserStatus('online');
        setLastSeen(null);
      } else {
        setUserStatus('offline');
        get(lastSeenRef).then((snap) => {
          if (snap.exists()) {
            setLastSeen(snap.val());
          } else {
            setLastSeen(null);
          }
        });
      }
    });

    return () => {
      off(messagesRef);
      off(statusRef);
      unsubscribeMessages();
      unsubscribeStatus();
    };
  }, [currentUser, selectedUser, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messagesEndRef]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    const validDocTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error('File size too large. Maximum allowed size is 25MB.');
      return;
    }

    if (type === 'media' && !validMediaTypes.includes(file.type)) {
      toast.error('Please select an image (JPEG, PNG, GIF) or video (MP4, WebM) file.');
      return;
    }

    if (type === 'document' && !validDocTypes.includes(file.type)) {
      toast.error('Please select a valid document (PDF, Word, Excel, PowerPoint, Text)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (type === 'media') {
        if (file.type.startsWith('image/')) {
          setMediaPreview({ 
            url: result, 
            type: 'image',
            file,
            fileName: file.name,
            fileSize: file.size
          });
        } else if (file.type.startsWith('video/')) {
          setMediaPreview({ 
            url: result, 
            type: 'video',
            file,
            fileName: file.name,
            fileSize: file.size
          });
        }
      } else {
        setMediaPreview({ 
          url: result, 
          type: 'document',
          file,
          fileName: file.name,
          fileSize: file.size
        });
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const removeMediaPreview = () => {
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!currentUser || !selectedUser || isSending) return;
    
    if (!mediaPreview && isLink(newMessage.trim())) {
      const chatId = getChatId(currentUser.id, selectedUser.id);
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const newMsgRef = push(messagesRef);
      const timestamp = Date.now();

      try {
        const messageData: FirebaseMessageData = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId: selectedUser.id,
          receiverName: selectedUser.name,
          content: newMessage.trim(),
          type: 'link',
          timestamp,
          status: 'sent',
        };

        await set(newMsgRef, messageData);
        setNewMessage('');
        toast.success('Link shared');
        
        if (onMessageSent) {
          onMessageSent();
        }
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to share link');
      } finally {
        setIsSending(false);
      }
      return;
    }

    if ((!newMessage.trim() && !mediaPreview) || (editingMessage && !newMessage.trim() && !mediaPreview)) return;

    setIsSending(true);
    const chatId = getChatId(currentUser.id, selectedUser.id);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const newMsgRef = editingMessage ? ref(database, `chats/${chatId}/messages/${editingMessage.id}`) : push(messagesRef);
    const timestamp = Date.now();

    try {
      let messageData: FirebaseMessageData;
      
      if (mediaPreview) {
        messageData = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId: selectedUser.id,
          receiverName: selectedUser.name,
          content: mediaPreview.url,
          type: mediaPreview.type,
          timestamp: editingMessage ? editingMessage.timestamp : timestamp,
          status: 'sent',
          mediaUrl: mediaPreview.url,
          fileName: mediaPreview.fileName,
          fileSize: mediaPreview.fileSize,
        };

        if (mediaPreview.type === 'document') {
          messageData.content = 'Document attached';
        }
      } else {
        messageData = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId: selectedUser.id,
          receiverName: selectedUser.name,
          content: newMessage.trim(),
          type: 'text',
          timestamp: editingMessage ? editingMessage.timestamp : timestamp,
          status: 'sent',
        };
      }

      await set(newMsgRef, messageData);
      setNewMessage('');
      setMediaPreview(null);
      setEditingMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      toast.success(editingMessage ? 'Message updated' : 'Message sent');
      
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(editingMessage ? 'Failed to update message' : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({
      messageId: message.id,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleEditMessage = (message: Message) => {
    if (message.type !== 'text') {
      toast.error('Only text messages can be edited');
      return;
    }
    setEditingMessage(message);
    setNewMessage(message.content);
    setContextMenu({ messageId: null, position: null });
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteForMe = async (message: Message) => {
    if (!currentUser || !selectedUser) return;
    
    try {
      const chatId = getChatId(currentUser.id, selectedUser.id);
      const messageRef = ref(database, `chats/${chatId}/messages/${message.id}`);
      
      const isSender = message.senderId === currentUser.id;
      
      await update(messageRef, {
        [isSender ? 'deletedForSender' : 'deletedForReceiver']: true,
      });
      
      toast.success('Message deleted for you');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setContextMenu({ messageId: null, position: null });
    }
  };

  const handleDeleteForEveryone = async (message: Message) => {
    if (!currentUser || !selectedUser) return;
    if (message.senderId !== currentUser.id) {
      toast.error('You can only delete your own messages for everyone');
      return;
    }
    
    try {
      const chatId = getChatId(currentUser.id, selectedUser.id);
      const messageRef = ref(database, `chats/${chatId}/messages/${message.id}`);
      
      await update(messageRef, {
        deletedForEveryone: true,
        content: 'This message was deleted',
        type: 'text',
        mediaUrl: null,
        fileName: null,
        fileSize: null,
      });
      
      toast.success('Message deleted for everyone');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setContextMenu({ messageId: null, position: null });
    }
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.deletedForEveryone) {
      return <div className="italic">This message was deleted</div>;
    }

    switch (msg.type) {
      case 'image':
        return <img src={msg.mediaUrl} alt="Shared content" className="max-w-full max-h-64 rounded" />;
      case 'video':
        return <video src={msg.mediaUrl} controls className="max-w-full max-h-64 rounded" />;
      case 'document':
        return (
          <div className="flex items-center p-2 bg-white rounded border border-gray-200">
            <FileText className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="font-medium text-sm truncate max-w-xs">{msg.fileName}</p>
              <p className="text-xs text-gray-500">{msg.fileSize ? formatFileSize(msg.fileSize) : 'Unknown size'}</p>
            </div>
          </div>
        );
      case 'link':
        return (
          <a 
            href={msg.content.startsWith('http') ? msg.content : `https://${msg.content}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {msg.content}
          </a>
        );
      default:
        return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-gray-500">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-gray-400" />
        </div>
        <p>Select a user to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg shadow-sm">
      <div className="p-4 border-b flex items-center justify-between bg-white">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBackToUsers}
            className="md:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {userDetails.profileImage ? (
            <img
              src={userDetails.profileImage}
              alt={selectedUser.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {selectedUser.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-gray-900">{selectedUser.name}</div>
            <div className="text-xs text-gray-500">
              {userDetails.designation} • {userDetails.department}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:bg-gray-100"
            onClick={() => setIsMediaGalleryOpen(true)}
          >
            View Media
          </Button>
          <div className="text-sm text-gray-600">
            {userStatus === 'online' ? (
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                <span>Online</span>
              </div>
            ) : (
              <span>Last seen {lastSeen ? formatLastSeen(lastSeen) : 'recently'}</span>
            )}
          </div>
        </div>
      </div>

      {editingMessage && (
        <div className="p-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div className="text-sm text-blue-700 flex items-center">
            <Edit className="h-4 w-4 mr-2" />
            Editing message
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-700 hover:text-blue-800"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8" />
            </div>
            <p>No messages yet</p>
            <p className="text-sm mt-1">Start the conversation with {selectedUser.name}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex max-w-xs ${msg.senderId === currentUser?.id ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div
                className={`relative group p-3 rounded-lg ${msg.senderId === currentUser?.id
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                {(msg.senderId === currentUser?.id || msg.receiverId === currentUser?.id) && (
                  <button
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 text-white rounded-full p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({
                        messageId: msg.id,
                        position: { x: e.clientX, y: e.clientY },
                      });
                    }}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                )}
                
                {renderMessageContent(msg)}
                <div className={`text-xs mt-1 ${msg.senderId === currentUser?.id ? 'text-blue-100' : 'text-gray-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {msg.status === 'read' && msg.senderId === currentUser?.id && (
                    <span className="ml-1">✓✓</span>
                  )}
                  {msg.status === 'delivered' && msg.senderId === currentUser?.id && (
                    <span className="ml-1">✓</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {contextMenu.messageId && contextMenu.position && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white shadow-lg rounded-md border border-gray-200 py-1 w-48"
          style={{
            top: contextMenu.position.y,
            left: contextMenu.position.x,
          }}
        >
          {messages.find(m => m.id === contextMenu.messageId)?.senderId === currentUser?.id ? (
            <>
              {messages.find(m => m.id === contextMenu.messageId)?.type === 'text' && (
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                  onClick={() => {
                    const message = messages.find(m => m.id === contextMenu.messageId);
                    if (message) handleEditMessage(message);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                onClick={() => {
                  const message = messages.find(m => m.id === contextMenu.messageId);
                  if (message) handleDeleteForMe(message);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete for me
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                onClick={() => {
                  const message = messages.find(m => m.id === contextMenu.messageId);
                  if (message) handleDeleteForEveryone(message);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete for everyone
              </button>
            </>
          ) : (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
              onClick={() => {
                const message = messages.find(m => m.id === contextMenu.messageId);
                if (message) handleDeleteForMe(message);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete for me
            </button>
          )}
        </div>
      )}

      {mediaPreview && (
        <div className="relative border-t p-2 bg-gray-100">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={removeMediaPreview}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center p-2">
            {mediaPreview.type === 'image' ? (
              <img
                src={mediaPreview.url}
                alt="Preview"
                className="h-20 w-20 object-cover rounded"
              />
            ) : mediaPreview.type === 'video' ? (
              <video
                src={mediaPreview.url}
                className="h-20 w-20 object-cover rounded"
              />
            ) : (
              <div className="flex items-center">
                <FileText className="h-10 w-10 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium text-sm">{mediaPreview.fileName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(mediaPreview.fileSize || 0)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-3 border-t bg-white">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            {attachmentMenuOpen && (
              <div 
                ref={attachmentMenuRef}
                className="absolute bottom-12 left-0 bg-white shadow-lg rounded-md border border-gray-200 py-1 w-48 z-10"
              >
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setAttachmentMenuOpen(false);
                  }}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Photo/Video
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                  onClick={() => {
                    docInputRef.current?.click();
                    setAttachmentMenuOpen(false);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Document
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e, 'media')}
              accept="image/*,video/*"
              className="hidden"
            />
            <input
              type="file"
              ref={docInputRef}
              onChange={(e) => handleFileChange(e, 'document')}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
            />
          </div>
          <input
            type="text"
            placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button
            onClick={sendMessage}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2"
            disabled={(!newMessage.trim() && !mediaPreview) || isSending}
          >
            {isSending ? 'Sending...' : editingMessage ? 'Update' : 'Send'}
          </Button>
        </div>
      </div>

      <MediaGallery
        messages={messages}
        isOpen={isMediaGalleryOpen}
        onClose={() => setIsMediaGalleryOpen(false)}
      />
    </div>
  );
};

export default ChatWindow;