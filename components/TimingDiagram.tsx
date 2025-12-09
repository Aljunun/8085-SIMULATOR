import React from 'react';
import { MachineCycle } from '../types';

interface TimingDiagramProps {
  instructionCode: string;
  cycles: MachineCycle[];
}

export const TimingDiagram: React.FC<TimingDiagramProps> = ({ instructionCode, cycles }) => {
  const CYCLE_WIDTH = 80; // Width of one T-state in pixels
  const SIGNAL_HEIGHT = 40;
  const GAP = 25; // Increased gap to make room for descriptions
  
  // Calculate total T-states
  const totalTStates = cycles.reduce((acc, c) => acc + c.tStates, 0);
  const totalWidth = totalTStates * CYCLE_WIDTH;

  // Signal definitions with descriptions
  const signals = [
    { name: 'CLK', desc: 'System Clock', color: '#60a5fa' },
    { name: 'ALE', desc: 'Address Latch Enable', color: '#eab308' },
    { name: 'IO/M', desc: 'Input/Output / Memory', color: '#a855f7' },
    { name: 'RD', desc: 'Read Control (Active Low)', color: '#ef4444' },
    { name: 'WR', desc: 'Write Control (Active Low)', color: '#ef4444' },
    { name: 'AD7-0', desc: 'Address / Data Bus', color: '#22c55e', isBus: true },
  ];

  const renderSignal = (signalName: string, yOffset: number) => {
    let currentX = 0;
    const path = [];
    
    // Iterate through machine cycles
    cycles.forEach((cycle) => {
      const isFetch = cycle.type === 'OPCODE_FETCH';
      const isRead = cycle.type === 'MEMORY_READ' || cycle.type === 'IO_READ';
      const isWrite = cycle.type === 'MEMORY_WRITE' || cycle.type === 'IO_WRITE';
      const isIO = cycle.type === 'IO_READ' || cycle.type === 'IO_WRITE';
      
      for (let t = 1; t <= cycle.tStates; t++) {
        const x = currentX + (t - 1) * CYCLE_WIDTH;
        
        switch (signalName) {
          case 'CLK':
            // Square wave
            path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} V ${yOffset} H ${x + CYCLE_WIDTH/2} V ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH}`);
            break;
            
          case 'ALE':
            // High only in T1
            if (t === 1) {
               path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} V ${yOffset} H ${x + CYCLE_WIDTH} V ${yOffset + SIGNAL_HEIGHT}`);
            } else {
               path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH}`);
            }
            break;

          case 'IO/M':
            // High for IO, Low for Memory
            const val = isIO ? yOffset : yOffset + SIGNAL_HEIGHT;
            path.push(`M ${x} ${val} H ${x + CYCLE_WIDTH}`);
            break;

          case 'RD':
            // Active low during T2-T3 for Read operations
            if ((isFetch || isRead) && (t === 2 || (t === 3 && cycle.tStates > 3))) {
                // Low
                path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH}`);
            } else if ((isFetch || isRead) && t === 3) {
                // Rising edge mid T3
                path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH/2} V ${yOffset} H ${x + CYCLE_WIDTH}`);
            } else {
                // High (Inactive)
                path.push(`M ${x} ${yOffset} H ${x + CYCLE_WIDTH}`);
            }
            break;

          case 'WR':
            // Active low during T2-T3 for Write operations
            if (isWrite && (t === 2 || t === 3)) {
                if (t === 3) {
                     path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH/2} V ${yOffset} H ${x + CYCLE_WIDTH}`);
                } else {
                     path.push(`M ${x} ${yOffset + SIGNAL_HEIGHT} H ${x + CYCLE_WIDTH}`);
                }
            } else {
                path.push(`M ${x} ${yOffset} H ${x + CYCLE_WIDTH}`);
            }
            break;

          case 'AD7-0':
            // Bus logic
            const busY = yOffset + SIGNAL_HEIGHT/2;
            const h = SIGNAL_HEIGHT/2;
            
            // T1: Address
            if (t === 1) {
                // Valid Address block
                path.push(`M ${x} ${busY} L ${x+5} ${busY-h} H ${x+CYCLE_WIDTH-5} L ${x+CYCLE_WIDTH} ${busY} L ${x+CYCLE_WIDTH-5} ${busY+h} H ${x+5} Z`);
                // Text label
            } 
            // T2/T3: Data
            else if ((t === 2 || t === 3) && (isFetch || isRead || isWrite)) {
                 const type = isFetch ? "OPCODE" : isRead ? "DATA IN" : "DATA OUT";
                 if (t === 2) {
                    path.push(`M ${x} ${busY} L ${x+5} ${busY-h} H ${x+CYCLE_WIDTH} V ${busY+h} H ${x+5} Z`);
                 } else {
                    path.push(`M ${x} ${busY-h} H ${x+CYCLE_WIDTH-5} L ${x+CYCLE_WIDTH} ${busY} L ${x+CYCLE_WIDTH-5} ${busY+h} H ${x} V ${busY-h}`);
                 }
            } else {
                 // High Z (Middle line)
                 path.push(`M ${x} ${busY} H ${x + CYCLE_WIDTH}`);
            }
            break;
        }
      }
      currentX += cycle.tStates * CYCLE_WIDTH;
    });

    return path.join(' ');
  };

  return (
    <div className="overflow-x-auto bg-black/40 p-4 rounded min-w-[600px] relative">
        <style>{`
          @keyframes draw {
            from { stroke-dashoffset: 2000; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes scan {
            from { transform: translateX(0); }
            to { transform: translateX(${totalWidth}px); }
          }
          .path-anim {
            stroke-dasharray: 2000;
            stroke-dashoffset: 0;
            animation: draw 1.5s ease-out forwards;
          }
          .scanner-line {
            animation: scan 2s linear infinite;
          }
        `}</style>

        <div className="flex mb-4 gap-4 items-center border-b border-gray-700 pb-2">
            <span className="font-bold text-cyan-400">{instructionCode}</span>
            <span className="text-xs text-gray-500">
                Total T-States: <span className="text-white font-mono">{totalTStates}</span>
            </span>
            <div className="flex gap-2">
                 {cycles.map((c, i) => (
                     <span key={i} className="text-[10px] px-2 py-1 bg-gray-800 rounded text-gray-300 border border-gray-600">
                         {c.type} ({c.tStates}T)
                     </span>
                 ))}
            </div>
        </div>

        <svg width={totalWidth + 120} height={signals.length * (SIGNAL_HEIGHT + GAP) + 50} className="font-mono text-[10px]">
            {/* Grid Lines for T-States */}
            {Array.from({ length: totalTStates }).map((_, i) => (
                <line 
                    key={i} 
                    x1={(i+1) * CYCLE_WIDTH} 
                    y1={0} 
                    x2={(i+1) * CYCLE_WIDTH} 
                    y2={signals.length * (SIGNAL_HEIGHT + GAP)} 
                    stroke="#333" 
                    strokeDasharray="4" 
                />
            ))}
            
            {/* Labels Background - Left Side */}
            <rect x="0" y="0" width="100" height="100%" fill="rgba(0,0,0,0.2)" />

            {signals.map((sig, idx) => {
                const y = idx * (SIGNAL_HEIGHT + GAP);
                return (
                    <g key={sig.name}>
                        {/* Signal Name */}
                        <text x={90} y={y + SIGNAL_HEIGHT/2 - 5} fill={sig.color} textAnchor="end" alignmentBaseline="middle" fontWeight="bold" fontSize="12">
                            {sig.name}
                        </text>
                        {/* Signal Description */}
                        <text x={90} y={y + SIGNAL_HEIGHT/2 + 8} fill={sig.color} fillOpacity="0.6" textAnchor="end" alignmentBaseline="middle" fontSize="8">
                            {sig.desc}
                        </text>

                        {/* Signal Path with Animation */}
                        <g transform={`translate(100, 0)`}>
                            <path 
                                d={renderSignal(sig.name, y)} 
                                stroke={sig.color} 
                                strokeWidth="2" 
                                fill="none" 
                                className="path-anim"
                            />
                        
                            {/* Bus Labels (Simplified) */}
                            {sig.isBus && cycles.map((c, cIdx) => {
                                 const cycleStart = cycles.slice(0, cIdx).reduce((acc, curr) => acc + curr.tStates, 0) * CYCLE_WIDTH;
                                 return (
                                     <React.Fragment key={cIdx}>
                                         {/* Address Label at T1 */}
                                         <text x={cycleStart + CYCLE_WIDTH/2} y={y + SIGNAL_HEIGHT/2} fill="#000" fontSize="8" textAnchor="middle" alignmentBaseline="middle" style={{opacity: 0, animation: 'fadeIn 0.5s forwards 1s'}}>
                                             ADDR
                                         </text>
                                         {/* Data Label at T2-T3 */}
                                         {(c.tStates >= 3) && (
                                             <text x={cycleStart + 2 * CYCLE_WIDTH} y={y + SIGNAL_HEIGHT/2} fill="#000" fontSize="8" textAnchor="middle" alignmentBaseline="middle" style={{opacity: 0, animation: 'fadeIn 0.5s forwards 1.2s'}}>
                                                 {c.type === 'OPCODE_FETCH' ? 'OPCODE' : 'DATA'}
                                             </text>
                                         )}
                                     </React.Fragment>
                                 );
                            })}
                        </g>
                    </g>
                );
            })}

            {/* Scanning Line Animation */}
            <g transform="translate(100, 0)">
                <line 
                    x1={0} y1={0} x2={0} y2={signals.length * (SIGNAL_HEIGHT + GAP)} 
                    stroke="rgba(255,255,255,0.2)" 
                    strokeWidth="2"
                    className="scanner-line"
                />
                <rect 
                    x={-20} y={0} width={40} height={signals.length * (SIGNAL_HEIGHT + GAP)} 
                    fill="url(#scan-gradient)"
                    className="scanner-line"
                    style={{ mixBlendMode: 'overlay' }}
                />
            </g>

            <defs>
                <linearGradient id="scan-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
                    <stop offset="100%" stopColor="transparent" />
                </linearGradient>
            </defs>
        </svg>
    </div>
  );
};
