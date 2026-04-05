import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, Plus, Calendar, Image, Link, Edit, Trash2, Bell, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild, set, push, remove } from 'firebase/database';
import { toast } from 'react-hot-toast';

interface SocialMediaPost {
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

const SocialMediaCalendar = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMediaPost | null>(null);
  const [formData, setFormData] = useState({
    platform: '',
    content: '',
    scheduledDate: '',
    scheduledTime: '',
    postUrl: '',
    imageUrl: '',
    status: 'scheduled'
  });
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [activeNotification, setActiveNotification] = useState<{
    post: SocialMediaPost;
    timer: number;
  } | null>(null);
  const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  const platforms = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok'];
  const statuses = ['scheduled', 'published', 'draft'];

  // Check and request notification permission
  useEffect(() => {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    } else {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Check for posts scheduled for today and upcoming posts
  useEffect(() => {
    if (posts.length === 0) return;

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Check for posts scheduled for today
    const todayPosts = posts.filter(post => {
      return (
        post.scheduledDate === todayDateString && 
        post.status === 'scheduled'
      );
    });

    if (todayPosts.length > 0 && notificationPermission === 'granted') {
      showScheduledPostsNotification(todayPosts);
    }

    // Set up interval to check for upcoming posts every minute
    const checkInterval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      todayPosts.forEach(post => {
        const [hours, minutes] = post.scheduledTime.split(':').map(Number);
        
        // Check if it's exactly the scheduled time
        if (currentHour === hours && currentMinute === minutes) {
          showCenteredPostNotification(post);
        }
        
        // Notify 15 minutes before scheduled time
        if (
          currentHour === hours && 
          currentMinute === minutes - 15 && 
          notificationPermission === 'granted'
        ) {
          showUpcomingPostNotification(post);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [posts, notificationPermission]);

  const showScheduledPostsNotification = (posts: SocialMediaPost[]) => {
    const notificationOptions = {
      body: `You have ${posts.length} post(s) scheduled for today.`,
      icon: '/notification-icon.png',
      tag: 'today-posts-notification'
    };

    new Notification('Scheduled Posts Reminder', notificationOptions);
  };

  const showUpcomingPostNotification = (post: SocialMediaPost) => {
    const notificationOptions = {
      body: `Post scheduled for ${post.scheduledTime}: ${post.content.substring(0, 50)}...`,
      icon: '/notification-icon.png',
      tag: 'upcoming-post-notification'
    };

    new Notification(`Upcoming ${post.platform} Post`, notificationOptions);
  };

  const showCenteredPostNotification = (post: SocialMediaPost) => {
    // Clear any existing notification and intervals
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      setNotificationTimeout(null);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }

    // Set the active notification with 10 second timer
    setActiveNotification({
      post,
      timer: 10
    });

    // Start countdown
    const interval = setInterval(() => {
      setActiveNotification(prev => {
        if (prev && prev.timer > 1) {
          return { ...prev, timer: prev.timer - 1 };
        } else {
          clearInterval(interval);
          
          // When timer reaches 0, open the post URL if it exists
          if (prev?.post.postUrl) {
            window.open(prev.post.postUrl, '_blank');
          }
          
          return null;
        }
      });
    }, 1000);

    setCountdownInterval(interval);

    // Set timeout to automatically close after 10 seconds
    const timeout = setTimeout(() => {
      setActiveNotification(null);
      if (post.postUrl) {
        window.open(post.postUrl, '_blank');
      }
    }, 10000);

    setNotificationTimeout(timeout);
  };

  const closeNotification = () => {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      setNotificationTimeout(null);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setActiveNotification(null);
  };

  const markAsPublished = () => {
    if (!activeNotification || !user?.id || !user?.adminUid) return;

    const postRef = ref(database, `users/${user.adminUid}/employees/${user.id}/socialmedia/${activeNotification.post.id}`);
    
    set(postRef, {
      ...activeNotification.post,
      status: 'published',
      updatedAt: new Date().toISOString()
    }).then(() => {
      toast.success('Post marked as published');
      closeNotification();
    }).catch(error => {
      console.error('Error updating post status:', error);
      toast.error('Failed to update post status');
    });
  };

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      console.error("User ID or Admin UID not available");
      setLoading(false);
      return;
    }

    setLoading(true);
    const postsRef = ref(database, `users/${user.adminUid}/employees/${user.id}/socialmedia`);
    const postsQuery = query(postsRef, orderByChild('createdAt'));

    const unsubscribe = onValue(postsQuery, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const postsArray: SocialMediaPost[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<SocialMediaPost, 'id'>)
          })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          setPosts(postsArray);
        } else {
          setPosts([]);
        }
      } catch (error) {
        console.error("Error fetching social media posts:", error);
        toast.error("Failed to load social media posts");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const resetForm = () => {
    setFormData({
      platform: '',
      content: '',
      scheduledDate: '',
      scheduledTime: '',
      postUrl: '',
      imageUrl: '',
      status: 'scheduled'
    });
    setShowAddForm(false);
    setEditingPost(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newPost = {
        ...formData,
        createdBy: user?.email || '',
        createdByName: user?.name || '',
        department: user?.department || '',
        createdAt: editingPost ? editingPost.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingPost) {
        // Update existing post
        const postRef = ref(database, `users/${user?.adminUid}/employees/${user?.id}/socialmedia/${editingPost.id}`);
        await set(postRef, newPost);
        toast.success("Post updated successfully");
      } else {
        // Create new post
        const postsRef = ref(database, `users/${user?.adminUid}/employees/${user?.id}/socialmedia`);
        const newPostRef = push(postsRef);
        await set(newPostRef, newPost);
        toast.success("Post scheduled successfully");

        // Show notification if scheduled for today
        if (newPost.scheduledDate === new Date().toISOString().split('T')[0]) {
          if (notificationPermission === 'granted') {
            new Notification('Post Scheduled', {
              body: `Your ${newPost.platform} post has been scheduled for today at ${newPost.scheduledTime}`,
              icon: '/notification-icon.png'
            });
          }
        }
      }
      
      resetForm();
    } catch (error) {
      console.error("Error saving post:", error);
      toast.error("Failed to save post");
    }
  };

  const handleEdit = (post: SocialMediaPost) => {
    setFormData({
      platform: post.platform,
      content: post.content,
      scheduledDate: post.scheduledDate,
      scheduledTime: post.scheduledTime,
      postUrl: post.postUrl || '',
      imageUrl: post.imageUrl || '',
      status: post.status
    });
    setEditingPost(post);
    setShowAddForm(true);
  };

  const handleDelete = async (postId: string) => {
    try {
      const postRef = ref(database, `users/${user?.adminUid}/employees/${user?.id}/socialmedia/${postId}`);
      await remove(postRef);
      toast.success("Post deleted successfully");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('Notification permission granted!');
      } else {
        toast.error('You need to allow notifications for this feature');
      }
    });
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      'Facebook': 'bg-blue-100 text-blue-700',
      'Instagram': 'bg-pink-100 text-pink-700',
      'Twitter': 'bg-sky-100 text-sky-700',
      'LinkedIn': 'bg-indigo-100 text-indigo-700',
      'YouTube': 'bg-red-100 text-red-700',
      'TikTok': 'bg-purple-100 text-purple-700'
    };
    return colors[platform] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-yellow-100 text-yellow-700';
      case 'published': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPostStats = () => {
    const total = posts.length;
    const scheduled = posts.filter(p => p.status === 'scheduled').length;
    const published = posts.filter(p => p.status === 'published').length;
    const drafts = posts.filter(p => p.status === 'draft').length;
    
    return { total, scheduled, published, drafts };
  };

  const stats = getPostStats();

  // Only show this component for Digital Marketing department
  if (user?.department !== 'Digital Marketing') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">Access Restricted</h3>
          <p className="text-gray-500">This feature is only available for Digital Marketing team.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Centered Notification Popup */}
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative"
            initial={{ y: -50 }}
            animate={{ y: 0 }}
          >
            <button
              onClick={closeNotification}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${getPlatformColor(activeNotification.post.platform)}`}>
                <Share2 className="h-6 w-6" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">
                    {activeNotification.post.platform} Post Due Now
                  </h3>
                  <div className="bg-gray-100 px-2 py-1 rounded-full text-sm font-medium">
                    {activeNotification.timer}s
                  </div>
                </div>
                
                <p className="text-gray-700 mb-4">{activeNotification.post.content}</p>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Scheduled for {activeNotification.post.scheduledTime}
                  </span>
                </div>
                
                {activeNotification.post.postUrl && (
                  <div className="mt-3">
                    <a
                      href={activeNotification.post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                      <Link className="h-4 w-4" />
                      View Post Link
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button
                variant="outline"
                onClick={closeNotification}
                className="mr-2"
              >
                Dismiss
              </Button>
              <Button onClick={markAsPublished}>
                Mark as Published
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Social Media Calendar</h1>
          <p className="text-gray-600">Schedule and manage your social media posts</p>
        </div>
        <div className="flex gap-2">
          {notificationPermission !== 'granted' && (
            <Button 
              variant="outline" 
              onClick={requestNotificationPermission}
              className="flex items-center gap-2"
            >
              <Bell className="h-4 w-4" />
              Enable Notifications
            </Button>
          )}
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Post
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Posts</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Scheduled</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.scheduled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Published</p>
                  <p className="text-xl font-bold text-green-600">{stats.published}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-600">Drafts</p>
                  <p className="text-xl font-bold text-gray-600">{stats.drafts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Add/Edit Post Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>{editingPost ? 'Edit Post' : 'Schedule New Post'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select 
                    value={formData.platform} 
                    onValueChange={(value) => setFormData({...formData, platform: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map(platform => (
                        <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({...formData, status: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  placeholder="Post content..."
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  required
                  rows={4}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Scheduled Date</label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Scheduled Time</label>
                    <Input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Post URL (optional)"
                    value={formData.postUrl}
                    onChange={(e) => setFormData({...formData, postUrl: e.target.value})}
                  />
                  <Input
                    placeholder="Image URL (optional)"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">
                    {editingPost ? 'Update Post' : 'Schedule Post'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Posts List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Posts ({posts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPlatformColor(post.platform)}>
                          {post.platform}
                        </Badge>
                        <Badge className={getStatusColor(post.status)} variant="outline">
                          {post.status}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-800 mb-3">{post.content}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(post.scheduledDate).toLocaleDateString()} at {post.scheduledTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          <span>Created: {new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {(post.postUrl || post.imageUrl) && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {post.postUrl && (
                            <div className="flex items-center gap-1">
                              <Link className="h-3 w-3" />
                              <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                Post Link
                              </a>
                            </div>
                          )}
                          {post.imageUrl && (
                            <div className="flex items-center gap-1">
                              <Image className="h-3 w-3" />
                              <span>Image attached</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(post)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(post.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {posts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No social media posts scheduled yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default SocialMediaCalendar;