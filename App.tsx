import React, { useState, useEffect, useRef } from 'react';
import { RegisterView } from './components/RegisterView';
import { StackView } from './components/StackView';
import { CodeListing } from './components/CodeListing';
import { MatrixDisplay } from './components/MatrixDisplay';
import { TimingDiagram } from './components/TimingDiagram';
import { generateConversionProgram, generateCounterProgram, INITIAL_STATE } from './services/cpu';
import { CpuState, InstructionStep } from './types';
import { Play, SkipForward, RotateCcw, Cpu, GripHorizontal, Activity, Zap, Info, ZoomIn, ZoomOut, Network, MousePointer2 } from 'lucide-react';

// Types
interface Position { x: number; y: number; }
interface Size { w: number; h: number; }
interface BoxState { 
    [key: string]: { pos: Position; size?: Size } 
}

// Draggable Component
interface DraggableBoxProps {
  id: string;
  title: string;
  position: Position;
  size?: Size; // Optional custom size
  scale: number; // Global scale for correct drag calculation
  onMove: (id: string, newPos: Position) => void;
  onResize?: (id: string, newSize: Size) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  accentColor?: string;
  defaultWidth?: string;
}

const DraggableBox: React.FC<DraggableBoxProps> = ({ 
    id, title, position, size, scale, onMove, onResize, children, defaultWidth = "w-80", icon, accentColor = "blue" 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Resize için ref kullanabiliriz veya CSS resize
  const boxRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Sahne Pan'ını engelle
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Hareketi zoom seviyesine göre ayarla
        const dx = e.movementX / scale;
        const dy = e.movementY / scale;
        
        onMove(id, {
          x: position.x + dx,
          y: position.y + dy
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, id, onMove, position, scale]);

  const borderColor = accentColor === 'green' ? 'border-green-500/30' : 
                    accentColor === 'red' ? 'border-red-500/30' : 
                    accentColor === 'yellow' ? 'border-yellow-500/30' :
                    accentColor === 'pink' ? 'border-pink-500/30' :
                    accentColor === 'cyan' ? 'border-cyan-500/30' :
                    accentColor === 'purple' ? 'border-purple-500/30' :
                    'border-blue-500/30';
  
  const shadowColor = accentColor === 'green' ? 'shadow-green-500/10' : 
                     accentColor === 'red' ? 'shadow-red-500/10' : 
                     accentColor === 'yellow' ? 'shadow-yellow-500/10' :
                     accentColor === 'pink' ? 'shadow-pink-500/10' :
                     accentColor === 'cyan' ? 'shadow-cyan-500/10' :
                     accentColor === 'purple' ? 'shadow-purple-500/10' :
                     'shadow-blue-500/10';

  return (
    <div 
      ref={boxRef}
      style={{ 
          left: position.x, 
          top: position.y,
          width: size ? size.w : undefined,
          height: size ? size.h : undefined
      }}
      className={`absolute glass-panel flex flex-col ${!size ? defaultWidth : ''} shadow-2xl ${shadowColor} backdrop-blur-xl transition-shadow duration-300 z-10 resize overflow-hidden`}
    >
      {/* Header Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between p-3 border-b ${borderColor} bg-white/5 cursor-move select-none rounded-t-xl group shrink-0`}
      >
        <div className="flex items-center gap-2 text-sm font-bold tracking-wider text-gray-200">
            {icon}
            {title}
        </div>
        <GripHorizontal size={16} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
      </div>
      
      {/* Content */}
      <div className="p-4 overflow-auto flex-1 text-gray-300 relative min-h-[100px]">
        {/* Tech Decor Lines */}
        <div className={`absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-${accentColor}-500/50 to-transparent opacity-30 pointer-events-none`}></div>
        <div className={`absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-${accentColor}-500/50 to-transparent opacity-30 pointer-events-none`}></div>
        {children}
      </div>
    </div>
  );
};

// Advanced Circuit Board Renderer
const Connections = ({ positions }: { positions: BoxState }) => {
  const getCenter = (key: string) => {
    const p = positions[key].pos;
    return {
        x: p.x + (key === 'cpu' ? 250 : 160), 
        y: p.y + (key === 'display' ? 0 : 100)
    };
  };

  const cpu = getCenter('cpu'); 
  const code = getCenter('code');
  const stack = getCenter('stack');
  const display = { x: positions.display.pos.x + 160, y: positions.display.pos.y };

  // Helper to draw a complex bus with logic gate
  const drawBus = (start: Position, end: Position, label: string, color: string, gateType: 'buffer' | 'control' = 'buffer', isMultiLine: boolean = false) => {
    const wireCount = isMultiLine ? 8 : 1; // 8 lines for ribbon cable effect
    const spacing = 3;
    
    // Control points for smooth curve
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const elements = [];

    // Draw wires
    for(let i = 0; i < wireCount; i++) {
        const offset = isMultiLine ? (i - wireCount/2) * spacing : 0;
        
        // Adjust start/end/control points by offset
        // We offset mostly in Y to create a ribbon, but slight X adjustment for curve naturalness
        const s = { x: start.x, y: start.y + offset };
        const e = { x: end.x, y: end.y + offset };
        
        const cp1 = { x: midX, y: start.y + offset };
        const cp2 = { x: midX, y: end.y + offset };
        
        const path = `M ${s.x} ${s.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${e.x} ${e.y}`;
        
        elements.push(
             <React.Fragment key={i}>
                {/* Glow */}
                <path d={path} stroke={color} strokeWidth={isMultiLine ? "1" : "6"} fill="none" opacity="0.15" />
                {/* Main Wire */}
                <path d={path} stroke={color} strokeWidth={isMultiLine ? "1.5" : "2"} fill="none" opacity="0.6" markerEnd={!isMultiLine ? "url(#arrow)" : undefined} />
                {/* Animated Flow */}
                <path d={path} stroke={color} strokeWidth={isMultiLine ? "1" : "2"} fill="none" className="wire-flow" opacity="0.8" style={{ animationDelay: `${i * 0.1}s` }} />
             </React.Fragment>
        );
    }
    
    // Gate Position (at 50% of curve)
    const gateX = midX;
    const gateY = midY;
    
    return (
      <g className="group">
        {elements}
        
        {/* Logic Gate Symbol on the path - Only draw gate box if single line or big control */}
        <g transform={`translate(${gateX - 15}, ${gateY - 10})`}>
            <rect width="30" height="20" rx="4" fill="#0f0f13" stroke={color} strokeWidth="2" />
            {gateType === 'buffer' ? (
                <path d="M 8 5 L 22 10 L 8 15 Z" fill="none" stroke={color} strokeWidth="2" />
            ) : (
                // Control / Latch symbol
                <path d="M 15 2 L 15 18 M 8 5 L 22 5 M 8 15 L 22 15" fill="none" stroke={color} strokeWidth="1.5" />
            )}
        </g>
        
        {/* Label */}
        <rect x={gateX - 40} y={gateY - 30} width="80" height="16" rx="2" fill="#000" opacity="0.7" />
        <text x={gateX} y={gateY - 18} textAnchor="middle" fill={color} fontSize="10" fontFamily="monospace" fontWeight="bold" letterSpacing="1">
            {label}
        </text>

        {/* Start/End Dots - Multiple if multiline */}
        {isMultiLine ? (
             <>
                <rect x={start.x - 2} y={start.y - (wireCount * spacing)/2} width="4" height={wireCount * spacing} fill={color} />
                <rect x={end.x - 2} y={end.y - (wireCount * spacing)/2} width="4" height={wireCount * spacing} fill={color} />
             </>
        ) : (
             <>
                <circle cx={start.x} cy={start.y} r="3" fill={color} stroke="#000" strokeWidth="1" />
                <circle cx={end.x} cy={end.y} r="3" fill={color} stroke="#000" strokeWidth="1" />
             </>
        )}
      </g>
    );
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.6" />
        </marker>
        <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
      </defs>

      {/* 1. CODE -> CPU (Instruction Bus) - 8 Bit Data Bus */}
      {drawBus(code, {x: cpu.x - 250, y: cpu.y + 50}, "DATA BUS (8)", "#60a5fa", "buffer", true)}
      
      {/* 2. CPU -> STACK (Address/Data Bus) - 16 Bit Address Bus */}
      {drawBus({x: cpu.x + 250, y: cpu.y + 50}, stack, "ADDRESS BUS (16)", "#a855f7", "control", true)}
      
      {/* 3. CPU -> DISPLAY (I/O Control) - 8 Bit Output Bus */}
      {drawBus({x: cpu.x, y: cpu.y + 250}, display, "OUTPUT BUS (8)", "#ef4444", "buffer", true)}
      
      {/* Extra: Control Unit -> CPU (System Control Bus: Reset, Clk, Intr) */}
      {drawBus({x: positions.control.pos.x + 160, y: positions.control.pos.y}, {x: cpu.x - 100, y: cpu.y + 200}, "CONTROL BUS (4)", "#eab308", "control", true)}

    </svg>
  );
};

const App = () => {
  // --- Simulation State ---
  const [inputVal, setInputVal] = useState<string>("10");
  const [cpuState, setCpuState] = useState<CpuState>(INITIAL_STATE);
  const [program, setProgram] = useState<InstructionStep[]>([]);
  const [programType, setProgramType] = useState<'conversion' | 'counter'>('conversion');
  const [isRunning, setIsRunning] = useState(false);
  const [interruptPending, setInterruptPending] = useState(false);
  
  // Scrolling Text State
  const [scrollingText, setScrollingText] = useState("  ");

  // --- Layout & Viewport State ---
  const [positions, setPositions] = useState<BoxState>({
    code: { pos: { x: 50, y: 100 } },
    cpu: { pos: { x: 500, y: 50 } },
    stack: { pos: { x: 1100, y: 100 } },
    display: { pos: { x: 550, y: 700 } },
    control: { pos: { x: 50, y: 700 } },
    info: { pos: { x: 950, y: 700 } },
    timing: { pos: { x: 950, y: 450 } }
  });

  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.9 }); // Start zoomed out slightly
  const [isPanning, setIsPanning] = useState(false);

  // Pan Handlers
  const handlePanDown = (e: React.MouseEvent) => {
    if (e.button === 0) setIsPanning(true);
  };
  
  useEffect(() => {
    const handlePanMove = (e: MouseEvent) => {
        if (isPanning) {
            setViewport(prev => ({
                ...prev,
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));
        }
    };
    const handlePanUp = () => setIsPanning(false);

    if (isPanning) {
        window.addEventListener('mousemove', handlePanMove);
        window.addEventListener('mouseup', handlePanUp);
    }
    return () => {
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanUp);
    };
  }, [isPanning]);

  // Zoom Handlers
  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      const zoomFactor = -e.deltaY * 0.001;
      setViewport(prev => ({
          ...prev,
          scale: Math.min(Math.max(0.4, prev.scale + zoomFactor), 2.5)
      }));
  };

  const updatePosition = (id: string, newPos: Position) => {
    setPositions(prev => ({ 
        ...prev, 
        [id]: { ...prev[id], pos: newPos } 
    }));
  };

  // --- Sim Helpers ---
  const handleReset = () => {
    setIsRunning(false);
    setCpuState({ ...INITIAL_STATE });
    // Keep the current program loaded, just reset state
  };

  const handleLoadConversion = () => {
    const num = parseInt(inputVal, 10);
    if (isNaN(num) || num < 0 || num > 255) { alert("0-255 arası sayı giriniz"); return; }
    const prog = generateConversionProgram(num);
    setProgram(prog.steps);
    setProgramType('conversion');
    setCpuState(INITIAL_STATE);
    setIsRunning(false);
  };

  const handleLoadCounter = () => {
    const prog = generateCounterProgram();
    setProgram(prog.steps);
    setProgramType('counter');
    setCpuState({
        ...INITIAL_STATE,
        registers: { ...INITIAL_STATE.registers, PC: 0x2000 } // Ensure PC starts at 2000 for counter
    });
    setIsRunning(false);
  };

  // Execution Logic
  const executeStep = () => {
    // 1. Hardware Interrupt Check
    if (interruptPending) {
        setInterruptPending(false);
        // Emulate RST 7.5: Push PC, Jump to 003C
        const sp = cpuState.registers.SP;
        const pc = cpuState.registers.PC;
        const newMemory = new Map(cpuState.memory);
        // Push High Byte
        newMemory.set(sp - 1, (pc >> 8) & 0xFF);
        // Push Low Byte
        newMemory.set(sp - 2, pc & 0xFF);
        
        setCpuState(prev => ({
            ...prev,
            registers: { ...prev.registers, SP: sp - 2, PC: 0x003C },
            memory: newMemory
        }));
        return;
    }

    // 2. Normal Execution
    const currentPc = cpuState.registers.PC;
    const step = program.find(s => s.address === currentPc);
    
    if (!step) { 
        // If we are in "Counter" mode and PC is valid but not in list?
        // Actually our list covers the loop. If PC goes astray, stop.
        setIsRunning(false); 
        return; 
    }
    
    const nextState = step.execute(cpuState);
    setCpuState(nextState);
  };

  // Scrolling Logic
  useEffect(() => {
    let scrollTimer: any;
    const msg = cpuState.matrixText;
    
    if (msg.length > 2) {
        let idx = 0;
        // Scroll speed
        scrollTimer = setInterval(() => {
            const slice = msg.slice(idx, idx + 2);
            setScrollingText(slice.padEnd(2, ' '));
            idx++;
            if (idx >= msg.length) {
                 idx = 0;
                 // Optional: Pause at end or restart immediately
            }
        }, 300);
    } else {
        setScrollingText(msg);
    }
    
    return () => clearInterval(scrollTimer);
  }, [cpuState.matrixText]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
        interval = setInterval(() => executeStep(), 200); // 5Hz Clock
    }
    return () => clearInterval(interval);
  }, [isRunning, cpuState, program, interruptPending]); // Dependencies need to include state to ensure fresh closure

  // Find index for UI highlighting
  const currentStepIndex = program.findIndex(p => p.address === cpuState.registers.PC);

  // Determine what to show on Matrix
  const getMatrixDisplayValue = () => {
      if (cpuState.matrixText.length > 2) return scrollingText;
      
      if (programType === 'conversion') {
          // Legacy behavior for conversion demo
          const isFinished = currentStepIndex === -1 && program.length > 0; // Rough check
          const numericValue = parseInt(cpuState.outputBuffer.join('').padEnd(8, '0'), 2);
          return cpuState.outputBuffer.length === 8 ? numericValue.toString(16).toUpperCase() : "  ";
      }
      
      // Default to matrixText if set (e.g. "  " or "XX")
      return cpuState.matrixText;
  };

  const ledValue = programType === 'counter' 
      ? cpuState.ports[1] || 0 
      : parseInt(cpuState.outputBuffer.join('').padEnd(8, '0'), 2); // Legacy for conversion

  return (
    <div 
        className="w-screen h-screen bg-[#050505] text-gray-200 overflow-hidden relative"
        onMouseDown={handlePanDown}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{ 
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${50 * viewport.scale}px ${50 * viewport.scale}`,
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`
        }}
      ></div>
      
      {/* Controls Overlay */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 bg-gray-900/80 p-2 rounded-lg border border-gray-700 backdrop-blur" onMouseDown={e => e.stopPropagation()}>
         <button onClick={() => setViewport(v => ({...v, scale: Math.max(0.5, v.scale - 0.1)}))} className="p-2 hover:bg-gray-800 rounded"><ZoomOut size={16} /></button>
         <span className="font-mono text-sm flex items-center">{Math.round(viewport.scale * 100)}%</span>
         <button onClick={() => setViewport(v => ({...v, scale: Math.min(2.5, v.scale + 0.1)}))} className="p-2 hover:bg-gray-800 rounded"><ZoomIn size={16} /></button>
         <button onClick={() => setViewport({x:0, y:0, scale:0.9})} className="px-2 text-xs font-bold text-blue-400">RESET VIEW</button>
      </div>
      
      {/* Instructions Overlay */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none text-xs text-gray-500 font-mono">
         <span className="bg-black/80 px-2 py-1 rounded border border-gray-800 text-blue-400">
            SYSTEM: 8085 ARCHITECTURE | MODE: {programType.toUpperCase()}
         </span>
      </div>

      {/* TRANSFORM CONTAINER */}
      <div 
        className="origin-top-left absolute top-0 left-0 w-full h-full"
        style={{ 
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
        }}
      >
        <Connections positions={positions} />

        {/* 1. CODE MODULE */}
        <DraggableBox id="code" title="PROGRAM MEMORY (ROM)" position={positions.code.pos} scale={viewport.scale} onMove={updatePosition} icon={<Network size={16} className="text-blue-400" />}>
            <div className="font-mono text-xs min-h-[300px]">
                <CodeListing program={program} currentStepIndex={currentStepIndex} />
            </div>
        </DraggableBox>

        {/* 2. CPU CORE */}
        <DraggableBox id="cpu" title="MICROPROCESSOR UNIT (MPU)" defaultWidth="w-[500px]" position={positions.cpu.pos} scale={viewport.scale} onMove={updatePosition} icon={<Cpu size={16} className="text-purple-400" />} accentColor="purple">
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-purple-500/20">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Durum</span>
                        <span className={`text-sm font-bold ${isRunning ? 'text-green-400' : 'text-gray-300'}`}>
                            {isRunning ? 'EXECUTING...' : 'HALTED'}
                        </span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-gray-500 uppercase">Program Counter</span>
                        <span className="text-xl font-mono text-purple-400">{cpuState.registers.PC.toString(16).toUpperCase().padStart(4, '0')}H</span>
                    </div>
                </div>
                <RegisterView registers={cpuState.registers} flags={cpuState.flags} />
            </div>
        </DraggableBox>

        {/* 3. STACK MEMORY */}
        <DraggableBox id="stack" title="SYSTEM MEMORY (RAM)" position={positions.stack.pos} scale={viewport.scale} onMove={updatePosition} icon={<Activity size={16} className="text-green-400" />} accentColor="green">
            <div className="min-h-[400px]">
                <StackView memory={cpuState.memory} sp={cpuState.registers.SP} />
            </div>
        </DraggableBox>

        {/* 4. CONTROL PANEL */}
        <DraggableBox id="control" title="INPUT CONTROLLER" position={positions.control.pos} scale={viewport.scale} onMove={updatePosition} icon={<Activity size={16} className="text-yellow-400" />} accentColor="yellow">
            <div className="space-y-4">
                {/* SCENARIO SELECTION */}
                <div>
                     <label className="text-xs text-gray-500 font-bold uppercase block mb-2">Scenario Select</label>
                     <div className="flex gap-2 mb-2">
                        <button onClick={handleLoadConversion} onMouseDown={(e) => e.stopPropagation()} className={`flex-1 py-1 text-xs border rounded ${programType === 'conversion' ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-600'}`}>DEC-&gt;BIN</button>
                        <button onClick={handleLoadCounter} onMouseDown={(e) => e.stopPropagation()} className={`flex-1 py-1 text-xs border rounded ${programType === 'counter' ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-600'}`}>COUNTER</button>
                     </div>
                </div>

                {/* Input Data (Only for Conversion) */}
                {programType === 'conversion' && (
                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-2">Input Data (DEC)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                onMouseDown={(e) => e.stopPropagation()} 
                                className="bg-black/50 border border-gray-700 rounded p-2 text-white font-mono w-full focus:border-yellow-500 focus:outline-none"
                            />
                            <button onClick={handleLoadConversion} onMouseDown={(e) => e.stopPropagation()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-xs">LOAD</button>
                        </div>
                    </div>
                )}
                
                {/* INTERRUPT BUTTON (Only for Counter) */}
                {programType === 'counter' && (
                     <button 
                        onClick={() => setInterruptPending(true)} 
                        onMouseDown={(e) => e.stopPropagation()} 
                        className={`w-full p-4 mt-2 rounded font-bold border ${interruptPending ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-red-900/30 border-red-800 hover:bg-red-800/50'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Zap size={18} className="text-white" />
                            <span>TRIGGER RST 7.5 INTERRUPT</span>
                        </div>
                     </button>
                )}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                    <button onClick={handleReset} onMouseDown={(e) => e.stopPropagation()} className="p-3 bg-gray-800/50 hover:bg-red-500/20 border border-transparent hover:border-red-500/50 rounded flex flex-col items-center gap-1 group">
                        <RotateCcw size={16} className="group-hover:text-red-400" />
                        <span className="text-[10px] font-bold">RST</span>
                    </button>
                    <button onClick={() => executeStep()} onMouseDown={(e) => e.stopPropagation()} className="p-3 bg-gray-800/50 hover:bg-yellow-500/20 border border-transparent hover:border-yellow-500/50 rounded flex flex-col items-center gap-1 group">
                        <SkipForward size={16} className="group-hover:text-yellow-400" />
                        <span className="text-[10px] font-bold">STEP</span>
                    </button>
                    <button onClick={() => setIsRunning(!isRunning)} onMouseDown={(e) => e.stopPropagation()} className="p-3 bg-gray-800/50 hover:bg-green-500/20 border border-transparent hover:border-green-500/50 rounded flex flex-col items-center gap-1 group">
                        <Play size={16} className={isRunning ? 'text-green-400' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold">{isRunning ? 'PAUSE' : 'RUN'}</span>
                    </button>
                </div>
            </div>
        </DraggableBox>

        {/* 5. DISPLAY MODULE */}
        <DraggableBox id="display" title="OUTPUT PERIPHERAL" position={positions.display.pos} scale={viewport.scale} onMove={updatePosition} icon={<Zap size={16} className="text-red-400" />} accentColor="red">
             {(() => {
                 const numericValue = ledValue;
                 const displayHex = numericValue.toString(16).toUpperCase().padStart(2, '0') + "H";
                 const displayBin = numericValue.toString(2).padStart(8, '0');
                 const displayDec = numericValue.toString();
                 const matrixStr = getMatrixDisplayValue();
                 
                 return (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col items-center justify-center bg-black/60 p-4 rounded border border-red-500/20 shadow-inner relative overflow-hidden">
                            {/* Matrix */}
                            <MatrixDisplay value={matrixStr} />
                            
                            <div className="mt-4 flex gap-1 z-10">
                                {[7,6,5,4,3,2,1,0].map(bit => (
                                    <div key={bit} className={`w-3 h-3 rounded-full transition-all duration-200 border border-black ${((numericValue >> bit) & 1) ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-red-950/50'}`}></div>
                                ))}
                            </div>
                            
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent)] pointer-events-none"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono">
                             <div className="bg-gray-800/50 p-2 rounded border border-gray-700 flex flex-col items-center group hover:border-gray-500 transition-colors">
                                 <span className="text-gray-500 text-[9px] uppercase tracking-wider mb-1">Decimal</span>
                                 <span className="text-white text-lg font-bold">{displayDec}</span>
                             </div>
                             
                             <div className="bg-gray-800/50 p-2 rounded border border-gray-700 flex flex-col items-center group hover:border-yellow-500/50 transition-colors">
                                 <span className="text-gray-500 text-[9px] uppercase tracking-wider mb-1">Hex</span>
                                 <span className="text-yellow-400 text-lg font-bold">{displayHex}</span>
                             </div>
                             
                             <div className="col-span-2 bg-gray-800/50 p-2 rounded border border-gray-700 flex flex-col items-center group hover:border-green-500/50 transition-colors">
                                  <span className="text-gray-500 text-[9px] uppercase tracking-wider mb-1">Binary Output</span>
                                  <span className="text-green-400 text-xl tracking-[0.2em] font-bold shadow-green-500/10 drop-shadow-sm">{displayBin}</span>
                             </div>
                        </div>
                    </div>
                 );
             })()}
        </DraggableBox>

        {/* 6. INFO BOX */}
        <DraggableBox id="info" title="LOGIC ANALYZER" position={positions.info.pos} scale={viewport.scale} onMove={updatePosition} icon={<Info size={16} className="text-cyan-400" />} accentColor="cyan">
             <div className="space-y-2">
                 <div className="text-[10px] uppercase text-cyan-500 tracking-wider font-bold">Current Operation</div>
                 {program.length === 0 ? (
                     <div className="text-sm text-gray-500 italic">System Reset. Select Mode.</div>
                 ) : (
                     (() => {
                        const step = program.find(s => s.address === cpuState.registers.PC);
                        if (!step) {
                            return <div className="text-sm text-gray-400 font-bold">Waiting / Idle</div>;
                        }
                        return (
                            <>
                                <div className="font-mono text-lg text-white bg-white/5 p-2 rounded border-l-2 border-cyan-500">
                                    {step.code}
                                </div>
                                <div className="text-sm text-gray-300 leading-relaxed">
                                    {step.description}
                                </div>
                            </>
                        );
                     })()
                 )}
             </div>
        </DraggableBox>

        {/* 7. TIMING DIAGRAM */}
        <DraggableBox id="timing" title="TIMING DIAGRAM" position={positions.timing.pos} scale={viewport.scale} onMove={updatePosition} icon={<Activity size={16} className="text-pink-400" />} accentColor="pink" defaultWidth="w-[650px]">
            {(() => {
                const step = program.find(s => s.address === cpuState.registers.PC);
                return step ? (
                    <TimingDiagram 
                        instructionCode={step.code}
                        cycles={step.cycles}
                    />
                ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm italic bg-black/20 rounded border border-dashed border-gray-800">
                        <div>Waiting for instruction execution...</div>
                    </div>
                );
            })()}
        </DraggableBox>
        
      </div>
    </div>
  );
};

export default App;
