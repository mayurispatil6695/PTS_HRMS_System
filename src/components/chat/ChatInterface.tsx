// ChatInterface.tsx - Fixed TypeScript errors
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getDatabase, ref, set } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/use-toast';
import { useChatStore, Message } from '../../store/chatStore';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import { get } from 'firebase/database';

const db = getDatabase();

interface ChatUser {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'employee';
  designation?: string;
  department?: string;
  profileImage?: string;
  status?: string;
  isActive?: boolean;
}

const ChatInterface = () => {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserList, setShowUserList] = useState(true);

  const {
    messages,
    onlineUsers,
    typingUsers,
    currentChat,
    addMessage,
    editMessage,
    deleteMessage,
    setOnlineUsers,
    setTypingUser,
    setCurrentChat,
    getChatId,
    playNotificationSound
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Convert auth user to chat user
  const currentUser = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    role: authUser.role,
    designation: authUser.designation,
    department: authUser.department,
    profileImage: authUser.profileImage,
    status: authUser.status,
    isActive: authUser.status === 'active'
  } : null;

  useEffect(() => {
    const allUsers = JSON.parse(localStorage.getItem('hrms_users') || '[]');
    const otherUsers = allUsers.filter((u: ChatUser) => u.id !== currentUser?.id);

    const initialOnlineUsers = otherUsers
      .slice(0, Math.floor(Math.random() * otherUsers.length / 2) + 1)
      .map((u: ChatUser) => u.id);

    setOnlineUsers(initialOnlineUsers);

    const presenceInterval = setInterval(() => {
      const onlineCount = Math.floor(Math.random() * otherUsers.length / 2) + 1;
      const shuffled = [...otherUsers].sort(() => 0.5 - Math.random());
      setOnlineUsers(shuffled.slice(0, onlineCount).map((u: ChatUser) => u.id));
    }, 30000);

    return () => clearInterval(presenceInterval);
  }, [currentUser?.id, setOnlineUsers]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentChat]);

  const handleUserSelect = (user: ChatUser) => {
    setSelectedUser(user);
    if (currentUser) {
      const chatId = getChatId(currentUser.id, user.id);
      setCurrentChat(chatId);
    }
    if (window.innerWidth < 768) {
      setShowUserList(false);
    }
  };

  const generateChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  const getChatPath = (
    uid: string,
    otherUser: ChatUser,
    isSender: boolean
  ): string => {
    if (otherUser.role === 'employee') {
      return `users/${uid}/employees/${otherUser.id}/chat`;
    }
    return `users/${uid}/chat`;
  };

  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'video' | 'document' | 'link' = 'text'
  ) => {
    if (!selectedUser || !currentUser || !content.trim()) return;

    const chatId = generateChatId(currentUser.id, selectedUser.id);
    const timestamp = Date.now();
    const messageId = timestamp.toString();

    const newMessage: Message = {
      id: messageId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: selectedUser.id,
      receiverName: selectedUser.name,
      content,
      type: type as 'text' | 'image' | 'video' | 'link' | 'document',
      timestamp,
      status: 'sent',
      ...(type !== 'text' && { mediaUrl: content }),
    };

    addMessage(chatId, newMessage);

    const senderPath = `${getChatPath(currentUser.id, selectedUser, true)}/${chatId}/${messageId}`;
    const receiverPath = `${getChatPath(selectedUser.id, currentUser, false)}/${chatId}/${messageId}`;

    try {
      await set(ref(db, senderPath), newMessage);
      await set(ref(db, receiverPath), newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Send Failed',
        description: 'Could not send message.',
        variant: 'destructive',
      });
      return;
    }

    setTimeout(async () => {
      const deliveredMessage = { ...newMessage, status: 'delivered' as const };
      editMessage(chatId, messageId, deliveredMessage.content);
      await set(ref(db, senderPath), deliveredMessage);
      await set(ref(db, receiverPath), deliveredMessage);

      setTimeout(async () => {
        const readMessage = { ...deliveredMessage, status: 'read' as const };
        editMessage(chatId, messageId, readMessage.content);
        await set(ref(db, senderPath), readMessage);
        await set(ref(db, receiverPath), readMessage);
      }, Math.random() * 3000 + 1000);
    }, Math.random() * 1000 + 500);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!selectedUser || !currentUser) return;
    const chatId = generateChatId(currentUser.id, selectedUser.id);
    setTypingUser(chatId, currentUser.id, isTyping);

    if (isTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser(chatId, currentUser.id, false);
      }, 3000);
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!selectedUser || !currentUser) return;
    const chatId = generateChatId(currentUser.id, selectedUser.id);
    editMessage(chatId, messageId, newContent);

    toast({
      title: 'Message edited',
      description: 'Your message has been updated.',
    });
  };

  const handleDeleteMessage = (messageId: string, deleteForEveryone = false) => {
    if (!selectedUser || !currentUser) return;
    const chatId = generateChatId(currentUser.id, selectedUser.id);
    deleteMessage(chatId, messageId, deleteForEveryone);

    toast({
      title: deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted',
      description: deleteForEveryone
        ? 'This message was removed for all participants.'
        : 'Message was removed for you.',
    });
  };

  const getCurrentChatMessages = () => {
    if (!selectedUser || !currentUser) return [];
    const chatId = generateChatId(currentUser.id, selectedUser.id);
    return messages[chatId] || [];
  };

  const getCurrentTypingUsers = () => {
    if (!selectedUser || !currentUser) return [];
    const chatId = generateChatId(currentUser.id, selectedUser.id);
    return (typingUsers[chatId] || []).filter((id) => id !== currentUser.id);
  };

  const toggleUserList = () => {
    setShowUserList(!showUserList);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-50 relative">
      <div className="md:hidden flex items-center justify-between p-3 border-b border-gray-200 bg-white">
        <button 
          onClick={toggleUserList}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">
          {selectedUser ? selectedUser.name : 'Chat'}
        </h1>
        <div className="w-8"></div>
      </div>

      <div className={`${showUserList ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-gray-200 bg-white flex-shrink-0 absolute md:relative z-10 h-full md:h-auto`}>
        <UserList
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
          onlineUsers={onlineUsers}
          onCloseMobile={() => setShowUserList(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            messages={getCurrentChatMessages()}
            onSendMessage={sendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onExitChat={() => {
              setSelectedUser(null);
              setCurrentChat(null);
              if (window.innerWidth < 768) {
                setShowUserList(true);
              }
            }}
            onTyping={handleTyping}
            typingUsers={getCurrentTypingUsers()}
            messagesEndRef={messagesEndRef}
            onBackToUsers={toggleUserList}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-4"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto">
                <span className="text-4xl md:text-6xl">💬</span>
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-gray-700">
                {currentUser?.role === 'admin' ? 'Admin Chat Panel' : 'Employee Communication'}
              </h3>
              <p className="text-sm md:text-base text-gray-500 max-w-xs md:max-w-sm leading-relaxed">
                Select a contact from the sidebar to start a conversation.
                <br />
                Stay connected with your team through instant messaging.
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;