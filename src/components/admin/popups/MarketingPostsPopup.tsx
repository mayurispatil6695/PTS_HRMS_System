import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { 
  Calendar, 
  Clock, 
  Link, 
  Image, 
  FileText, 
  Share2,
  ChevronDown,
  ChevronUp,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  MessageSquare
} from 'lucide-react';
import { Badge } from '../../ui/badge';

interface MarketingPost {
  id: string;
  platform: string;
  content: string;
  scheduledDate: string;
  scheduledTime: string;
  postUrl?: string;
  imageUrl?: string;
  status: string;
  createdBy: string;
  createdByName: string;
  department: string;
  createdAt: string;
  updatedAt: string;
}

interface MarketingPostsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  posts: MarketingPost[];
}

const platformIcons: Record<string, React.ReactNode> = {
  'Facebook': <Facebook className="h-5 w-5 text-blue-600" />,
  'Instagram': <Instagram className="h-5 w-5 text-pink-600" />,
  'Twitter': <Twitter className="h-5 w-5 text-sky-500" />,
  'LinkedIn': <Linkedin className="h-5 w-5 text-indigo-700" />,
  'YouTube': <Youtube className="h-5 w-5 text-red-600" />,
  'TikTok': <MessageSquare className="h-5 w-5 text-black" />
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-yellow-100 text-yellow-700';
    case 'published': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const MarketingPostsPopup: React.FC<MarketingPostsPopupProps> = ({
  isOpen,
  onClose,
  posts
}) => {
  const [selectedPost, setSelectedPost] = useState<MarketingPost | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handlePostClick = (post: MarketingPost) => {
    setSelectedPost(post);
    setShowDetails(true);
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    setShowDetails(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showDetails && selectedPost ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBackToList}
                  className="h-8 w-8"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </Button>
                <span>Post Details</span>
              </div>
            ) : (
              'Marketing Posts'
            )}
          </DialogTitle>
        </DialogHeader>

        {showDetails && selectedPost ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {platformIcons[selectedPost.platform] || <Share2 className="h-5 w-5" />}
                    <span className="font-semibold">{selectedPost.platform}</span>
                  </div>
                  <Badge className={getStatusColor(selectedPost.status)}>
                    {selectedPost.status.charAt(0).toUpperCase() + selectedPost.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-800 whitespace-pre-line">{selectedPost.content}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>Scheduled: {formatDate(`${selectedPost.scheduledDate}T${selectedPost.scheduledTime}`)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>Created: {formatDate(selectedPost.createdAt)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Created By:</span> {selectedPost.createdByName}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Department:</span> {selectedPost.department}
                      </div>
                    </div>
                  </div>

                  {(selectedPost.postUrl || selectedPost.imageUrl) && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Attachments</h4>
                      <div className="flex flex-wrap gap-4">
                        {selectedPost.postUrl && (
                          <a 
                            href={selectedPost.postUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-600 hover:underline"
                          >
                            <Link className="h-4 w-4" />
                            <span>Post Link</span>
                          </a>
                        )}
                        {selectedPost.imageUrl && (
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            <span>Image</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleBackToList}>
                Back to List
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No marketing posts found
              </div>
            ) : (
              posts.map(post => (
                <Card 
                  key={post.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handlePostClick(post)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {platformIcons[post.platform] || <Share2 className="h-4 w-4" />}
                          <span className="font-medium">{post.platform}</span>
                          <Badge className={getStatusColor(post.status)}>
                            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-800 line-clamp-2 mb-3">{post.content}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(post.scheduledDate).toLocaleDateString()} at {post.scheduledTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>{post.createdByName}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronUp className="h-4 w-4 text-gray-400 rotate-90" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MarketingPostsPopup;