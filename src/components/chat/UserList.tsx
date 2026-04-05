// UserList.tsx - Updated to use types from chatStore
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MoreVertical, MessageCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore, User as ChatStoreUser } from '../../store/chatStore';
import { ref, onValue, off, get, query, orderByChild, limitToLast, DataSnapshot } from 'firebase/database';
import { database } from '../../firebase';

// Extend the chat store user type for component use
interface User extends ChatStoreUser {
  addedBy?: string;
  isActive?: boolean;
}

interface LastMessage {
  content: string;
  type: string;
  timestamp: number;
  senderId: string;
  senderName?: string;
  deleted?: boolean;
}

interface UserListProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
  onlineUsers: string[];
  onCloseMobile?: () => void;
}

interface FirebaseUserData {
  name?: string;
  email?: string;
  profileImage?: string;
  designation?: string;
  department?: string;
  status?: string;
  role?: string;
  addedBy?: string;
  employees?: Record<string, FirebaseUserData>;
}

const UserList: React.FC<UserListProps> = ({
  searchTerm,
  onSearchChange,
  selectedUser,
  onUserSelect,
  onlineUsers,
  onCloseMobile,
}) => {
  const { user: authUser } = useAuth();
  const { unreadCounts, getChatId, markAsRead } = useChatStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});

  const isAdmin = authUser?.role === 'admin';

  useEffect(() => {
    if (!authUser) return;

    setLoading(true);
    setError(null);

    const fetchAllUsers = async () => {
      try {
        const allUsers: User[] = [];
        const userIds = new Set<string>();

        if (isAdmin) {
          const usersRef = ref(database, `users`);
          const usersSnap = await get(usersRef);

          if (usersSnap.exists()) {
            const usersData: Record<string, FirebaseUserData> = usersSnap.val();
            
            Object.entries(usersData).forEach(([uid, userData]) => {
              if (uid === authUser.id) return;
              
              allUsers.push({
                id: uid,
                name: userData.name || userData.email || `User ${uid.slice(0, 6)}`,
                email: userData.email || '',
                role: userData.role === 'admin' ? 'admin' : 'employee',
                designation: userData.designation || (userData.role === 'admin' ? 'Administrator' : 'Employee'),
                department: userData.department || (userData.role === 'admin' ? 'Management' : 'General'),
                status: userData.status || '',
                isActive: userData.status === 'active',
                profileImage: userData.profileImage || '',
                addedBy: userData.addedBy || '',
              });
              userIds.add(uid);
            });
          }
        } else {
          const usersRef = ref(database, `users`);
          const usersSnap = await get(usersRef);

          if (usersSnap.exists()) {
            const usersData: Record<string, FirebaseUserData> = usersSnap.val();
            
            Object.entries(usersData).forEach(([uid, userData]) => {
              if (uid === authUser.id) return;
              
              if (userData.role === 'admin') {
                allUsers.push({
                  id: uid,
                  name: userData.name || userData.email || 'Administrator',
                  email: userData.email || '',
                  role: 'admin',
                  designation: userData.designation || 'Administrator',
                  department: userData.department || 'Management',
                  status: userData.status || '',
                  isActive: userData.status === 'active',
                  profileImage: userData.profileImage || '',
                  addedBy: '',
                });
                userIds.add(uid);
              }
            });
          }

          const adminId = authUser.adminUid;
          
          if (adminId) {
            const employeesRef = ref(database, `users/${adminId}/employees`);
            const employeesSnap = await get(employeesRef);

            if (employeesSnap.exists()) {
              const employeesData: Record<string, FirebaseUserData> = employeesSnap.val();
              Object.entries(employeesData).forEach(([empId, empData]) => {
                if (empId !== authUser.id && !userIds.has(empId)) {
                  allUsers.push({
                    id: empId,
                    name: empData.name || empData.email || 'Employee',
                    email: empData.email || '',
                    role: 'employee',
                    designation: empData.designation || 'Employee',
                    department: empData.department || 'General',
                    status: empData.status || '',
                    isActive: empData.status === 'active',
                    profileImage: empData.profileImage || '',
                    addedBy: adminId,
                  });
                  userIds.add(empId);
                }
              });
            }
          }
        }

        const statusListeners: (() => void)[] = [];

        for (const user of allUsers) {
          const userStatusRef = ref(database, `users/${user.id}/status`);
          const unsub = onValue(userStatusRef, (snapshot: DataSnapshot) => {
            const statusVal = snapshot.val();
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id
                  ? { ...u, status: statusVal, isActive: statusVal === 'active' }
                  : u
              )
            );
          });
          statusListeners.push(() => off(userStatusRef));
        }

        const lastMessageListeners: (() => void)[] = [];

        for (const user of allUsers) {
          if (user.id === authUser.id) continue;
          
          const chatId = getChatId(authUser.id, user.id);
          const messagesRef = query(
            ref(database, `chats/${chatId}/messages`),
            orderByChild('timestamp'),
            limitToLast(1)
          );

          const unsub = onValue(messagesRef, (snapshot: DataSnapshot) => {
            if (snapshot.exists()) {
              const messagesData = snapshot.val();
              const lastMsgEntry = Object.entries(messagesData)[0];
              if (lastMsgEntry) {
                const lastMsg = lastMsgEntry[1] as {
                  content: string;
                  type: string;
                  timestamp: number;
                  senderId: string;
                  senderName?: string;
                  deletedForEveryone?: boolean;
                  deleted?: boolean;
                };
                
                setLastMessages(prev => ({
                  ...prev,
                  [user.id]: {
                    content: lastMsg.content,
                    type: lastMsg.type,
                    timestamp: lastMsg.timestamp,
                    senderId: lastMsg.senderId,
                    senderName: lastMsg.senderName,
                    deleted: lastMsg.deletedForEveryone || lastMsg.deleted
                  }
                }));
              }
            } else {
              setLastMessages(prev => {
                const updated = {...prev};
                delete updated[user.id];
                return updated;
              });
            }
          });

          lastMessageListeners.push(() => off(messagesRef));
        }

        setUsers(allUsers);

        return () => {
          statusListeners.forEach((unsub) => unsub());
          lastMessageListeners.forEach((unsub) => unsub());
        };
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchAllUsers();
  }, [authUser, isAdmin]);

  const sortedUsers = [...users].sort((a, b) => {
    const aLastMsg = lastMessages[a.id]?.timestamp || 0;
    const bLastMsg = lastMessages[b.id]?.timestamp || 0;
    return bLastMsg - aLastMsg;
  });

  const filteredUsers = sortedUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUnreadCount = (userId: string) => {
    if (!authUser) return 0;
    const chatId = getChatId(authUser.id, userId);
    return unreadCounts[chatId] || 0;
  };

  const formatLastMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const mins = Math.floor(diffInHours * 60);
      return mins === 0 ? 'now' : `${mins}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (content: string, maxLength = 30) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return `${content.slice(0, maxLength)}...`;
  };

  const handleUserClick = (user: User) => {
    onUserSelect(user);
    if (authUser) {
      const chatId = getChatId(authUser.id, user.id);
      markAsRead(chatId, authUser.id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Loading Chats...</h2>
          </div>
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Error</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-full p-4 text-red-500">
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {isAdmin ? 'All Employees' : 'Chats'}
          </h2>
          <Button variant="ghost" size="icon" className="text-gray-600">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={isAdmin ? "Search employees..." : "Search or start new chat"}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-white border-gray-200 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{isAdmin ? 'No employees found' : 'No users found'}</p>
            {searchTerm && <p className="text-sm mt-2">Try a different search term</p>}
          </div>
        ) : (
          filteredUsers.map((user, idx) => {
            const lastMessage = lastMessages[user.id];
            const unreadCount = getUnreadCount(user.id);
            const isOnline = onlineUsers.includes(user.id);
            const isSelected = selectedUser?.id === user.id;
            const isCurrentUser = user.id === authUser?.id;
            const isAdminUser = user.role === 'admin';
            const hasUnread = unreadCount > 0;
            const isLastMessageFromOther = lastMessage?.senderId !== authUser?.id;

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
                  isSelected ? 'bg-gray-100 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => !isCurrentUser && handleUserClick(user)}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={user.profileImage} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline && !isCurrentUser && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                  {isAdminUser && !isCurrentUser && !isAdmin && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                  )}
                  {unreadCount > 0 && !isCurrentUser && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-red-500 text-white rounded-full h-5 w-5 p-0 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 ml-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-medium ${hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}>
                        {user.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-blue-500">(You)</span>
                        )}
                        {isAdminUser && !isCurrentUser && !isAdmin && (
                          <span className="ml-2 text-xs text-blue-500">(Admin)</span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {user.designation || 'No designation'}
                        {user.department && ` • ${user.department}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lastMessage && (
                        <span className={`text-xs ${hasUnread && isLastMessageFromOther ? 'text-blue-500 font-medium' : 'text-gray-500'}`}>
                          {formatLastMessageTime(lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1">
                    <p className={`text-sm truncate ${hasUnread && isLastMessageFromOther ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {lastMessage ? (
                        <>
                          {lastMessage.type === 'image' && '📷 Photo'}
                          {lastMessage.type === 'video' && '🎥 Video'}
                          {lastMessage.type === 'document' && '📄 Document'}
                          {lastMessage.type === 'link' && '🔗 Link'}
                          {lastMessage.type === 'text' && (
                            <>
                              {lastMessage.senderId === authUser?.id && 'You: '}
                              {truncateMessage(lastMessage.content)}
                            </>
                          )}
                          {lastMessage.deleted && '🚫 This message was deleted'}
                        </>
                      ) : (
                        <span className="text-gray-400">No messages yet</span>
                      )}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>Logged in as: {authUser?.email}</span>
          <div className="flex items-center">
            <span className="mr-2">Status:</span>
            <Badge variant={authUser?.status === 'active' ? 'default' : 'secondary'}>
              {authUser?.status === 'active' ? 'Online' : 'Offline'}
              {authUser?.role === 'admin' && ' • Admin'}
            </Badge>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
            <span>Showing {filteredUsers.length} of {users.length} total employees</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;