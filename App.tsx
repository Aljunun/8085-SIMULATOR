import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Image as ImageIcon, Trash2, Sparkles, LogOut, MessageSquare } from 'lucide-react';
import { sendMessage, subscribeToMessages, clearAllMessages, saveUser } from './services/firebase';

interface Message {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
}

interface UserData {
  username: string;
  avatar: string;
  userId?: string;
}

// Floating particles component
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-xl"
          style={{
            width: Math.random() * 200 + 50,
            height: Math.random() * 200 + 50,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${15 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to Firebase messages
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToMessages((firebaseMessages) => {
      setMessages(firebaseMessages);
    });

    return () => {
      // Cleanup is handled by Firebase automatically
    };
  }, [user]);

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
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=random&color=fff&size=128`,
        userId: userId
      };
      setUser(userData);
      // Save user to Firebase
      saveUser(userId, { username: userData.username, avatar: userData.avatar });
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
          timestamp: Date.now()
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
    setUsername('');
    setAvatar('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <FloatingParticles />
        <style>{`
          @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
            50% { transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) scale(1.2); opacity: 0.6; }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2); }
            50% { box-shadow: 0 0 30px rgba(168, 85, 247, 0.6), 0 0 60px rgba(168, 85, 247, 0.4); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        
        <div className="relative z-10 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20 animate-slideIn" style={{animation: 'slideIn 0.6s ease-out'}}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 mb-4 animate-glow">
              <MessageSquare size={40} className="text-white" />
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2 animate-pulse">
              Kutuphane Chat
            </h1>
            <p className="text-gray-300 text-lg">Kütüphane sohbetine hoş geldiniz!</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <User size={16} />
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Kullanıcı adınızı girin"
                className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <ImageIcon size={16} />
                Profil Fotoğrafı (Opsiyonel)
              </label>
              <div className="flex items-center gap-4">
                {avatar && (
                  <div className="relative">
                    <img
                      src={avatar}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-4 border-purple-500/50 shadow-lg shadow-purple-500/50"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/20 to-pink-500/20"></div>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-white/20 rounded-xl transition-all text-white font-medium backdrop-blur-sm"
                >
                  <ImageIcon size={20} />
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
              onClick={handleLogin}
              disabled={!username.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/70 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Sohbete Başla
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <FloatingParticles />
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) scale(1.2); opacity: 0.6; }
        }
        @keyframes messageSlide {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>

      {/* Header */}
      <div className="relative z-10 bg-white/10 backdrop-blur-xl shadow-2xl border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
            <MessageSquare size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Kutuphane Chat
            </h1>
            <p className="text-xs text-gray-400">Kütüphane sohbet platformu</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-500/50 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
            </div>
            <span className="font-semibold text-white">{user.username}</span>
          </div>
          <button
            onClick={handleClearChat}
            className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all backdrop-blur-sm border border-transparent hover:border-red-500/50"
            title="Sohbeti Temizle"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-white hover:text-pink-400 hover:bg-pink-500/20 rounded-xl transition-all backdrop-blur-sm border border-white/20 hover:border-pink-500/50 flex items-center gap-2 font-medium"
          >
            <LogOut size={16} />
            Çıkış
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-0">
        <style>{`
          .message-enter {
            animation: messageSlide 0.3s ease-out;
          }
        `}</style>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400 bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <MessageSquare size={40} className="text-gray-500" />
              </div>
              <p className="text-xl font-semibold text-gray-300">Henüz mesaj yok</p>
              <p className="text-sm mt-2 text-gray-500">İlk mesajınızı göndererek sohbete başlayın!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex gap-3 message-enter ${msg.username === user.username ? 'justify-end' : 'justify-start'}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {msg.username !== user.username && (
                <div className="relative">
                  <img
                    src={msg.avatar}
                    alt={msg.username}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-500/50 shadow-lg"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-md px-5 py-3 rounded-2xl backdrop-blur-xl border ${
                  msg.username === user.username
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none border-purple-500/50 shadow-lg shadow-purple-500/30'
                    : 'bg-white/10 text-gray-100 rounded-bl-none border-white/20 shadow-lg'
                }`}
              >
                <div className={`text-xs font-bold mb-1.5 opacity-90 ${
                  msg.username === user.username ? 'text-purple-100' : 'text-purple-300'
                }`}>
                  {msg.username === user.username ? 'Sen' : msg.username}
                </div>
                <div className="break-words text-sm leading-relaxed">{msg.text}</div>
                <div
                  className={`text-xs mt-2 ${
                    msg.username === user.username ? 'text-purple-100' : 'text-gray-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              {msg.username === user.username && (
                <div className="relative">
                  <img
                    src={msg.avatar}
                    alt={msg.username}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-500/50 shadow-lg"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative z-10 bg-white/10 backdrop-blur-xl border-t border-white/20 p-4 shadow-2xl">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
            placeholder="Mesajınızı yazın..."
            disabled={isLoading}
            className="flex-1 px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-white placeholder-gray-400 font-medium disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl font-bold hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/70 transform hover:scale-105 active:scale-95"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send size={20} />
            )}
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
