import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Image as ImageIcon, Trash2, LogOut, MessageSquare, X, Hash, Smile, Paperclip, Cigarette, BookOpen, FileText, Plus, Volume2, Settings, Search, Pin, Edit2, Heart, ThumbsUp, Laugh, Star, Moon, Sun, Bell, BellOff, Users, Crown, PenTool, Eraser, Palette, Minus, Maximize } from 'lucide-react';
import { sendMessage, subscribeToMessages, clearAllMessages, saveUser, uploadImage, uploadFile, createCourse, subscribeToCourses, addFileToCourse, subscribeToCourseFiles, createChannel, subscribeToChannels, addWhiteboardStroke, subscribeToWhiteboard, clearWhiteboard } from './services/firebase';

interface Message {
  id: string;
  username: string;
  avatar: string;
  text?: string;
  imageUrl?: string;
  gifUrl?: string;
  timestamp: number;
  type: 'text' | 'image' | 'gif' | 'break';
  reactions?: { [emoji: string]: string[] };
  edited?: boolean;
  pinned?: boolean;
}

interface UserData {
  username: string;
  avatar: string;
  userId?: string;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  type: 'text' | 'voice' | 'whiteboard';
}

interface WhiteboardStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  lineWidth: number;
  tool: 'pen' | 'eraser';
  username: string;
  timestamp: number;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
}

interface CourseFile {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedBy: string;
  uploadedAt: number;
}

// Break sound (1 second)
const playBreakSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.0);
  } catch (e) {
    console.log('Audio notification failed:', e);
  }
};

// Notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio notification failed:', e);
  }
};

// GIPHY API Key
const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';

// Whiteboard Component
const Whiteboard: React.FC<{
  channelId: string;
  user: UserData;
  strokes: WhiteboardStroke[];
}> = ({ channelId, user, strokes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const colors = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Draw all strokes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set actual canvas size
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale context for high DPI displays
      ctx.scale(dpr, dpr);
      
      // Set display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Clear canvas
      ctx.fillStyle = '#1a1c1f';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw all strokes
      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;

        ctx.beginPath();
        ctx.strokeStyle = stroke.tool === 'eraser' ? '#1a1c1f' : stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      });
    };

    updateCanvas();

    const handleResize = () => {
      updateCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [strokes]);

  const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (point: { x: number; y: number }) => {
    setIsDrawing(true);
    lastPointRef.current = point;
    currentStrokeRef.current = [point];
  };

  const draw = (point: { x: number; y: number }) => {
    if (!isDrawing || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = currentTool === 'eraser' ? '#1a1c1f' : currentColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    currentStrokeRef.current.push(point);
    lastPointRef.current = point;
  };

  const stopDrawing = async () => {
    if (!isDrawing || currentStrokeRef.current.length === 0) return;

    setIsDrawing(false);

    // Save stroke to Firebase
    try {
      await addWhiteboardStroke(channelId, {
        points: [...currentStrokeRef.current],
        color: currentColor,
        lineWidth: lineWidth,
        tool: currentTool,
        username: user.username,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error saving stroke:', error);
    }

    currentStrokeRef.current = [];
    lastPointRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPointFromEvent(e);
    if (point) startDrawing(point);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPointFromEvent(e);
    if (point) draw(point);
  };

  const handleMouseUp = () => {
    stopDrawing();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getPointFromEvent(e);
    if (point) startDrawing(point);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getPointFromEvent(e);
    if (point) draw(point);
  };

  const handleTouchEnd = () => {
    stopDrawing();
  };

  const handleClear = async () => {
    if (confirm('Whiteboard\'u temizlemek istediğinize emin misiniz?')) {
      try {
        await clearWhiteboard(channelId);
      } catch (error) {
        console.error('Error clearing whiteboard:', error);
      }
    }
  };

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#1a1c1f]' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#2f3136] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTool('pen')}
            className={`p-2 rounded-lg transition-all ${currentTool === 'pen' ? 'bg-[#5865f2] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            title="Kalem"
          >
            <PenTool size={20} />
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded-lg transition-all ${currentTool === 'eraser' ? 'bg-[#5865f2] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            title="Silgi"
          >
            <Eraser size={20} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <div className="flex items-center gap-1">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  currentColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <div className="flex items-center gap-2">
            <Minus size={16} className="text-gray-400" />
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-24"
            />
            <Plus size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400 w-8 text-center">{lineWidth}px</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title={isFullscreen ? 'Küçült' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minus size={20} /> : <Maximize size={20} />}
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Temizle"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1c1f]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};

// GIPHY Search Component
const GiphyPicker: React.FC<{
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const searchGifs = async (query: string = 'trending') => {
    setIsLoading(true);
    try {
      const url = query === 'trending' || !query
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`;
      
      const response = await fetch(url);
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    searchGifs();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchGifs(searchTerm);
    } else {
      searchGifs('trending');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#36393f]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#2f3136] rounded-lg shadow-2xl w-full max-w-2xl h-[600px] flex flex-col border border-[#202225]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#202225]">
          <h2 className="text-lg font-bold text-white">GIF Seç</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 border-b border-[#202225]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="GIF ara..."
              className="flex-1 px-4 py-2 bg-[#202225] border border-[#202225] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] transition"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition"
            >
              Ara
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Yükleniyor...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => {
                    onSelect(gif.images.original.url);
                    onClose();
                  }}
                  className="cursor-pointer hover:opacity-80 transition rounded overflow-hidden"
                >
                  <img
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [notification, setNotification] = useState<{ username: string; text: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [showNewCourseInput, setShowNewCourseInput] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [newChannelType, setNewChannelType] = useState<'text' | 'whiteboard'>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseFileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const typingTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  // Subscribe to channels
  useEffect(() => {
    const unsubscribe = subscribeToChannels((firebaseChannels) => {
      setChannels(firebaseChannels);
      if (firebaseChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(firebaseChannels[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to courses
  useEffect(() => {
    const unsubscribe = subscribeToCourses((firebaseCourses) => {
      setCourses(firebaseCourses);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to course files
  useEffect(() => {
    if (!selectedCourse) {
      setCourseFiles([]);
      return;
    }
    const unsubscribe = subscribeToCourseFiles(selectedCourse, (files) => {
      setCourseFiles(files);
    });
    return () => unsubscribe();
  }, [selectedCourse]);

  // Subscribe to whiteboard strokes
  useEffect(() => {
    if (!selectedChannel) {
      setWhiteboardStrokes([]);
      return;
    }
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type !== 'whiteboard') {
      setWhiteboardStrokes([]);
      return;
    }

    const unsubscribe = subscribeToWhiteboard(selectedChannel, (strokes) => {
      setWhiteboardStrokes(strokes as WhiteboardStroke[]);
    });
    return () => unsubscribe();
  }, [selectedChannel, channels]);

  // Subscribe to Firebase messages
  useEffect(() => {
    if (!user || !selectedChannel) return;
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type === 'whiteboard') return; // Skip messages for whiteboard channels

    const unsubscribe = subscribeToMessages(selectedChannel, (firebaseMessages) => {
      const prevLength = prevMessagesLengthRef.current;
      setMessages(firebaseMessages);
      
      if (firebaseMessages.length > prevLength && prevLength > 0) {
        const lastMessage = firebaseMessages[firebaseMessages.length - 1];
        if (lastMessage.username !== user.username && notificationsEnabled) {
          if (lastMessage.type === 'break') {
            playBreakSound();
          } else {
            playNotificationSound();
          }
          
          const messageText = lastMessage.type === 'break' 
            ? '🚬 Sigara içme molası!' 
            : lastMessage.text || lastMessage.imageUrl ? '📷 Fotoğraf' : lastMessage.gifUrl ? '🎬 GIF' : '';
          setNotification({
            username: lastMessage.username,
            text: messageText || lastMessage.text || ''
          });
          
          setTimeout(() => {
            setNotification(null);
          }, 5000);
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(lastMessage.type === 'break' ? '🚬 Sigara içme molası!' : `Yeni mesaj: ${lastMessage.username}`, {
              body: messageText || lastMessage.text || '',
              icon: lastMessage.avatar
            });
          }
        }
      }
      
      prevMessagesLengthRef.current = firebaseMessages.length;
    });

    return () => unsubscribe();
  }, [user, selectedChannel, notificationsEnabled]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator
  useEffect(() => {
    if (!inputMessage.trim() || !user) {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(user?.username || '');
        return newSet;
      });
      return;
    }

    setTypingUsers(prev => {
      const newSet = new Set(prev);
      if (user) newSet.add(user.username);
      return newSet;
    });

    if (typingTimeoutRef.current[user?.username || '']) {
      clearTimeout(typingTimeoutRef.current[user?.username || '']);
    }

    if (user?.username) {
      typingTimeoutRef.current[user.username] = setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.username);
          return newSet;
        });
      }, 3000);
    }

    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout as ReturnType<typeof setTimeout>);
      });
    };
  }, [inputMessage, user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatar(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = () => {
    if (username.trim()) {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userData: UserData = {
        username: username.trim(),
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=5865f2&color=fff&size=128`,
        userId: userId
      };
      setUser(userData);
      saveUser(userId, { username: userData.username, avatar: userData.avatar });
      setUsername('');
      setAvatar('');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    try {
      await createChannel({
        name: newChannelName.trim(),
        createdBy: user.username,
        type: newChannelType
      });
      setNewChannelName('');
      setNewChannelType('text');
      setShowNewChannelInput(false);
    } catch (error) {
      console.error('Error creating channel:', error);
      alert('Kanal oluşturulurken bir hata oluştu.');
    }
  };

  const handleBreak = async () => {
    if (!user || !selectedChannel) return;
    try {
      await sendMessage(selectedChannel, {
        username: user.username,
        avatar: user.avatar,
        text: '🚬 Sigara içme molası!',
        timestamp: Date.now(),
        type: 'break'
      });
      playBreakSound();
    } catch (error) {
      console.error('Error sending break message:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user || !selectedChannel) return;
    setIsLoading(true);
    try {
      const imageUrl = await uploadImage(file);
      await sendMessage(selectedChannel, {
        username: user.username,
        avatar: user.avatar,
        imageUrl: imageUrl,
        timestamp: Date.now(),
        type: 'image'
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Fotoğraf yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGifSelect = async (gifUrl: string) => {
    if (!user || !selectedChannel) return;
    setIsLoading(true);
    try {
      await sendMessage(selectedChannel, {
        username: user.username,
        avatar: user.avatar,
        gifUrl: gifUrl,
        timestamp: Date.now(),
        type: 'gif'
      });
    } catch (error) {
      console.error('Error sending GIF:', error);
      alert('GIF gönderilirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() && user && selectedChannel) {
      setIsLoading(true);
      try {
        await sendMessage(selectedChannel, {
          username: user.username,
          avatar: user.avatar,
          text: inputMessage.trim(),
          timestamp: Date.now(),
          type: 'text'
        });
        setInputMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseName.trim() || !user) return;
    try {
      await createCourse({
        name: newCourseName.trim(),
        createdBy: user.username
      });
      setNewCourseName('');
      setShowNewCourseInput(false);
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Ders oluşturulurken bir hata oluştu.');
    }
  };

  const handleCourseFileUpload = async (file: File) => {
    if (!selectedCourse || !user) return;
    setIsLoading(true);
    try {
      const fileUrl = await uploadFile(file, `courses/${selectedCourse}`);
      await addFileToCourse(selectedCourse, {
        name: file.name,
        url: fileUrl,
        type: file.type,
        uploadedBy: user.username
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Dosya yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!selectedChannel) return;
    if (confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz?')) {
      try {
        await clearAllMessages(selectedChannel);
        setMessages([]);
      } catch (error) {
        console.error('Error clearing messages:', error);
        alert('Mesajlar silinirken bir hata oluştu.');
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    setAvatar('');
  };

  // Get unique users from messages
  const uniqueUsers = Array.from(
    new Map(messages.map(msg => [msg.username, { username: msg.username, avatar: msg.avatar }])).values()
  ).filter((u) => (u as { username: string; avatar: string }).username !== user?.username) as Array<{ username: string; avatar: string }>;

  // Filter messages by search
  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg => 
        msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // If user not logged in, show inline login
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1c1f] via-[#2f3136] to-[#36393f] p-4">
        <div className="w-full max-w-md modern-card rounded-xl p-8 border border-white/10 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-[#5865f2]/20 to-[#eb459e]/20 mb-4">
              <MessageSquare size={48} className="text-white" />
            </div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-[#5865f2] to-[#eb459e] bg-clip-text text-transparent mb-2">
              Kutuphane Chat
            </h2>
            <p className="text-gray-400">Kütüphane sohbet platformuna hoş geldiniz</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Kullanıcı adınızı girin"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Profil Fotoğrafı (Opsiyonel)
              </label>
              <div className="flex items-center gap-4">
                {avatar && (
                  <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover ring-2 ring-white/10" />
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-4 py-2 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg transition-all hover:scale-105"
                >
                  <ImageIcon size={20} className="inline mr-2" />
                  Fotoğraf Seç
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={!username.trim()}
              className="w-full bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5865f2]/30 hover:scale-105"
            >
              Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex bg-gradient-to-br ${darkMode ? 'from-[#1a1c1f] via-[#2f3136] to-[#36393f]' : 'from-gray-50 to-gray-100'} text-white overflow-hidden relative`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Left Sidebar - Channels */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-0'} modern-card flex flex-col transition-all duration-300 overflow-hidden md:flex relative z-10`}>
        <div className="h-14 border-b border-white/10 flex items-center px-4 flex-shrink-0 bg-gradient-to-r from-[#5865f2]/20 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#5865f2] to-[#eb459e] animate-glow">
              <Hash size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">Kutuphane Chat</span>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
              Kanallar
            </div>
            <button
              onClick={() => setShowNewChannelInput(!showNewChannelInput)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
            >
              <Plus size={16} />
            </button>
          </div>
          {showNewChannelInput && (
            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                placeholder="Kanal adı"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewChannelType('text')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    newChannelType === 'text'
                      ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white shadow-lg shadow-[#5865f2]/30'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <Hash size={14} className="inline mr-1" />
                  Metin
                </button>
                <button
                  onClick={() => setNewChannelType('whiteboard')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    newChannelType === 'whiteboard'
                      ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white shadow-lg shadow-[#5865f2]/30'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <PenTool size={14} className="inline mr-1" />
                  Whiteboard
                </button>
              </div>
              <button
                onClick={handleCreateChannel}
                className="w-full px-4 py-2 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg text-sm font-semibold transition-all hover:scale-105 shadow-lg shadow-[#5865f2]/30"
              >
                Ekle
              </button>
            </div>
          )}
          <div className="space-y-1">
            {channels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all hover-glow ${
                  selectedChannel === channel.id 
                    ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] shadow-lg shadow-[#5865f2]/30' 
                    : 'hover:bg-white/5'
                }`}
              >
                {channel.type === 'text' ? (
                  <Hash size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                ) : channel.type === 'whiteboard' ? (
                  <PenTool size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                ) : (
                  <Volume2 size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                )}
                <span className={`text-sm truncate font-medium ${selectedChannel === channel.id ? 'text-white' : 'text-gray-300'}`}>
                  {channel.name}
                </span>
              </div>
            ))}
          </div>

          {/* Users List */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="px-2 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
              Online — {uniqueUsers.length + 1}
            </div>
            <div className="space-y-1.5">
              {uniqueUsers.map((u, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all group hover-glow"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity"></div>
                    <img src={u.avatar} alt={u.username} className="w-9 h-9 rounded-full relative z-10 ring-2 ring-white/10 group-hover:ring-[#5865f2]/50 transition-all" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2f3136] shadow-lg shadow-green-500/50"></div>
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white font-medium transition truncate">
                    {u.username}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-[#5865f2]/20 to-[#eb459e]/20 border border-[#5865f2]/30 mt-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-30"></div>
                  <img src={user.avatar} alt={user.username} className="w-9 h-9 rounded-full relative z-10 ring-2 ring-[#5865f2]/50" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2f3136] shadow-lg shadow-green-500/50"></div>
                </div>
                <span className="text-sm text-white font-bold truncate">{user.username}</span>
              </div>
            </div>
          </div>

          {/* Courses Section */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
                Dersler
              </div>
              <button
                onClick={() => setShowNewCourseInput(!showNewCourseInput)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
              >
                <Plus size={16} />
              </button>
            </div>
            {showNewCourseInput && (
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCourse()}
                  placeholder="Ders adı"
                  className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm"
                />
                <button
                  onClick={handleCreateCourse}
                  className="px-4 py-2 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg text-sm font-semibold transition-all hover:scale-105 shadow-lg shadow-[#5865f2]/30"
                >
                  Ekle
                </button>
              </div>
            )}
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => setSelectedCourse(course.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all hover-glow ${
                    selectedCourse === course.id 
                      ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] shadow-lg shadow-[#5865f2]/30' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <BookOpen size={16} className={selectedCourse === course.id ? 'text-white' : 'text-gray-400'} />
                  <span className={`text-sm truncate font-medium ${selectedCourse === course.id ? 'text-white' : 'text-gray-300'}`}>
                    {course.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Footer */}
        <div className="h-16 bg-gradient-to-t from-black/40 to-transparent border-t border-white/10 flex items-center justify-between px-3 flex-shrink-0 backdrop-blur-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-30"></div>
              <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full flex-shrink-0 relative z-10 ring-2 ring-white/10" />
            </div>
            <span className="text-sm font-bold text-white truncate">{user.username}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
              title={darkMode ? 'Açık Tema' : 'Koyu Tema'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
              title={notificationsEnabled ? 'Bildirimleri Kapat' : 'Bildirimleri Aç'}
            >
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <button
              onClick={handleClearChat}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all hover:scale-110"
              title="Sohbeti Temizle"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
              title="Çıkış"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Courses & Files */}
      {selectedCourse && (
        <div className="w-64 modern-card border-l border-white/10 flex flex-col md:flex relative z-10">
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0 bg-gradient-to-r from-[#5865f2]/20 to-transparent">
            <span className="font-bold text-white text-sm truncate">
              {courses.find(c => c.id === selectedCourse)?.name}
            </span>
            <button
              onClick={() => setSelectedCourse(null)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all hover:scale-110"
              title="Kapat"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <button
              onClick={() => courseFileInputRef.current?.click()}
              className="w-full mb-4 px-4 py-2 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg text-sm font-semibold transition-all hover:scale-105 shadow-lg shadow-[#5865f2]/30 flex items-center justify-center gap-2"
            >
              <FileText size={16} />
              PDF/Dosya Yükle
            </button>
            <input
              ref={courseFileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCourseFileUpload(file);
              }}
              className="hidden"
            />
            <div className="space-y-2">
              {courseFiles.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all hover-glow"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate font-medium">{file.name}</div>
                      <div className="text-xs text-gray-400">{file.uploadedBy}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-[#36393f]/50 to-[#2f3136]/50 backdrop-blur-sm min-w-0 relative z-10">
        {/* Mobile Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 glass-effect md:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-all hover:scale-110"
          >
            <Hash size={20} />
          </button>
          <span className="font-bold text-white tracking-wide">
            {channels.find(c => c.id === selectedChannel)?.name || 'Kanal Seç'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="text-gray-400 hover:text-white transition-all"
            >
              <Search size={20} />
            </button>
            {selectedCourse && (
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-gray-400 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Channel Header */}
        {selectedChannel && (
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 glass-effect flex-shrink-0 hidden md:flex">
            <div className="flex items-center gap-3">
              <Hash size={20} className="text-gray-400" />
              <span className="font-bold text-white text-lg">
                {channels.find(c => c.id === selectedChannel)?.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                title="Ara"
              >
                <Search size={18} />
              </button>
              <button
                onClick={handleClearChat}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Sohbeti Temizle"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 py-3 border-b border-white/10 glass-effect flex-shrink-0">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mesajlarda ara..."
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm text-sm"
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-2 text-gray-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Messages Area / Whiteboard */}
        {selectedChannel && channels.find(c => c.id === selectedChannel)?.type === 'whiteboard' ? (
          user ? (
            <Whiteboard
              channelId={selectedChannel}
              user={user}
              strokes={whiteboardStrokes}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-300 mb-2">Giriş Yapın</p>
                <p className="text-sm text-gray-500">Whiteboard kullanmak için giriş yapmalısınız</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
            {!selectedChannel ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-[#5865f2]/20 to-[#eb459e]/20 mb-4">
                    <Hash size={48} className="text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-gray-300 mb-2">Kanal Seç</p>
                  <p className="text-sm text-gray-500">Bir kanal seçin veya yeni kanal oluşturun</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-[#5865f2]/20 to-[#eb459e]/20 mb-4">
                  <MessageSquare size={48} className="text-gray-400" />
                </div>
                <p className="text-xl font-bold text-gray-300 mb-2">Henüz mesaj yok</p>
                <p className="text-sm text-gray-500">İlk mesajınızı göndererek sohbete başlayın!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 group hover:bg-white/5 px-4 py-2 -mx-4 rounded-xl transition-all ${
                    msg.username === user?.username ? 'bg-[#5865f2]/10' : ''
                  } ${msg.type === 'break' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-500 shadow-lg shadow-yellow-500/20' : ''}`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-0 group-hover:opacity-30 transition-opacity"></div>
                    <img
                      src={msg.avatar}
                      alt={msg.username}
                      className="w-11 h-11 rounded-full flex-shrink-0 cursor-pointer ring-2 ring-white/10 group-hover:ring-[#5865f2]/50 transition-all relative z-10"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2.5 mb-1.5">
                      <span className={`font-bold text-sm ${
                        msg.username === user?.username 
                          ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] bg-clip-text text-transparent' 
                          : 'text-white'
                      }`}>
                        {msg.username === user?.username ? 'Sen' : msg.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {msg.edited && (
                        <span className="text-xs text-gray-500 italic">(düzenlendi)</span>
                      )}
                      {msg.pinned && (
                        <Pin size={12} className="text-yellow-400" />
                      )}
                    </div>
                    {msg.type === 'image' && msg.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          className="max-w-full md:max-w-md rounded-lg cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                        />
                      </div>
                    )}
                    {msg.type === 'gif' && msg.gifUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.gifUrl}
                          alt="GIF"
                          className="max-w-full md:max-w-md rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                    {msg.text && (
                      <div className="text-gray-300 text-sm break-words">{msg.text}</div>
                    )}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                          const userList = Array.isArray(users) ? users : [];
                          return (
                            <button
                              key={emoji}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded flex items-center gap-1 text-xs transition"
                            >
                              <span>{emoji}</span>
                              <span className="text-gray-400">{userList.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="px-4 py-2 text-sm text-gray-400 italic">
              {Array.from(typingUsers).join(', ')} yazıyor...
            </div>
          )}
          </div>
        )}

        {/* Input Area */}
        {selectedChannel && channels.find(c => c.id === selectedChannel)?.type !== 'whiteboard' && (
          <div className="p-3 md:p-4 glass-effect border-t border-white/10 flex-shrink-0">
            <div className="flex gap-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-50 hover:scale-110"
                  title="Fotoğraf Yükle"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  onClick={() => setShowGiphyPicker(true)}
                  disabled={isLoading}
                  className="px-3 py-2 text-xs font-bold rounded-lg transition disabled:opacity-50 relative overflow-hidden group border border-white/10 hover:border-white/20"
                  title="GIF Gönder"
                >
                  <span 
                    className="relative z-10 bg-gradient-to-r from-pink-500 via-purple-500 via-blue-500 to-green-500 bg-clip-text text-transparent"
                    style={{
                      backgroundSize: '200% 200%',
                      animation: 'rainbow 3s ease infinite'
                    }}
                  >
                    GIF
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 via-blue-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                </button>
                <button
                  onClick={handleBreak}
                  disabled={isLoading}
                  className="px-3 py-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-all disabled:opacity-50 hover:scale-110 font-semibold text-xs flex items-center gap-1.5 border border-orange-500/30 hover:border-orange-500/50"
                  title="Sigara İçme Molası"
                >
                  <Cigarette size={16} />
                  <span className="hidden md:inline">Mola</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="hidden"
                />
              </div>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder={`#${channels.find(c => c.id === selectedChannel)?.name || 'kanal'} kanalında mesaj gönder`}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition disabled:opacity-50 text-sm md:text-base backdrop-blur-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-5 md:px-6 py-2.5 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-[#5865f2]/30 hover:scale-105 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 modern-card border border-white/10 rounded-lg shadow-2xl p-4 max-w-sm z-50 animate-slideIn">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center flex-shrink-0">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white mb-1">Yeni Mesaj</div>
              <div className="text-sm text-gray-400 mb-1">{notification.username}</div>
              <div className="text-sm text-gray-300 truncate">{notification.text}</div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* GIPHY Picker */}
      {showGiphyPicker && (
        <GiphyPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGiphyPicker(false)}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes rainbow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(88, 101, 242, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(88, 101, 242, 0.8), 0 0 30px rgba(88, 101, 242, 0.6);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .glass-effect {
          background: rgba(47, 49, 54, 0.8);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .modern-card {
          background: linear-gradient(135deg, rgba(47, 49, 54, 0.9) 0%, rgba(54, 57, 63, 0.9) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .hover-glow:hover {
          box-shadow: 0 0 15px rgba(88, 101, 242, 0.4);
          transform: translateY(-2px);
          transition: all 0.3s ease;
        }
        @media (max-width: 768px) {
          .md\\:flex {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
