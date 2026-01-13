import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, User, Image as ImageIcon, Trash2, LogOut, MessageSquare, X, Hash, Smile, Paperclip, Cigarette, BookOpen, FileText, Plus, Volume2, Settings, Search, Pin, Edit2, Heart, ThumbsUp, Laugh, Star, Moon, Sun, Bell, BellOff, Users, Crown, PenTool, Eraser, Palette, Minus, Maximize, Mail, Lock, Coffee, ChevronDown } from 'lucide-react';
import { sendMessage, subscribeToMessages, clearAllMessages, saveUser, uploadImage, uploadFile, createCourse, subscribeToCourses, addFileToCourse, subscribeToCourseFiles, createChannel, subscribeToChannels, addWhiteboardStroke, subscribeToWhiteboard, clearWhiteboard, signUp, signIn, logOut, onAuthChange, getUserProfile, updateUserProfile, addReaction, addPdfStroke, subscribeToPdfDrawings, db, loadMoreMessages } from './services/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  mentions?: string[];
  edited?: boolean;
  pinned?: boolean;
}

interface UserData {
  username: string;
  avatar: string;
  userId: string;
  email?: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [visibleStrokes, setVisibleStrokes] = useState<WhiteboardStroke[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const colors = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Calculate viewport and filter visible strokes
  useEffect(() => {
    if (!containerRef.current || strokes.length === 0) {
      setVisibleStrokes(strokes);
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate viewport in world coordinates
    const viewport = {
      minX: -offset.x / scale,
      maxX: (-offset.x + rect.width) / scale,
      minY: -offset.y / scale,
      maxY: (-offset.y + rect.height) / scale
    };

    // Filter strokes that are visible in viewport (with some padding)
    const padding = 200; // Extra padding to load strokes near viewport
    const filtered = strokes.filter((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return false;
      
      // Check if stroke intersects with viewport
      return stroke.points.some((p) => 
        p.x >= viewport.minX - padding && 
        p.x <= viewport.maxX + padding && 
        p.y >= viewport.minY - padding && 
        p.y <= viewport.maxY + padding
      );
    });

    setVisibleStrokes(filtered);
  }, [strokes, offset, scale]);

  // Draw all strokes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set actual canvas size (large for infinite canvas)
      const canvasWidth = 10000;
      const canvasHeight = 10000;
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      
      // Scale context for high DPI displays
      ctx.scale(dpr, dpr);
      
      // Set display size
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      // Clear canvas
      ctx.fillStyle = '#1a1c1f';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw only visible strokes (world coordinates)
      visibleStrokes.forEach((stroke) => {
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
  }, [visibleStrokes]);

  const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;

    // Convert screen coordinates to world coordinates
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale
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
    if (e.button === 1 || (e.button === 0 && e.ctrlKey) || (e.button === 0 && e.metaKey)) {
      // Middle mouse or Ctrl/Cmd + Left mouse = pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
      return;
    }
    
    if (e.button === 0) {
      const point = getPointFromEvent(e);
      if (point) startDrawing(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }
    
    const point = getPointFromEvent(e);
    if (point) draw(point);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    stopDrawing();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * delta));
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newOffset = {
        x: mouseX - (mouseX - offset.x) * (newScale / scale),
        y: mouseY - (mouseY - offset.y) * (newScale / scale)
      };
      
      setScale(newScale);
      setOffset(newOffset);
    }
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
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#1a1c1f]" style={{ cursor: isPanning ? 'grabbing' : 'grab' }}>
        <div 
      style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: '10000px',
            height: '10000px',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          <canvas
            ref={canvasRef}
        onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ 
              touchAction: 'none',
              width: '10000px',
              height: '10000px'
            }}
          />
        </div>
      </div>
    </div>
  );
};

// PDF Viewer with Drawing Component
const PdfViewerWithDrawing: React.FC<{
  pdfUrl: string;
  pdfId: string;
  user: UserData;
  darkMode: boolean;
  onClose: () => void;
}> = ({ pdfUrl, pdfId, user, darkMode, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const colors = ['#ff0000', '#000000', '#ffffff', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Subscribe to PDF drawings
  useEffect(() => {
    const unsubscribe = subscribeToPdfDrawings(pdfId, (firebaseStrokes) => {
      setStrokes(firebaseStrokes as WhiteboardStroke[]);
    });
    return () => unsubscribe();
  }, [pdfId]);

  // Draw all strokes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawStrokes = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.clearRect(0, 0, rect.width, rect.height);

      strokes.forEach((stroke) => {
        if (stroke.points.length === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = stroke.tool === 'eraser' ? 'transparent' : stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      });
    };

    drawStrokes();
    const resizeObserver = new ResizeObserver(drawStrokes);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [strokes]);

  const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return null;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1)),
      y: (clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1))
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

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    ctx.beginPath();
    ctx.strokeStyle = currentTool === 'eraser' ? 'transparent' : currentColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    currentStrokeRef.current.push(point);
    lastPointRef.current = point;
  };

  const stopDrawing = async () => {
    if (!isDrawing || currentStrokeRef.current.length === 0) return;

    setIsDrawing(false);

    try {
      await addPdfStroke(pdfId, {
        points: [...currentStrokeRef.current],
        color: currentColor,
        lineWidth: lineWidth,
        tool: currentTool,
        username: user.username,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error saving PDF stroke:', error);
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
    if (confirm('PDF üzerindeki tüm çizimleri temizlemek istediğinize emin misiniz?')) {
      try {
        const strokesRef = collection(db, `pdfDrawings/${pdfId}/strokes`);
        const snapshot = await getDocs(strokesRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (error) {
        console.error('Error clearing PDF drawings:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${darkMode ? 'bg-[#2f3136]' : 'bg-white'} rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border ${darkMode ? 'border-white/10' : 'border-gray-200'}`} onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className={`flex items-center justify-between p-3 ${darkMode ? 'bg-[#2f3136] border-white/10' : 'bg-gray-100 border-gray-200'} border-b flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentTool('pen')}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pen' ? 'bg-[#5865f2] text-white' : darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
              title="Kalem"
            >
              <PenTool size={20} />
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`p-2 rounded-lg transition-all ${currentTool === 'eraser' ? 'bg-[#5865f2] text-white' : darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
              title="Silgi"
            >
              <Eraser size={20} />
            </button>
            <div className={`w-px h-6 ${darkMode ? 'bg-white/10' : 'bg-gray-300'} mx-1`}></div>
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
            <div className={`w-px h-6 ${darkMode ? 'bg-white/10' : 'bg-gray-300'} mx-1`}></div>
            <div className="flex items-center gap-2">
              <Minus size={16} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
              <input
                type="range"
                min="1"
                max="20"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-24"
              />
              <Plus size={16} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} w-8 text-center`}>{lineWidth}px</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className={`p-2 ${darkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-600 hover:text-red-600 hover:bg-red-100'} rounded-lg transition-all`}
              title="Temizle"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all`}
              title="Kapat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF with Canvas Overlay */}
        <div className="flex-1 relative overflow-hidden">
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Viewer"
          />
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="absolute inset-0 w-full h-full cursor-crosshair pointer-events-auto"
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

// Emoji Picker Component
const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const emojiCategories = [
    { name: 'Yüzler', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'] },
    { name: 'El İşaretleri', emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄'] },
    { name: 'Kalpler', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️'] },
    { name: 'Nesneler', emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '💊', '💉', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🧺', '🧻', '🚽', '🚿', '🛁', '🛀', '🧼', '🧽', '🧴', '🛎', '🔑', '🗝', '🚪', '🛋', '🛏', '🛌', '🧸', '🖼', '🛍', '🛒', '🎁', '🎈', '🎉', '🎊', '🎀', '🎗', '🏆', '🥇', '🥈', '🥉', '⚽', '⚾', '🏀', '🏐', '🏈', '🏉', '🎾', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '🏹', '🎣', '🥿', '🛷', '⛸', '🎿', '⛷', '🏂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🤹', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏇', '🛶', '⛵', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓', '🚁', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚀', '🚟', '🚠', '🚡', '🛰', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🚚', '🚛', '🚜', '🏎', '🏍', '🛵', '🚲', '🛴', '🛹', '🛼', '🚏', '🛣', '🛤', '🛢', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧'] },
    { name: 'Yiyecekler', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🥃', '🍶', '🍺', '🍻', '🥂', '🍷'] },
    { name: 'Hayvanlar', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'] },
    { name: 'Doğa', emojis: ['🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌈', '☀️', '🌤', '⛅', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '❄️', '☃️', '⛄', '🌨', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫'] }
  ];

  return (
    <div className="fixed inset-0 bg-[#36393f]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#2f3136] rounded-lg shadow-2xl w-full max-w-2xl h-[500px] flex flex-col border border-[#202225]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#202225]">
          <h2 className="text-lg font-bold text-white">Emoji Seç</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {emojiCategories.map((category, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">{category.name}</h3>
              <div className="grid grid-cols-8 gap-2">
                {category.emojis.map((emoji, emojiIdx) => (
                  <button
                    key={emojiIdx}
                    onClick={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    className="text-2xl hover:bg-white/10 rounded-lg p-2 transition-all hover:scale-125 cursor-pointer"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
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

// User mention parser - converts @username to highlighted mentions
const parseMentions = (text: string, allUsers: Array<{ username: string; avatar: string }>, currentUsername?: string): { html: string; mentions: string[] } => {
  if (!text) return { html: '', mentions: [] };
  
  // Find all @mentions including @all
  const mentionRegex = /@(\w+)/g;
  let result = text;
  const mentions: string[] = [];
  const foundMentions = new Set<string>();
  
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const mention = match[1].toLowerCase();
    if (mention === 'all') {
      mentions.push('@all');
      foundMentions.add('@all');
    } else {
      const user = allUsers.find(u => u.username.toLowerCase() === mention);
      if (user) {
        mentions.push(user.username);
        foundMentions.add(user.username);
      }
    }
  }
  
  // Replace mentions with highlighted HTML
  foundMentions.forEach(mention => {
    if (mention === '@all') {
      const regex = /@all/gi;
      result = result.replace(regex, `<span class="mention-user mention-all" style="color: #fbbf24; font-weight: bold; cursor: pointer; background: rgba(251, 191, 36, 0.2); padding: 2px 4px; border-radius: 4px;">@all</span>`);
    } else {
      const user = allUsers.find(u => u.username.toLowerCase() === mention.toLowerCase());
      if (user) {
        const regex = new RegExp(`@${user.username}`, 'gi');
        result = result.replace(regex, `<span class="mention-user" data-username="${user.username}" style="color: #5865f2; font-weight: bold; cursor: pointer; background: rgba(88, 101, 242, 0.1); padding: 2px 4px; border-radius: 4px;">@${user.username}</span>`);
      }
    }
  });
  
  return { html: result, mentions };
};

// HTML sanitizer - allows only safe HTML tags
const sanitizeHTML = (html: string): string => {
  if (!html) return '';
  
  // Allowed tags
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'span', 'div'];
  
  try {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script tags and event handlers
    const scripts = temp.querySelectorAll('script, iframe, object, embed, form, input, button');
    scripts.forEach(script => script.remove());
    
    // Remove all tags that are not in allowed list
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      if (!allowedTags.includes(tagName)) {
        // Replace with its content
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
        }
      } else {
        // Remove all attributes except href for links
        const attrsToRemove: string[] = [];
        Array.from(el.attributes).forEach(attr => {
          if (tagName === 'a' && attr.name === 'href') {
            // Keep href but make it safe
            const href = attr.value;
            if (!href.startsWith('javascript:') && !href.startsWith('data:') && !href.startsWith('vbscript:')) {
              el.setAttribute('target', '_blank');
              el.setAttribute('rel', 'noopener noreferrer');
            } else {
              attrsToRemove.push(attr.name);
            }
          } else {
            // Remove all other attributes
            attrsToRemove.push(attr.name);
          }
        });
        attrsToRemove.forEach(attr => el.removeAttribute(attr));
      }
    });
    
    return temp.innerHTML;
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    // Return escaped HTML if sanitization fails
    return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; id: string } | null>(null);
  const [pdfStrokes, setPdfStrokes] = useState<WhiteboardStroke[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{ username: string; avatar: string } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseFileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const typingTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Get user profile from Firestore
        const profile = await getUserProfile(firebaseUser.uid);
        
        // Always use username from profile if it exists, never use email directly
        if (profile && profile.username && profile.username.trim() !== '') {
          // Only update if user state doesn't already have the correct username
          // This prevents overwriting username set during signup
          setUser(prevUser => {
            if (prevUser && prevUser.userId === firebaseUser.uid && prevUser.username === profile.username) {
              return prevUser; // Don't update if already correct
            }
            return {
              username: profile.username,
              avatar: profile.avatar || firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=5865f2&color=fff&size=128`,
              userId: firebaseUser.uid,
              email: firebaseUser.email || undefined
            };
          });
        } else {
          // If no profile exists or username is empty, use displayName or create from email
          // But never use full email as username
          let finalUsername = firebaseUser.displayName;
          
          if (!finalUsername || finalUsername.trim() === '') {
            // Extract username from email (part before @)
            if (firebaseUser.email) {
              finalUsername = firebaseUser.email.split('@')[0];
              // Clean up username - remove dots, make first letter uppercase
              finalUsername = finalUsername.replace(/\./g, '_');
              finalUsername = finalUsername.charAt(0).toUpperCase() + finalUsername.slice(1);
            } else {
              // Fallback to user ID
              finalUsername = `user_${firebaseUser.uid.slice(0, 8)}`;
            }
          }
          
          const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalUsername)}&background=5865f2&color=fff&size=128`;
          
          // Only update if user state doesn't already have a username
          setUser(prevUser => {
            if (prevUser && prevUser.userId === firebaseUser.uid && prevUser.username && prevUser.username.trim() !== '') {
              return prevUser; // Don't overwrite existing username
            }
            return {
              username: finalUsername,
              avatar: firebaseUser.photoURL || defaultAvatar,
              userId: firebaseUser.uid,
              email: firebaseUser.email || undefined
            };
          });
          
          // Save to Firestore if profile doesn't exist or username is missing
          if (!profile || !profile.username || profile.username.trim() === '') {
            await saveUser(firebaseUser.uid, {
              username: finalUsername,
              avatar: firebaseUser.photoURL || defaultAvatar
            });
          }
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Update editUsername when settings modal opens
  useEffect(() => {
    if (showSettings && user) {
      setEditUsername(user.username);
    }
  }, [showSettings, user]);

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
      setHasMoreMessages(firebaseMessages.length >= 50); // If we got 50 messages, there might be more
      
      if (firebaseMessages.length > prevLength && prevLength > 0) {
        const lastMessage = firebaseMessages[firebaseMessages.length - 1];
        if (lastMessage.username !== user.username && notificationsEnabled) {
          if (lastMessage.type === 'break') {
            playBreakSound();
          } else {
            playNotificationSound();
          }
          
          let messageText = '';
          if (lastMessage.type === 'break') {
            messageText = lastMessage.text || '🚬 Sigara içme molası!';
          } else if (lastMessage.imageUrl) {
            messageText = '📷 Fotoğraf';
          } else if (lastMessage.gifUrl) {
            messageText = '🎬 GIF';
          } else if (lastMessage.text) {
            messageText = lastMessage.text;
          }
          
          setNotification({
            username: lastMessage.username,
            text: messageText
          });
          
          setTimeout(() => {
            setNotification(null);
          }, 5000);
          
          if ('Notification' in window && Notification.permission === 'granted') {
            const notificationTitle = lastMessage.type === 'break' 
              ? '🚬 Mola!' 
              : `Yeni mesaj: ${lastMessage.username}`;
            new Notification(notificationTitle, {
              body: messageText,
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Profil resmi çok büyük. Maksimum 2MB olmalıdır.');
        return;
      }
      
      // For preview, use base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (base64String) {
          setAvatar(base64String);
        }
      };
      reader.readAsDataURL(file);
      
      // Upload to Firebase Storage if user is logged in
      if (user) {
        setIsLoading(true);
        try {
          const avatarUrl = await uploadImage(file);
          const updatedUser: UserData = { 
            ...user, 
            avatar: avatarUrl 
          };
          setUser(updatedUser);
          setAvatar(avatarUrl);
          if (user.userId) {
            await updateUserProfile(user.userId, { avatar: avatarUrl });
          }
        } catch (err) {
          console.error('Error uploading avatar:', err);
          alert('Profil resmi yüklenirken bir hata oluştu.');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Email ve şifre gereklidir.');
      return;
    }
    
    if (isSignUp && !username.trim()) {
      setAuthError('Kayıt olmak için kullanıcı adı gereklidir.');
      return;
    }

    setIsLoading(true);
    setAuthError('');

    try {
      if (isSignUp) {
        let finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=5865f2&color=fff&size=128`;
        
        // If avatar is base64, upload it to Firebase Storage first
        if (avatar && avatar.startsWith('data:image')) {
          try {
            // Convert base64 to File
            const base64Response = await fetch(avatar);
            const blob = await base64Response.blob();
            const file = new File([blob], 'avatar.jpg', { type: blob.type });
            finalAvatar = await uploadImage(file);
          } catch (err) {
            console.error('Error uploading avatar during signup:', err);
            // Use default avatar if upload fails
          }
        } else if (avatar && avatar.startsWith('http')) {
          finalAvatar = avatar;
        }
        
        const firebaseUser = await signUp(email.trim(), password, username.trim(), finalAvatar);
        
        // Immediately set user state with the username from signup
        // This ensures the username is used right away, before auth listener fires
        setUser({
          username: username.trim(),
          avatar: finalAvatar,
          userId: firebaseUser.uid,
          email: email.trim()
        });
        
        setEmail('');
        setPassword('');
        setUsername('');
        setAvatar('');
      } else {
        await signIn(email.trim(), password);
        setEmail('');
        setPassword('');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu email zaten kullanılıyor.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf. En az 6 karakter olmalıdır.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz email adresi.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Kullanıcı bulunamadı.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Yanlış şifre.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
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

  const breakTypes = [
    { id: 'coffee', emoji: '☕', text: 'Kahve molası!', icon: Coffee },
    { id: 'cigarette', emoji: '🚬', text: 'Sigara içme molası!', icon: Cigarette },
    { id: 'masturbation', emoji: '✊', text: '31 molası!', icon: Heart },
    { id: 'sex', emoji: '🍆', text: 'Sikiş molası!', icon: Heart }
  ] as const;

  // Close break menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showBreakMenu && !target.closest('.break-menu-container')) {
        setShowBreakMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBreakMenu]);

  const handleBreak = async (breakType: typeof breakTypes[number]) => {
    if (!user || !selectedChannel) return;
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type === 'whiteboard') return; // Skip for whiteboard channels
    if (!user.username || !user.avatar) {
      alert('Kullanıcı bilgileri eksik. Lütfen tekrar giriş yapın.');
      return;
    }
    try {
      await sendMessage(selectedChannel, {
        username: user.username,
        avatar: user.avatar,
        text: `${breakType.emoji} ${breakType.text}`,
        timestamp: Date.now(),
        type: 'break'
      });
      playBreakSound();
      setShowBreakMenu(false);
    } catch (error) {
      console.error('Error sending break message:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user || !selectedChannel) return;
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type === 'whiteboard') return; // Skip for whiteboard channels
    if (!user.username || !user.avatar) {
      alert('Kullanıcı bilgileri eksik. Lütfen tekrar giriş yapın.');
      return;
    }
    setIsLoading(true);
    try {
      console.log('Uploading image:', file.name);
      const imageUrl = await uploadImage(file);
      console.log('Image uploaded, URL:', imageUrl);
      const messageData = {
        username: user.username,
        avatar: user.avatar,
        imageUrl: imageUrl,
        timestamp: Date.now(),
        type: 'image' as const
      };
      console.log('Sending message with data:', messageData);
      await sendMessage(selectedChannel, messageData);
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Fotoğraf yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGifSelect = async (gifUrl: string) => {
    if (!user || !selectedChannel) return;
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type === 'whiteboard') return; // Skip for whiteboard channels
    if (!user.username || !user.avatar) {
      alert('Kullanıcı bilgileri eksik. Lütfen tekrar giriş yapın.');
      return;
    }
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
      const selectedChannelData = channels.find(c => c.id === selectedChannel);
      if (selectedChannelData?.type === 'whiteboard') {
        setInputMessage('');
        return; // Skip for whiteboard channels
      }
      if (!selectedChannelData) {
        alert('Kanal bulunamadı. Lütfen tekrar deneyin.');
        return;
      }
      if (!user.username || !user.avatar) {
        alert('Kullanıcı bilgileri eksik. Lütfen tekrar giriş yapın.');
        return;
      }
      setIsLoading(true);
      try {
        // Parse mentions from message
        const allUsers = [...uniqueUsers, ...(user ? [{ username: user.username, avatar: user.avatar }] : [])];
        const mentionResult = parseMentions(inputMessage.trim(), allUsers, user?.username);
        
        await sendMessage(selectedChannel, {
          username: user.username,
          avatar: user.avatar,
          text: inputMessage.trim(),
          timestamp: Date.now(),
          type: 'text',
          mentions: mentionResult.mentions
        });
        setInputMessage('');
        setShowMentionPicker(false);
      } catch (error: any) {
        console.error('Error sending message:', error);
        const errorMessage = error?.message || 'Bilinmeyen bir hata oluştu';
        alert(`Mesaj gönderilirken bir hata oluştu: ${errorMessage}. Lütfen tekrar deneyin.`);
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
    const selectedChannelData = channels.find(c => c.id === selectedChannel);
    if (selectedChannelData?.type === 'whiteboard') return; // Skip for whiteboard channels
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

  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);
      setEmail('');
      setPassword('');
      setUsername('');
      setAvatar('');
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Çıkış yapılırken bir hata oluştu.');
    }
  };

  // Get unique users from messages
  const uniqueUsers = Array.from(
    new Map(messages.map(msg => [msg.username, { username: msg.username, avatar: msg.avatar }])).values()
  ).filter((u) => (u as { username: string; avatar: string }).username !== user?.username) as Array<{ username: string; avatar: string }>;

  // Filter messages by search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const searchLower = searchQuery.toLowerCase();
    return messages.filter((msg) => {
      return (
        msg.text?.toLowerCase().includes(searchLower) ||
        msg.username.toLowerCase().includes(searchLower) ||
        msg.type === 'break'
      );
    });
  }, [messages, searchQuery]);

  // If user not logged in, show inline login
  if (!user) {
  return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1c1f] via-[#2f3136] to-[#36393f] p-4">
        <div className={`w-full max-w-md modern-card rounded-xl p-8 border ${darkMode ? 'border-white/10' : 'border-gray-200'} shadow-2xl`}>
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
            {authError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleAuth()}
                placeholder="ornek@email.com"
                className={`w-full px-4 py-3 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'} focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <Lock size={16} />
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleAuth()}
                placeholder="••••••••"
                className={`w-full px-4 py-3 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'} focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm`}
              />
            </div>
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <User size={16} />
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleAuth()}
                    placeholder="Kullanıcı adınızı girin"
                    className={`w-full px-4 py-3 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'} focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm`}
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
                      className={`px-4 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} rounded-lg transition-all hover:scale-105 border ${darkMode ? 'border-white/10' : 'border-gray-300'}`}
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
              </>
            )}
            <button
              onClick={handleAuth}
              disabled={isLoading || !email.trim() || !password.trim() || (isSignUp && !username.trim())}
              className="w-full bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5865f2]/30 hover:scale-105"
            >
              {isLoading ? 'Yükleniyor...' : (isSignUp ? 'Kayıt Ol' : 'Giriş Yap')}
            </button>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              className="w-full text-center text-gray-400 hover:text-white transition text-sm"
            >
              {isSignUp ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex bg-gradient-to-br ${darkMode ? 'from-[#1a1c1f] via-[#2f3136] to-[#36393f]' : 'from-white to-gray-50'} ${darkMode ? 'text-white' : 'text-gray-900'} overflow-hidden relative`}>
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
            <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} text-sm tracking-wide`}>Kutuphane Chat</span>
          </div>
      </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div className={`px-2 py-1 text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider flex items-center gap-2`}>
              <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
              Kanallar
                </div>
            <button
              onClick={() => setShowNewChannelInput(!showNewChannelInput)}
              className={`p-1.5 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
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
                className={`w-full px-3 py-2 text-sm ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-lg placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm`}
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
                    : darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                }`}
              >
                {channel.type === 'text' ? (
                  <Hash size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                ) : channel.type === 'whiteboard' ? (
                  <PenTool size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                ) : (
                  <Volume2 size={16} className={selectedChannel === channel.id ? 'text-white' : 'text-gray-400'} />
                )}
                <span className={`text-sm truncate font-medium ${selectedChannel === channel.id ? 'text-white' : darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {channel.name}
                </span>
          </div>
            ))}
      </div>

          {/* Users List */}
          <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="px-2 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
              Online — {uniqueUsers.length + 1}
            </div>
            <div className="space-y-1.5">
              {uniqueUsers.map((u, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} cursor-pointer transition-all group hover-glow`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity"></div>
                    <img src={u.avatar} alt={u.username} className="w-9 h-9 rounded-full relative z-10 ring-2 ring-white/10 group-hover:ring-[#5865f2]/50 transition-all" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2f3136] shadow-lg shadow-green-500/50"></div>
            </div>
                  <span className={`text-sm ${darkMode ? 'text-gray-300 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'} font-medium transition truncate`}>
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
          <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`px-2 py-1 text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider flex items-center gap-2`}>
                <div className="w-1 h-4 bg-gradient-to-b from-[#5865f2] to-[#eb459e] rounded-full"></div>
                Dersler
              </div>
              <button
                onClick={() => setShowNewCourseInput(!showNewCourseInput)}
                className={`p-1.5 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
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
        <div className={`h-16 bg-gradient-to-t ${darkMode ? 'from-black/40' : 'from-gray-100/40'} to-transparent border-t ${darkMode ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between px-2 md:px-3 flex-shrink-0 backdrop-blur-sm`}>
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-30"></div>
              <img src={user.avatar} alt={user.username} className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 relative z-10 ring-2 ring-white/10" />
            </div>
            <span className={`text-xs md:text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'} truncate hidden sm:block`}>{user.username}</span>
          </div>
          <div className="flex gap-0.5 md:gap-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1.5 md:p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
              title={darkMode ? 'Açık Tema' : 'Koyu Tema'}
            >
              {darkMode ? <Sun size={16} className="md:w-[18px] md:h-[18px]" /> : <Moon size={16} className="md:w-[18px] md:h-[18px]" />}
            </button>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`p-1.5 md:p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
              title={notificationsEnabled ? 'Bildirimleri Kapat' : 'Bildirimleri Aç'}
            >
              {notificationsEnabled ? <Bell size={16} className="md:w-[18px] md:h-[18px]" /> : <BellOff size={16} className="md:w-[18px] md:h-[18px]" />}
            </button>
            <button
              onClick={handleClearChat}
              className={`p-1.5 md:p-2 ${darkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-600 hover:text-red-600 hover:bg-red-100'} rounded-lg transition-all hover:scale-110`}
              title="Sohbeti Temizle"
            >
              <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button
              onClick={() => {
                setEditUsername(user.username);
                setShowSettings(true);
              }}
              className={`p-1.5 md:p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
              title="Ayarlar"
            >
              <Settings size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button
              onClick={handleLogout}
              className={`p-1.5 md:p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
              title="Çıkış"
            >
              <LogOut size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Courses & Files */}
      {selectedCourse && (
        <div className={`w-64 modern-card border-l ${darkMode ? 'border-white/10' : 'border-gray-200'} flex flex-col md:flex relative z-10`}>
          <div className={`h-14 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between px-4 flex-shrink-0 bg-gradient-to-r from-[#5865f2]/20 to-transparent`}>
            <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} text-sm truncate`}>
              {courses.find(c => c.id === selectedCourse)?.name}
            </span>
            <button
              onClick={() => setSelectedCourse(null)}
              className={`p-1.5 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded-lg transition-all hover:scale-110`}
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
                <div
                  key={file.id}
                  onClick={() => file.type === 'application/pdf' ? setSelectedPdf({ url: file.url, id: file.id }) : window.open(file.url, '_blank')}
                  className={`block p-3 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg transition-all hover-glow cursor-pointer`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${darkMode ? 'text-white' : 'text-gray-800'} truncate font-medium`}>{file.name}</div>
                      <div className="text-xs text-gray-400">{file.uploadedBy}</div>
                    </div>
                </div>
                </div>
              ))}
                            </div>
                        </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-[#36393f]/50 to-[#2f3136]/50 backdrop-blur-sm min-w-0 relative z-10">
        {/* Mobile Header */}
        <div className={`h-14 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between px-4 glass-effect md:hidden flex-shrink-0`}>
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
          <div className={`h-14 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between px-6 glass-effect flex-shrink-0 hidden md:flex`}>
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
          <div className={`px-4 py-3 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'} glass-effect flex-shrink-0`}>
            <div className="flex items-center gap-2">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mesajlarda ara..."
                className={`flex-1 px-3 py-2 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'} focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition backdrop-blur-sm text-sm`}
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
            <div 
              ref={messagesContainerRef}
              className="space-y-3 overflow-y-auto overflow-x-hidden flex-1"
              onScroll={useCallback((e: React.UIEvent<HTMLDivElement>) => {
                const container = e.currentTarget;
                // Load more when scrolled to top (throttled)
                if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages && selectedChannel) {
                  setIsLoadingMoreMessages(true);
                  const oldestMessage = messages[0];
                  if (oldestMessage) {
                    loadMoreMessages(selectedChannel, oldestMessage.timestamp, 50)
                      .then((moreMessages) => {
                        if (moreMessages.length > 0) {
                          const currentScrollHeight = container.scrollHeight;
                          setMessages(prev => [...moreMessages, ...prev]);
                          setHasMoreMessages(moreMessages.length >= 30);
                          // Maintain scroll position
                          requestAnimationFrame(() => {
                            const newScrollHeight = container.scrollHeight;
                            container.scrollTop = newScrollHeight - currentScrollHeight;
                          });
                        } else {
                          setHasMoreMessages(false);
                        }
                      })
                      .catch((error) => {
                        console.error('Error loading more messages:', error);
                      })
                      .finally(() => {
                        setIsLoadingMoreMessages(false);
                      });
                  } else {
                    setIsLoadingMoreMessages(false);
                  }
                }
              }, [hasMoreMessages, isLoadingMoreMessages, selectedChannel, messages])}
            >
              {isLoadingMoreMessages && (
                <div className="text-center py-2 text-gray-400 text-sm">
                  Daha fazla mesaj yükleniyor...
                </div>
              )}
              {filteredMessages.map((msg) => {
                const isMentioned = user && (
                  msg.mentions?.includes(user.username) || 
                  msg.mentions?.includes('@all')
                );
                return (
                <div
                  key={msg.id}
                  className={`flex gap-4 group ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} px-4 py-2 -mx-4 rounded-xl transition-all ${
                    msg.username === user?.username ? 'bg-[#5865f2]/10' : ''
                  } ${msg.type === 'break' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-500 shadow-lg shadow-yellow-500/20' : ''} ${
                    isMentioned ? 'bg-yellow-500/20 border-l-4 border-yellow-500' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5865f2] to-[#eb459e] rounded-full blur-sm opacity-0 group-hover:opacity-30 transition-opacity"></div>
                    <img
                      src={msg.avatar}
                      alt={msg.username}
                      onClick={() => setSelectedUserProfile({ username: msg.username, avatar: msg.avatar })}
                      className="w-11 h-11 rounded-full flex-shrink-0 cursor-pointer ring-2 ring-white/10 group-hover:ring-[#5865f2]/50 transition-all relative z-10"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2.5 mb-1.5">
                      <span className={`font-bold text-sm ${
                        msg.username === user?.username 
                          ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] bg-clip-text text-transparent' 
                          : darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {msg.username === user?.username ? 'Sen' : msg.username}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
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
                    {/* Reactions - shown above message content */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                          const userList = Array.isArray(users) ? users : [];
                          const hasReacted = user && userList.includes(user.username);
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                if (user && selectedChannel) {
                                  addReaction(selectedChannel, msg.id, emoji, user.username);
                                }
                              }}
                              className={`px-2 py-1 rounded flex items-center gap-1 text-xs transition ${
                                hasReacted 
                                  ? 'bg-[#5865f2]/30 hover:bg-[#5865f2]/40' 
                                  : darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
                              } ${darkMode ? 'text-white' : 'text-gray-700'}`}
                            >
                              <span>{emoji}</span>
                              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{userList.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {msg.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          loading="lazy"
                          className="max-w-full md:max-w-md rounded-lg cursor-pointer hover:opacity-90 transition shadow-lg"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    {msg.gifUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.gifUrl}
                          alt="GIF"
                          loading="lazy"
                          className="max-w-full md:max-w-md rounded-lg cursor-pointer shadow-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    {msg.text && (
                      <div 
                        className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm break-words message-content`}
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(parseMentions(msg.text, [...uniqueUsers, ...(user ? [{ username: user.username, avatar: user.avatar }] : [])], user?.username).html) }}
                        style={{
                          lineHeight: '1.5'
                        }}
                      />
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                        className={`px-2 py-1 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} rounded text-xs transition opacity-0 group-hover:opacity-100`}
                        title="Tepki Ekle"
                      >
                        <Smile size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
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
                <div className="relative break-menu-container">
                  <button
                    onClick={() => setShowBreakMenu(!showBreakMenu)}
                    disabled={isLoading}
                    className="px-3 py-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-all disabled:opacity-50 hover:scale-110 font-semibold text-xs flex items-center gap-1.5 border border-orange-500/30 hover:border-orange-500/50"
                    title="Mola Seç"
                  >
                    <Cigarette size={16} />
                    <span className="hidden md:inline">Mola</span>
                    <ChevronDown size={14} className={`transition-transform ${showBreakMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showBreakMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#2f3136] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                      {breakTypes.map((breakType) => {
                        const IconComponent = breakType.icon;
                 return (
                          <button
                            key={breakType.id}
                            onClick={() => handleBreak(breakType)}
                            className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center gap-3 text-sm text-gray-300 hover:text-white"
                          >
                            <span className="text-xl">{breakType.emoji}</span>
                            <IconComponent size={18} className="text-gray-400" />
                            <span>{breakType.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isLoading}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-50 hover:scale-110"
                title="Emoji Ekle"
              >
                <Smile size={18} />
              </button>
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputMessage(value);
                    const cursorPos = e.target.selectionStart || 0;
                    const textBeforeCursor = value.substring(0, cursorPos);
                    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                    
                    if (lastAtIndex !== -1) {
                      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                        setMentionQuery(textAfterAt);
                        setMentionPosition(lastAtIndex);
                        setShowMentionPicker(true);
                      } else {
                        setShowMentionPicker(false);
                      }
                    } else {
                      setShowMentionPicker(false);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isLoading && !showMentionPicker) {
                      handleSendMessage();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowMentionPicker(false);
                    }
                  }}
                  placeholder={`#${channels.find(c => c.id === selectedChannel)?.name || 'kanal'} kanalında mesaj gönder`}
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-lg placeholder-gray-500 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition disabled:opacity-50 text-sm md:text-base backdrop-blur-sm`}
                />
                {showMentionPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#2f3136] border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        const beforeAt = inputMessage.substring(0, mentionPosition);
                        const afterAt = inputMessage.substring(inputRef.current?.selectionStart || inputMessage.length);
                        setInputMessage(beforeAt + '@all ' + afterAt);
                        setShowMentionPicker(false);
                        setTimeout(() => {
                          const newPos = (beforeAt + '@all ').length;
                          inputRef.current?.setSelectionRange(newPos, newPos);
                          inputRef.current?.focus();
                        }, 0);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center gap-3 text-sm text-gray-300 hover:text-white border-b border-white/10"
                    >
                      <span className="text-xl">🔔</span>
                      <div>
                        <div className="font-semibold">@all</div>
                        <div className="text-xs text-gray-400">Herkesi etiketle</div>
                      </div>
                    </button>
                    {[...uniqueUsers, ...(user ? [{ username: user.username, avatar: user.avatar }] : [])]
                      .filter(u => u.username.toLowerCase().includes(mentionQuery.toLowerCase()))
                      .map((u) => (
                        <button
                          key={u.username}
                          onClick={() => {
                            const beforeAt = inputMessage.substring(0, mentionPosition);
                            const afterAt = inputMessage.substring(inputRef.current?.selectionStart || inputMessage.length);
                            setInputMessage(beforeAt + '@' + u.username + ' ' + afterAt);
                            setShowMentionPicker(false);
                            setTimeout(() => {
                              const newPos = (beforeAt + '@' + u.username + ' ').length;
                              inputRef.current?.setSelectionRange(newPos, newPos);
                              inputRef.current?.focus();
                            }, 0);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center gap-3 text-sm text-gray-300 hover:text-white"
                        >
                          <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-semibold">{u.username}</div>
                          </div>
                        </button>
                                ))}
                            </div>
                )}
                        </div>
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

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            setInputMessage(prev => prev + emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
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
        .modern-card {
          background: ${darkMode ? 'linear-gradient(135deg, rgba(47, 49, 54, 0.9) 0%, rgba(54, 57, 63, 0.9) 100%)' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)'};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          box-shadow: ${darkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 8px 32px 0 rgba(0, 0, 0, 0.1)'};
        }
        .glass-effect {
          background: ${darkMode ? 'rgba(47, 49, 54, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
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

      {/* Reaction Picker */}
      {showReactionPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowReactionPicker(null)}>
          <div className="bg-[#2f3136] rounded-lg shadow-2xl p-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-6 gap-2">
              {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯', '🤔', '👎'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (user && selectedChannel && showReactionPicker) {
                      addReaction(selectedChannel, showReactionPicker, emoji, user.username);
                      setShowReactionPicker(null);
                    }
                  }}
                  className="text-2xl hover:scale-125 transition-transform p-2 hover:bg-white/10 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
                        </div>
                        </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className={`${darkMode ? 'bg-[#2f3136]' : 'bg-white'} rounded-lg shadow-2xl w-full max-w-md border ${darkMode ? 'border-white/10' : 'border-gray-200'} overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            <div className={`h-32 bg-gradient-to-r from-[#5865f2] to-[#eb459e] relative`}>
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center transition text-white"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className={`w-24 h-24 rounded-full border-4 ${darkMode ? 'border-[#2f3136]' : 'border-white'}`}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center hover:bg-[#4752c4] transition border-2 border-[#2f3136]"
                    title="Fotoğraf Değiştir"
                  >
                    <ImageIcon size={14} className="text-white" />
                  </button>
             </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>
            <div className="pt-16 pb-6 px-6">
              <div className="mb-4">
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Kullanıcı adınız"
                  className={`w-full px-4 py-2 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-lg ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'} focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/50 transition`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!user || !editUsername.trim()) return;
                    setIsUpdatingProfile(true);
                    try {
                      await updateUserProfile(user.userId, { username: editUsername.trim() });
                      setUser({ ...user, username: editUsername.trim() });
                      setShowSettings(false);
                    } catch (error) {
                      console.error('Profil güncellenirken hata:', error);
                      alert('Profil güncellenirken bir hata oluştu.');
                    } finally {
                      setIsUpdatingProfile(false);
                    }
                  }}
                  disabled={!editUsername.trim() || isUpdatingProfile || editUsername === user.username}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#5865f2] to-[#eb459e] hover:from-[#4752c4] hover:to-[#d1358a] text-white rounded-lg font-semibold transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isUpdatingProfile ? 'Güncelleniyor...' : 'Kaydet'}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`px-4 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} rounded-lg font-semibold transition`}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Card */}
      {selectedUserProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUserProfile(null)}>
          <div className="bg-[#2f3136] rounded-lg shadow-2xl w-full max-w-md border border-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-r from-[#5865f2] to-[#eb459e] relative">
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                <img
                  src={selectedUserProfile.avatar}
                  alt={selectedUserProfile.username}
                  className="w-24 h-24 rounded-full border-4 border-[#2f3136]"
                />
      </div>
            </div>
            <div className="pt-16 pb-6 px-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">{selectedUserProfile.username}</h2>
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Online</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setInputMessage(prev => prev + `@${selectedUserProfile.username} `);
                  setSelectedUserProfile(null);
                  inputRef.current?.focus();
                }}
                className="w-full px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg font-semibold transition"
              >
                Mesaj Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal with Drawing */}
      {selectedPdf && user && (
        <PdfViewerWithDrawing
          pdfUrl={selectedPdf.url}
          pdfId={selectedPdf.id}
          user={user}
          darkMode={darkMode}
          onClose={() => setSelectedPdf(null)}
        />
      )}
    </div>
  );
};

export default App;
