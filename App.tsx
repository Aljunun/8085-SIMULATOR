import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Image as ImageIcon, Trash2, LogOut, MessageSquare, X, Hash, Smile, Paperclip } from 'lucide-react';
import { sendMessage, subscribeToMessages, clearAllMessages, saveUser, uploadImage } from './services/firebase';

interface Message {
  id: string;
  username: string;
  avatar: string;
  text?: string;
  imageUrl?: string;
  gifUrl?: string;
  timestamp: number;
  type: 'text' | 'image' | 'gif';
}

interface UserData {
  username: string;
  avatar: string;
  userId?: string;
}

// Notification sound (using Web Audio API)
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

// GIPHY API Key (public beta key - replace with your own)
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

// Login Modal Component
const LoginModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, avatar: string) => void;
}> = ({ isOpen, onClose, onLogin }) => {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = () => {
    if (username.trim()) {
      onLogin(username.trim(), avatar);
      setUsername('');
      setAvatar('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#36393f]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#36393f] rounded-lg shadow-2xl w-full max-w-md border border-[#202225]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-[#202225]">
          <h2 className="text-xl font-bold text-white">Kutuphane Chat'e Hoş Geldiniz</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
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
                <img
                  src={avatar}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover"
                />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition"
              >
                <ImageIcon size={20} className="inline mr-2" />
                Fotoğraf Seç
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!username.trim()}
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white py-3 rounded font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed transition"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [notification, setNotification] = useState<{ username: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);

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
          playNotificationSound();
          
          // Show notification
          const messageText = lastMessage.text || lastMessage.imageUrl ? '📷 Fotoğraf' : lastMessage.gifUrl ? '🎬 GIF' : '';
          setNotification({
            username: lastMessage.username,
            text: messageText || lastMessage.text || ''
          });
          
          // Auto hide notification after 5 seconds
          setTimeout(() => {
            setNotification(null);
          }, 5000);
          
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Yeni mesaj: ${lastMessage.username}`, {
              body: messageText || lastMessage.text || '',
              icon: lastMessage.avatar
            });
          }
        }
      }
      
      prevMessagesLengthRef.current = firebaseMessages.length;
    });

    return () => {
      // Cleanup
    };
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

  // Check if user needs to login
  useEffect(() => {
    if (!user) {
      setShowLoginModal(true);
    }
  }, [user]);

  const handleLogin = (username: string, avatar: string) => {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userData: UserData = {
      username: username,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5865f2&color=fff&size=128`,
      userId: userId
    };
    setUser(userData);
    saveUser(userId, { username: userData.username, avatar: userData.avatar });
    setShowLoginModal(false);
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
    setShowLoginModal(true);
  };

  // Get unique users from messages (excluding current user from list, show separately)
  const uniqueUsers = Array.from(
    new Map(messages.map(msg => [msg.username, { username: msg.username, avatar: msg.avatar }])).values()
  ).filter(u => u.username !== user?.username);

  return (
    <div className="h-screen flex bg-[#36393f] text-white overflow-hidden">
      {/* Left Sidebar - Discord style */}
      <div className="w-60 bg-[#2f3136] flex flex-col">
        {/* Server/Channel Header */}
        <div className="h-12 border-b border-[#202225] flex items-center px-4 bg-[#2f3136]">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-gray-400" />
            <span className="font-semibold text-white">Kutuphane Chat</span>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
            Online — {uniqueUsers.length + (user ? 1 : 0)}
          </div>
          <div className="space-y-1">
            {uniqueUsers.map((u, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#393c43] cursor-pointer transition group"
              >
                <div className="relative">
                  <img
                    src={u.avatar}
                    alt={u.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2f3136]"></div>
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition">
                  {u.username}
                </span>
              </div>
            ))}
            {user && (
              <div className="flex items-center gap-3 px-2 py-1.5 rounded bg-[#393c43] mt-2">
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2f3136]"></div>
                </div>
                <span className="text-sm text-white font-medium">{user.username}</span>
              </div>
            )}
          </div>
        </div>

        {/* User Info Footer */}
        {user && (
          <div className="h-14 bg-[#292b2f] border-t border-[#202225] flex items-center justify-between px-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
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
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
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
                  }`}
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
                          className="max-w-md rounded-lg cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                        />
                      </div>
                    )}
                    {msg.type === 'gif' && msg.gifUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.gifUrl}
                          alt="GIF"
                          className="max-w-md rounded-lg cursor-pointer"
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
        <div className="p-4 bg-[#36393f] border-t border-[#202225]">
          <div className="flex gap-2 max-w-4xl">
            <div className="flex gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !user}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#40444b] rounded transition disabled:opacity-50"
                title="Fotoğraf Yükle"
              >
                <Paperclip size={20} />
              </button>
              <button
                onClick={() => setShowGiphyPicker(true)}
                disabled={isLoading || !user}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#40444b] rounded transition disabled:opacity-50"
                title="GIF Gönder"
              >
                <Smile size={20} />
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
              placeholder={`#Kutuphane Chat'te mesaj gönder`}
              disabled={isLoading || !user}
              className="flex-1 px-4 py-2.5 bg-[#40444b] border border-[#202225] rounded text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !user}
              className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded font-medium disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal && !user}
        onClose={() => {}}
        onLogin={handleLogin}
      />

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
      `}</style>
    </div>
  );
};

export default App;
