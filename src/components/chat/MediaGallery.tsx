
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';
import { Message } from '../../store/chatStore';

interface MediaGalleryProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  messages,
  isOpen,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'viewer'>('grid');

  // Filter media messages
  const mediaMessages = messages.filter(msg => 
    (msg.type === 'image' || msg.type === 'video') && !msg.deleted
  );

  const handleMediaClick = (index: number) => {
    setSelectedIndex(index);
    setViewMode('viewer');
  };

  const handlePrevious = () => {
    setSelectedIndex(prev => prev > 0 ? prev - 1 : mediaMessages.length - 1);
  };

  const handleNext = () => {
    setSelectedIndex(prev => prev < mediaMessages.length - 1 ? prev + 1 : 0);
  };

  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (timestamp: Date) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">
              {viewMode === 'grid' ? 'Media Gallery' : `${selectedIndex + 1} of ${mediaMessages.length}`}
            </h3>
            <div className="flex items-center gap-2">
              {viewMode === 'viewer' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  Back to Gallery
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 overflow-y-auto h-full"
                >
                  {mediaMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <span className="text-2xl">📷</span>
                        </div>
                        <p>No media shared yet</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {mediaMessages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="relative group cursor-pointer"
                          onClick={() => handleMediaClick(index)}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {message.type === 'image' ? (
                              <img
                                src={message.mediaUrl || message.content}
                                alt="Shared media"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="relative w-full h-full">
                                <video
                                  src={message.mediaUrl || message.content}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                    <span className="text-white">▶</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Date overlay */}
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            {formatDate(message.timestamp)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="viewer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-full bg-black/5 relative"
                >
                  {mediaMessages.length > 0 && (
                    <>
                      {/* Navigation buttons */}
                      {mediaMessages.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30"
                            onClick={handlePrevious}
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30"
                            onClick={handleNext}
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </>
                      )}

                      {/* Media content */}
                      <div className="max-w-full max-h-full p-4">
                        {mediaMessages[selectedIndex].type === 'image' ? (
                          <img
                            src={mediaMessages[selectedIndex].mediaUrl || mediaMessages[selectedIndex].content}
                            alt="Shared media"
                            className="max-w-full max-h-full rounded-lg"
                          />
                        ) : (
                          <video
                            src={mediaMessages[selectedIndex].mediaUrl || mediaMessages[selectedIndex].content}
                            controls
                            className="max-w-full max-h-full rounded-lg"
                            autoPlay
                          />
                        )}
                      </div>

                      {/* Download button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/30"
                        onClick={() => downloadMedia(
                          mediaMessages[selectedIndex].mediaUrl || mediaMessages[selectedIndex].content,
                          `media_${mediaMessages[selectedIndex].id}.${mediaMessages[selectedIndex].type === 'image' ? 'jpg' : 'mp4'}`
                        )}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaGallery;
