import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Image as ImageIcon, Trash2 } from 'lucide-react';

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
}

// Cookie utilities
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user data and messages from cookies on mount
  useEffect(() => {
    const savedUser = getCookie('kutuphane_user');
    const savedMessages = getCookie('kutuphane_messages');
    
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setUsername(userData.username);
        setAvatar(userData.avatar);
      } catch (e) {
        console.error('Error loading user data:', e);
      }
    }
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (e) {
        console.error('Error loading messages:', e);
      }
    }
  }, []);

  // Save messages to cookies whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      setCookie('kutuphane_messages', JSON.stringify(messages));
    }
  }, [messages]);

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
      const userData: UserData = {
        username: username.trim(),
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=random&color=fff&size=128`
      };
      setUser(userData);
      setCookie('kutuphane_user', JSON.stringify(userData));
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && user) {
      const newMessage: Message = {
        id: Date.now().toString(),
        username: user.username,
        avatar: user.avatar,
        text: inputMessage.trim(),
        timestamp: Date.now()
      };
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      setInputMessage('');
    }
  };

  const handleClearChat = () => {
    if (confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz?')) {
      setMessages([]);
      deleteCookie('kutuphane_messages');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    setAvatar('');
    deleteCookie('kutuphane_user');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-600 mb-2">📚 Kutuphane Chat</h1>
            <p className="text-gray-600">Kütüphane sohbetine hoş geldiniz!</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Kullanıcı adınızı girin"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profil Fotoğrafı (Opsiyonel)
              </label>
              <div className="flex items-center gap-4">
                {avatar && (
                  <img
                    src={avatar}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
                  />
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
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
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
            >
              Sohbete Başla
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-indigo-600">📚 Kutuphane Chat</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src={user.avatar}
              alt={user.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500"
            />
            <span className="font-medium text-gray-700">{user.username}</span>
          </div>
          <button
            onClick={handleClearChat}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            title="Sohbeti Temizle"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="text-lg">Henüz mesaj yok</p>
              <p className="text-sm mt-2">İlk mesajınızı göndererek sohbete başlayın!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.username === user.username ? 'justify-end' : 'justify-start'}`}
            >
              {msg.username !== user.username && (
                <img
                  src={msg.avatar}
                  alt={msg.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.username === user.username
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.username !== user.username && (
                  <div className="text-xs font-semibold mb-1 opacity-80">{msg.username}</div>
                )}
                <div className="break-words">{msg.text}</div>
                <div
                  className={`text-xs mt-1 ${
                    msg.username === user.username ? 'text-indigo-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              {msg.username === user.username && (
                <img
                  src={msg.avatar}
                  alt={msg.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Mesajınızı yazın..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Send size={20} />
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
