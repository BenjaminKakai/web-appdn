// features/chat/components/FeedsPage.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import SidebarNav from "@/components/SidebarNav";
import { useAuthStore } from "@/store/authStore";

// Configuration - Same as your server setup
const SERVER_IP = 'dev-api-gateway.wasaachat.com';
const API_BASE_URL = `https://${SERVER_IP}:9638/v1`;
const SOCKET_URL = `https://${SERVER_IP}:9638`;

interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    verified?: boolean;
  };
  content: string;
  media?: Array<{
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  }>;
  poll?: {
    options: Array<{
      text: string;
      votes: number;
      percentage: number;
    }>;
    totalVotes: number;
    userVoted: boolean;
  };
  type: 'text' | 'media' | 'poll';
  timestamp: string;
  reactions: {
    like: number;
    love: number;
    laugh: number;
    wow: number;
    sad: number;
    angry: number;
  };
  comments: number;
  shares: number;
  bookmarks: number;
  boosted?: boolean;
  userReaction?: string | null;
  userBookmarked?: boolean;
}

interface TrendingItem {
  category: string;
  hashtag: string;
  posts: string;
}

const FeedsPage: React.FC = () => {
  // Get authenticated user from authStore
  const { user, isAuthenticated, accessToken } = useAuthStore();
  
  // State management
  const [activeTab, setActiveTab] = useState("For You");
  const [postContent, setPostContent] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("Never");
  
  const socketRef = useRef<Socket | null>(null);

  // Sample trending data (this would come from API in real implementation)
  const trendingItems: TrendingItem[] = [
    {
      category: "Technology · Trending",
      hashtag: "#wasaachatchatfeeds",
      posts: "23.5K posts"
    },
    {
      category: "Technology · Trending", 
      hashtag: "#startupke",
      posts: "18.1K posts"
    },
    {
      category: "Innovation · Trending",
      hashtag: "#techke", 
      posts: "32.5K posts"
    },
    {
      category: "Local · Trending",
      hashtag: "#nairobitechc",
      posts: "12.8K posts"
    }
  ];

  const tabs = ["For You", "Following", "Trending"];

  // Debug logging function
  const logDebug = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Notification function
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // You can integrate with your toast system here
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Socket initialization
  const initSocket = () => {
    if (!user?.id || !accessToken) return;
    
    logDebug('Initializing socket connection...');
    
    try {
      const socket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ["polling"],  // ✅ ONLY POLLING
        upgrade: false,           // ✅ NO UPGRADE
        timeout: 10000,           // ✅ TIMEOUT SETTING
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        logDebug(`Socket connected: ${socket.id}`, 'success');
        setIsConnected(true);
        setLastSync(new Date().toLocaleTimeString());
        showNotification('Connected to WasaaChat!');
        
        // Join user room for feeds
        socket.emit('join-room', {
          roomId: `feeds:${user.id}`,
          userId: user.id,
          userName: user.name || user.username
        });
      });

      socket.on('connect_error', (error) => {
        logDebug(`Socket error: ${error.message}`, 'error');
        setIsConnected(false);
        showNotification(`Connection error: ${error.message}`, 'error');
      });

      socket.on('disconnect', (reason) => {
        logDebug(`Socket disconnected: ${reason}`, 'error');
        setIsConnected(false);
        showNotification('Disconnected from server', 'error');
      });

      // Feed-specific socket events
      socket.on('new-post', (data: Post) => {
        logDebug(`New post received: ${data.id}`);
        setPosts(prevPosts => [data, ...prevPosts]);
      });

      socket.on('post-reaction', (data: any) => {
        logDebug(`Post reaction: ${data.reaction} on ${data.postId}`);
        updatePostReaction(data.postId, data.reaction, data.count);
      });

      socket.on('post-comment', (data: any) => {
        logDebug(`New comment on post: ${data.postId}`);
        updatePostComments(data.postId, data.count);
      });

    } catch (error: any) {
      logDebug(`Socket initialization error: ${error.message}`, 'error');
      showNotification('Failed to connect to server', 'error');
    }
  };

  // Load posts from server
  const loadPostsFromServer = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/feeds/posts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
        logDebug(`Loaded ${data.posts?.length || 0} posts from server`, 'success');
      } else {
        // Fallback to mock data if server fails
        const mockPosts = generateMockPosts();
        setPosts(mockPosts);
        logDebug('Using mock data - server unavailable', 'error');
      }
    } catch (error: any) {
      logDebug(`Error loading posts: ${error.message}`, 'error');
      // Fallback to mock data
      const mockPosts = generateMockPosts();
      setPosts(mockPosts);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock posts for fallback
  const generateMockPosts = (): Post[] => {
    return [
      {
        id: 'post_1',
        author: {
          id: 'user_101',
          username: 'mary_njoroge',
          name: 'Mary Njoroge',
          avatar: 'MN',
          verified: true
        },
        content: 'Excited to announce WasaaChat Feeds! 🚀 The future of social networking in Africa starts here. #WasaaChatFeeds #TechKE #Innovation',
        media: [{ type: 'image', url: '/api/placeholder/500/300' }],
        type: 'media',
        timestamp: '2h',
        reactions: { like: 256, love: 89, laugh: 12, wow: 45, sad: 0, angry: 2 },
        comments: 78,
        shares: 34,
        bookmarks: 123,
        boosted: true,
        userReaction: null,
        userBookmarked: false
      },
      {
        id: 'post_2',
        author: {
          id: 'user_102',
          username: 'webmasters_ke',
          name: 'WebMasters Kenya',
          avatar: 'WK',
          verified: false
        },
        content: 'What\'s your favorite feature in WasaaChat Feeds? 🤔',
        poll: {
          options: [
            { text: 'Real-time feeds', votes: 67, percentage: 40 },
            { text: 'AI personalization', votes: 45, percentage: 27 },
            { text: 'Trending topics', votes: 34, percentage: 20 },
            { text: 'Post boosting', votes: 22, percentage: 13 }
          ],
          totalVotes: 168,
          userVoted: false
        },
        type: 'poll',
        timestamp: '4h',
        reactions: { like: 134, love: 23, laugh: 8, wow: 16, sad: 0, angry: 1 },
        comments: 45,
        shares: 12,
        bookmarks: 67,
        boosted: false,
        userReaction: 'like',
        userBookmarked: true
      }
    ];
  };

  // Post creation
  const handlePost = async () => {
    if (!postContent.trim() || !user?.id || !accessToken) return;

    const newPost: Partial<Post> = {
      content: postContent.trim(),
      type: 'text'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/feeds/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        const createdPost = await response.json();
        setPosts(prevPosts => [createdPost, ...prevPosts]);
        setPostContent("");
        showNotification('Post created successfully!');
        
        // Emit to socket for real-time updates
        if (socketRef.current?.connected) {
          socketRef.current.emit('new-post', createdPost);
        }
      } else {
        showNotification('Failed to create post', 'error');
      }
    } catch (error: any) {
      logDebug(`Error creating post: ${error.message}`, 'error');
      showNotification('Failed to create post', 'error');
    }
  };

  // Update post reaction
  const updatePostReaction = (postId: string, reaction: string, count: number) => {
    setPosts(prevPosts => prevPosts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactions: {
            ...post.reactions,
            [reaction]: count
          }
        };
      }
      return post;
    }));
  };

  // Update post comments
  const updatePostComments = (postId: string, count: number) => {
    setPosts(prevPosts => prevPosts.map(post => {
      if (post.id === postId) {
        return { ...post, comments: count };
      }
      return post;
    }));
  };

  // Handle like functionality
  const handleLike = async (postId: string) => {
    if (!user?.id || !accessToken) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const response = await fetch(`${API_BASE_URL}/feeds/posts/${postId}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          reaction: post.userReaction === 'like' ? null : 'like' 
        })
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === postId ? updatedPost : p
        ));
        
        // Emit to socket
        if (socketRef.current?.connected) {
          socketRef.current.emit('post-reaction', {
            postId,
            reaction: updatedPost.userReaction,
            userId: user.id
          });
        }
      }
    } catch (error: any) {
      logDebug(`Error updating reaction: ${error.message}`, 'error');
    }
  };

  // Handle comment functionality
  const handleComment = (postId: string) => {
    logDebug(`Opening comments for post: ${postId}`);
    showNotification('Comments view coming soon!');
  };

  // Handle repost functionality
  const handleRepost = async (postId: string) => {
    if (!user?.id || !accessToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/feeds/posts/${postId}/repost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === postId ? updatedPost : p
        ));
        showNotification('Post shared!');
      }
    } catch (error: any) {
      logDebug(`Error reposting: ${error.message}`, 'error');
    }
  };

  // Initialize when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && accessToken) {
      initSocket();
      loadPostsFromServer();
    } else {
      setIsLoading(false);
    }

    // Cleanup socket on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated, user?.id, accessToken]);

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access WasaaChat Feeds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <SidebarNav onClose={() => {}} />

      {/* Main Content */}
      <div className="flex-1 w-full ml-64">
        {/* Connection Status */}
        <div className="bg-white border-b border-gray-200 px-6 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <span>👤 <strong>{user.name || user.username || 'User'}</strong></span>
              <span>🔄 {lastSync}</span>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Feed Content */}
          <div className="flex-1 max-w-4xl">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Home</h1>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search"
                    className="bg-gray-100 border border-gray-200 rounded-full py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
              <div className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors duration-200 ${
                      activeTab === tab
                        ? "text-blue-500 border-b-2 border-blue-500"
                        : "text-gray-600 hover:text-blue-500"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Post Creation */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {user.profilePicture ? (
                    <img 
                      src={user.profilePicture} 
                      alt="Your avatar"
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span className={user.profilePicture ? "hidden" : ""}>
                    {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="What's happening in Kenya?"
                    className="w-full resize-none border-none outline-none text-lg placeholder-gray-500"
                    rows={3}
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handlePost}
                      disabled={!postContent.trim()}
                      className={`px-6 py-2 rounded-full font-medium transition-colors duration-200 ${
                        postContent.trim()
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts Feed */}
            <div className="bg-white">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-4">📱</div>
                  <h2 className="text-xl font-semibold mb-2">Welcome to WasaaChat Feeds!</h2>
                  <p>Start by creating your first post or refresh to load content.</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="border-b border-gray-200 p-6 hover:bg-gray-50 transition-colors duration-200">
                    <div className="flex space-x-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {post.author.avatar}
                      </div>

                      {/* Post Content */}
                      <div className="flex-1 min-w-0">
                        {/* User Info */}
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-gray-900">{post.author.name}</span>
                          {post.author.verified && <span className="text-blue-500">✓</span>}
                          <span className="text-gray-500">@{post.author.username}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500 text-sm">{post.timestamp}</span>
                          {post.boosted && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                              Boosted
                            </span>
                          )}
                        </div>

                        {/* Post Text */}
                        <p className="text-gray-900 mb-3">{post.content}</p>

                        {/* Post Media */}
                        {post.media && post.media.length > 0 && (
                          <div className="mb-3 rounded-lg overflow-hidden">
                            <img
                              src={post.media[0].url}
                              alt="Post content"
                              className="w-full h-auto max-h-96 object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/api/placeholder/500/300";
                              }}
                            />
                          </div>
                        )}

                        {/* Poll */}
                        {post.poll && (
                          <div className="mb-3 p-4 bg-gray-50 rounded-lg border">
                            {post.poll.options.map((option, index) => (
                              <div key={index} className="mb-2 p-3 bg-white rounded cursor-pointer hover:bg-gray-50 relative overflow-hidden">
                                <div 
                                  className="absolute left-0 top-0 h-full bg-blue-100 transition-all duration-300"
                                  style={{ width: `${option.percentage}%` }}
                                ></div>
                                <span className="relative z-10 font-medium">
                                  {option.text} {post.poll.userVoted && `(${option.percentage}%)`}
                                </span>
                              </div>
                            ))}
                            <div className="text-sm text-gray-500 mt-2">
                              <strong>{post.poll.totalVotes}</strong> votes • {post.poll.userVoted ? 'You voted ✓' : 'Tap to vote'}
                            </div>
                          </div>
                        )}

                        {/* Interaction Buttons */}
                        <div className="flex items-center space-x-6 text-gray-500">
                          <button
                            onClick={() => handleComment(post.id)}
                            className="flex items-center space-x-2 hover:text-blue-500 transition-colors duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                              />
                            </svg>
                            <span className="text-sm">{post.comments}</span>
                          </button>

                          <button
                            onClick={() => handleRepost(post.id)}
                            className="flex items-center space-x-2 hover:text-green-500 transition-colors duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            <span className="text-sm">{post.shares}</span>
                          </button>

                          <button
                            onClick={() => handleLike(post.id)}
                            className={`flex items-center space-x-2 transition-colors duration-200 ${
                              post.userReaction === 'like' ? "text-red-500" : "hover:text-red-500"
                            }`}
                          >
                            <svg
                              className="w-5 h-5"
                              fill={post.userReaction === 'like' ? "currentColor" : "none"}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            <span className="text-sm">
                              {Object.values(post.reactions).reduce((sum, count) => sum + count, 0)}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar - Trending */}
          <div className="w-80 bg-white border-l border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Trending in Kenya</h2>
              <div className="space-y-4">
                {trendingItems.map((item, index) => (
                  <div key={index} className="hover:bg-gray-50 p-3 rounded-lg transition-colors duration-200 cursor-pointer">
                    <p className="text-sm text-gray-500 mb-1">{item.category}</p>
                    <p className="font-semibold text-gray-900 mb-1">{item.hashtag}</p>
                    <p className="text-sm text-gray-500">{item.posts}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Advertisement */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="text-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">N</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">Feel fresh</h3>
                <p className="text-blue-100">in every moment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedsPage;