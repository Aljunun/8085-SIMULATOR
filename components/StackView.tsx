import React from 'react';

interface StackViewProps {
  memory: Map<number, number>;
  sp: number;
}

export const StackView: React.FC<StackViewProps> = ({ memory, sp }) => {
  // We want to show memory from say FFE0 to FFFF
  const startAddr = 0xFFF0;
  const endAddr = 0xFFFF;
  const rows = [];

  for (let addr = endAddr; addr >= startAddr; addr--) {
    const val = memory.get(addr) ?? 0; // Default to 00 if not set
    const isSp = addr === sp;
    const isUsed = addr >= sp && sp !== 0xFFFF + 1; // Simplistic "used" visualization

    rows.push(
      <div 
        key={addr} 
        className={`flex justify-between items-center text-sm p-1 px-2 border-b border-gray-700 ${isSp ? 'bg-yellow-900/40' : (isUsed ? 'bg-blue-900/20' : 'transparent')}`}
      >
        <span className={`font-mono ${isSp ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>
          {addr.toString(16).toUpperCase().padStart(4, '0')}
        </span>
        <div className="flex items-center gap-3">
            {isSp && <span className="text-[10px] text-yellow-500 font-bold tracking-tighter">← SP</span>}
            <span className={`font-mono font-bold ${val !== 0 ? 'text-white' : 'text-gray-600'}`}>
            {val.toString(16).toUpperCase().padStart(2, '0')}H
            </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-gray-700 p-4 shadow-xl h-full flex flex-col">
       <h3 className="text-retro-text font-bold mb-3 border-b border-gray-700 pb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Stack Hafızası
      </h3>
      <div className="flex-1 overflow-y-auto bg-retro-panel rounded border border-gray-700 font-mono">
        {rows}
        <div className="p-2 text-center text-xs text-gray-600 italic">
            ... Alt adresler ...
        </div>
      </div>
      <div className="mt-2 text-[10px] text-gray-500">
        * Stack aşağıya doğru büyür (Push: SP-2)
      </div>
    </div>
  );
};
