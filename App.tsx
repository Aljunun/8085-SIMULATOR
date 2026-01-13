import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Image as ImageIcon, Trash2, LogOut, MessageSquare, X, Hash, Smile, Paperclip, Cigarette, BookOpen, FileText, Plus } from 'lucide-react';
import { sendMessage, subscribeToMessages, clearAllMessages, saveUser, uploadImage, uploadFile, createCourse, subscribeToCourses, addFileToCourse, subscribeToCourseFiles } from './services/firebase';

interface Message {
  id: string;
  username: string;
  avatar: string;
  text?: string;
  imageUrl?: string;
  gifUrl?: string;
  timestamp: number;
  type: 'text' | 'image' | 'gif' | 'break';
}

interface UserData {
  username: string;
  avatar: string;
  userId?: string;
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
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [notification, setNotification] = useState<{ username: string; text: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [showNewCourseInput, setShowNewCourseInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseFileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);

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

  // Subscribe to Firebase messages
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToMessages((firebaseMessages) => {
      const prevLength = prevMessagesLengthRef.current;
      setMessages(firebaseMessages);
      
      // Check if new message arrived from another user
      if (firebaseMessages.length > prevLength && prevLength > 0) {
        const lastMessage = firebaseMessages[firebaseMessages.length - 1];
        if (lastMessage.username !== user.username) {
          // Play sound
          if (lastMessage.type === 'break') {
            playBreakSound();
          } else {
            playNotificationSound();
          }
          
          // Show notification
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
  }, [user]);

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

  const handleBreak = async () => {
    if (!user) return;
    try {
      await sendMessage({
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
    if (!user) return;
    setIsLoading(true);
    try {
      const imageUrl = await uploadImage(file);
      await sendMessage({
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
    if (!user) return;
    setIsLoading(true);
    try {
      await sendMessage({
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
    if (inputMessage.trim() && user) {
      setIsLoading(true);
      try {
        await sendMessage({
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
    if (confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz?')) {
      try {
        await clearAllMessages();
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
  ).filter(u => u.username !== user?.username);

  // If user not logged in, show inline login
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#36393f] p-4">
        <div className="w-full max-w-md bg-[#2f3136] rounded-lg p-6 border border-[#202225]">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Kutuphane Chat</h2>
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
                className="w-full px-4 py-3 bg-[#202225] border border-[#202225] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Profil Fotoğrafı (Opsiyonel)
              </label>
              <div className="flex items-center gap-4">
                {avatar && (
                  <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition"
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
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white py-3 rounded font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed transition"
            >
              Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#36393f] text-white overflow-hidden">
      {/* Left Sidebar */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-0'} bg-[#2f3136] flex flex-col transition-all duration-300 overflow-hidden md:flex`}>
        <div className="h-12 border-b border-[#202225] flex items-center px-4 bg-[#2f3136] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-gray-400" />
            <span className="font-semibold text-white">Kutuphane Chat</span>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
            Online — {uniqueUsers.length + 1}
          </div>
          <div className="space-y-1">
            {uniqueUsers.map((u, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#393c43] cursor-pointer transition group"
              >
                <div className="relative">
                  <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2f3136]"></div>
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition truncate">
                  {u.username}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-2 py-1.5 rounded bg-[#393c43] mt-2">
              <div className="relative">
                <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2f3136]"></div>
              </div>
              <span className="text-sm text-white font-medium truncate">{user.username}</span>
            </div>
          </div>
        </div>

        {/* Courses Section */}
        <div className="border-t border-[#202225] p-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Dersler</div>
            <button
              onClick={() => setShowNewCourseInput(!showNewCourseInput)}
              className="p-1 text-gray-400 hover:text-white hover:bg-[#393c43] rounded transition"
            >
              <Plus size={16} />
            </button>
          </div>
          {showNewCourseInput && (
            <div className="mb-2 flex gap-1">
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateCourse()}
                placeholder="Ders adı"
                className="flex-1 px-2 py-1 text-sm bg-[#202225] border border-[#202225] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2] transition"
              />
              <button
                onClick={handleCreateCourse}
                className="px-2 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm transition"
              >
                Ekle
              </button>
            </div>
          )}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => setSelectedCourse(course.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
                  selectedCourse === course.id ? 'bg-[#5865f2]' : 'hover:bg-[#393c43]'
                }`}
              >
                <BookOpen size={16} className="text-gray-400" />
                <span className="text-sm text-gray-300 truncate">{course.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="h-14 bg-[#292b2f] border-t border-[#202225] flex items-center justify-between px-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full flex-shrink-0" />
            <span className="text-sm font-medium text-white truncate">{user.username}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleClearChat}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#393c43] rounded transition"
              title="Sohbeti Temizle"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#393c43] rounded transition"
              title="Çıkış"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Courses & Files */}
      {selectedCourse && (
        <div className="w-64 bg-[#2f3136] border-l border-[#202225] flex flex-col md:flex">
          <div className="h-12 border-b border-[#202225] flex items-center justify-between px-4 flex-shrink-0">
            <span className="font-semibold text-white text-sm truncate">
              {courses.find(c => c.id === selectedCourse)?.name}
            </span>
            <button
              onClick={() => setSelectedCourse(null)}
              className="text-gray-400 hover:text-white transition md:hidden"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <button
              onClick={() => courseFileInputRef.current?.click()}
              className="w-full mb-4 px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition flex items-center justify-center gap-2"
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
                  className="block p-3 bg-[#202225] rounded hover:bg-[#393c43] transition"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{file.name}</div>
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
      <div className="flex-1 flex flex-col bg-[#36393f] min-w-0">
        {/* Mobile Header */}
        <div className="h-12 border-b border-[#202225] flex items-center justify-between px-4 bg-[#36393f] md:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            <Hash size={20} />
          </button>
          <span className="font-semibold text-white">Kutuphane Chat</span>
          {selectedCourse && (
            <button
              onClick={() => setSelectedCourse(null)}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={64} className="text-gray-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-400">Henüz mesaj yok</p>
                <p className="text-sm text-gray-500 mt-2">İlk mesajınızı göndererek sohbete başlayın!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 group hover:bg-[#32353b] px-4 py-1 -mx-4 rounded transition ${
                    msg.username === user?.username ? 'bg-[#32353b]/50' : ''
                  } ${msg.type === 'break' ? 'bg-yellow-500/10 border-l-4 border-yellow-500' : ''}`}
                >
                  <img
                    src={msg.avatar}
                    alt={msg.username}
                    className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 ring-[#5865f2] transition"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`font-semibold text-sm ${
                        msg.username === user?.username ? 'text-[#5865f2]' : 'text-white'
                      }`}>
                        {msg.username === user?.username ? 'Sen' : msg.username}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
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
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-2 md:p-4 bg-[#36393f] border-t border-[#202225] flex-shrink-0">
          <div className="flex gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#40444b] rounded transition disabled:opacity-50"
                title="Fotoğraf Yükle"
              >
                <Paperclip size={18} />
              </button>
              <button
                onClick={() => setShowGiphyPicker(true)}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#40444b] rounded transition disabled:opacity-50"
                title="GIF Gönder"
              >
                <Smile size={18} />
              </button>
              <button
                onClick={handleBreak}
                disabled={isLoading}
                className="p-2 text-orange-400 hover:text-orange-300 hover:bg-[#40444b] rounded transition disabled:opacity-50"
                title="Sigara İçme Molası"
              >
                <Cigarette size={18} />
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
              placeholder="Mesaj gönder..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#40444b] border border-[#202225] rounded text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition disabled:opacity-50 text-sm md:text-base"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 md:px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded font-medium disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-[#2f3136] border border-[#202225] rounded-lg shadow-2xl p-4 max-w-sm z-50 animate-slideIn">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center flex-shrink-0">
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
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
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
