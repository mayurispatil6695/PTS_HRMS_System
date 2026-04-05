
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreVertical, Copy, Trash2, Check, CheckCheck, Download } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';
import { Message } from '../../store/chatStore';
import { User } from '../../types/chat';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string, deleteForEveryone?: boolean) => void;
  user: User;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  onEdit,
  onDelete,
  user
}) => {
  const { user: currentUser } = useAuth();
  const [showOptions, setShowOptions] = useState(false);

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowOptions(false);
  };

  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMessageContent = () => {
    if (message.deleted) {
      return (
        <div className="flex items-center gap-2 text-gray-500 italic">
          <span className="text-sm">🚫</span>
          <span className="text-sm">{message.content || 'This message was deleted'}</span>
        </div>
      );
    }

    switch (message.type) {
      case 'image':
        return (
          <div className="max-w-sm">
            <img 
              src={message.mediaUrl || message.content} 
              alt="Shared image" 
              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.mediaUrl || message.content, '_blank')}
            />
            {message.content && message.content !== message.mediaUrl && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="max-w-sm">
            <video 
              src={message.mediaUrl || message.content} 
              controls 
              className="rounded-lg max-w-full h-auto"
            />
            {message.content && message.content !== message.mediaUrl && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
      case 'link':
        return (
          <div>
            {message.linkPreview ? (
              <div className="border rounded-lg overflow-hidden mb-2 bg-gray-50">
                {message.linkPreview.image && (
                  <img 
                    src={message.linkPreview.image} 
                    alt={message.linkPreview.title}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-3">
                  <h4 className="font-medium text-sm text-gray-900 mb-1">
                    {message.linkPreview.title}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    {message.linkPreview.description}
                  </p>
                  <a 
                    href={message.linkPreview.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {message.linkPreview.url}
                  </a>
                </div>
              </div>
            ) : (
              <a 
                href={message.content} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {message.content}
              </a>
            )}
          </div>
        );
      default:
        return (
          <div>
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            {message.edited && (
              <span className="text-xs text-gray-500 italic ml-2">edited</span>
            )}
          </div>
        );
    }
  };

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    switch (message.status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}
    >
      <div className={`flex gap-2 max-w-[80%] md:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Message Bubble */}
        <div className="relative">
          <Popover open={showOptions} onOpenChange={setShowOptions}>
            <PopoverTrigger asChild>
              <div
                className={`relative px-3 py-2 ${
                  isOwn
                    ? 'bg-green-500 text-white rounded-lg rounded-br-none'
                    : 'bg-white text-gray-900 rounded-lg rounded-bl-none shadow-sm border border-gray-200'
                } cursor-pointer hover:shadow-md transition-shadow`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowOptions(true);
                }}
              >
                {renderMessageContent()}
                
                {/* Time and Status */}
                <div className={`flex items-center gap-1 mt-1 ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}>
                  <span className={`text-xs ${
                    isOwn ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </span>
                  {renderStatusIcon()}
                </div>
                
                {/* Options Menu Trigger */}
                <button
                  className={`absolute top-1 ${
                    isOwn ? 'left-1' : 'right-1'
                  } opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30 rounded-full p-1`}
                  onClick={() => setShowOptions(true)}
                >
                  <MoreVertical className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            </PopoverTrigger>
            
            {!message.deleted && (
              <PopoverContent className="w-48 p-2" align={isOwn ? 'end' : 'start'}>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      copyToClipboard(message.content);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  
                  {(message.type === 'image' || message.type === 'video') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        downloadMedia(
                          message.mediaUrl || message.content,
                          `${message.type}_${message.id}.${message.type === 'image' ? 'jpg' : 'mp4'}`
                        );
                        setShowOptions(false);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  
                  {isOwn && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-red-600 hover:text-red-700"
                        onClick={() => {
                          onDelete(message.id, false);
                          setShowOptions(false);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete for me
                      </Button>
                      {currentUser?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700"
                          onClick={() => {
                            onDelete(message.id, true);
                            setShowOptions(false);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete for everyone
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </PopoverContent>
            )}
          </Popover>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
