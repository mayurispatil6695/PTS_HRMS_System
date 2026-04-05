// chatStore.ts - Fixed typo
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  receiverName?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'link' | 'document';
  timestamp: number;
  edited?: boolean;
  deleted?: boolean;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  deletedForSender?: boolean;
  deletedForReceiver?: boolean;
  deletedForEveryone?: boolean;  // Fixed: Changed from 'deleteForEveryone' to 'deletedForEveryone'
  linkPreview?: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
  department?: string;
  designation?: string;
  employeeId?: string;
  isActive?: boolean;
  phone?: string;
  profileImage?: string;
  status?: string;
  lastActive?: number;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: number;
}

export interface ChatState {
  messages: Record<string, Message[]>;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>;
  unreadCounts: Record<string, number>;
  currentChat: string | null;
  searchTerm: string;
  
  addMessage: (chatId: string, message: Message) => void;
  editMessage: (chatId: string, messageId: string, newContent: string) => void;
  deleteMessage: (chatId: string, messageId: string, deleteForEveryone?: boolean) => void;
  setOnlineUsers: (users: string[]) => void;
  setTypingUser: (chatId: string, userId: string, isTyping: boolean) => void;
  markAsRead: (chatId: string, userId: string) => void;
  setCurrentChat: (chatId: string | null) => void;
  setSearchTerm: (term: string) => void;
  getMediaMessages: (chatId: string) => Message[];
  getChatId: (user1: string, user2: string) => string;
  playNotificationSound: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: {},
      onlineUsers: [],
      typingUsers: {},
      unreadCounts: {},
      currentChat: null,
      searchTerm: '',

      addMessage: (chatId: string, message: Message) => {
        set((state) => {
          const newState = {
            messages: {
              ...state.messages,
              [chatId]: [...(state.messages[chatId] || []), message]
            },
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: state.currentChat === chatId ? 0 : (state.unreadCounts[chatId] || 0) + 1
            }
          };
          
          if (state.currentChat !== chatId) {
            get().playNotificationSound();
          }
          
          return newState;
        });
      },

      editMessage: (chatId: string, messageId: string, newContent: string) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId]?.map(msg =>
              msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
            ) || []
          }
        }));
      },

      deleteMessage: (chatId: string, messageId: string, deleteForEveryone = false) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId]?.map(msg =>
              msg.id === messageId 
                ? { ...msg, deleted: true, content: deleteForEveryone ? 'This message was deleted' : '', deletedForEveryone: deleteForEveryone }
                : msg
            ) || []
          }
        }));
      },

      setOnlineUsers: (users: string[]) => {
        set({ onlineUsers: users });
      },

      setTypingUser: (chatId: string, userId: string, isTyping: boolean) => {
        set((state) => {
          const currentTyping = state.typingUsers[chatId] || [];
          const newTyping = isTyping
            ? [...currentTyping.filter(id => id !== userId), userId]
            : currentTyping.filter(id => id !== userId);
          
          return {
            typingUsers: {
              ...state.typingUsers,
              [chatId]: newTyping
            }
          };
        });
      },

      markAsRead: (chatId: string, userId: string) => {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [chatId]: 0
          },
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId]?.map(msg =>
              msg.receiverId === userId ? { ...msg, status: 'read' as const } : msg
            ) || []
          }
        }));
      },

      setCurrentChat: (chatId: string | null) => {
        set({ currentChat: chatId });
      },

      setSearchTerm: (term: string) => {
        set({ searchTerm: term });
      },

      getMediaMessages: (chatId: string) => {
        const messages = get().messages[chatId] || [];
        return messages.filter(msg => msg.type === 'image' || msg.type === 'video' || msg.type === 'link');
      },

      getChatId: (user1: string, user2: string) => {
        return [user1, user2].sort().join('_');
      },

      playNotificationSound: () => {
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PtwmYgBFqy4+Fzew==');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch (error) {
          console.log('Could not play notification sound:', error);
        }
      }
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({ 
        messages: state.messages,
        unreadCounts: state.unreadCounts 
      }),
    }
  )
);