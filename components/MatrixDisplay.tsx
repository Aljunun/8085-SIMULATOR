import React, { useState, useEffect, useMemo } from 'react';

// 5x7 Font for digits 0-9 and Hex A-F
const FONT: Record<string, number[]> = {
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
  '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
  'A': [0x7E, 0x09, 0x09, 0x09, 0x7E],
  'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
  'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
};

interface MatrixDisplayProps {
  value: string; // The decimal value or text to display
}

export const MatrixDisplay: React.FC<MatrixDisplayProps> = ({ value }) => {
  const [offset, setOffset] = useState(0);
  const DISPLAY_WIDTH = 16; // Wider display for better scrolling effect

  // Generate the full pixel buffer from the input string
  const fullBuffer = useMemo(() => {
    const getCols = (char: string) => FONT[char.toUpperCase()] || FONT[' '];
    let cols: number[] = [];
    
    // Add initial padding
    cols = [...Array(DISPLAY_WIDTH).fill(0)];
    
    // Add characters
    value.split('').forEach(char => {
      cols = [...cols, ...getCols(char), 0x00]; // Char + 1px spacing
    });
    
    // Add trailing padding
    cols = [...cols, ...Array(DISPLAY_WIDTH).fill(0)];
    
    return cols;
  }, [value]);

  // Animation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setOffset(prev => {
        const maxOffset = fullBuffer.length - DISPLAY_WIDTH;
        return prev >= maxOffset ? 0 : prev + 1;
      });
    }, 80); // Speed of scrolling

    return () => clearInterval(timer);
  }, [fullBuffer]);

  // If value changes, reset offset slightly to ensure we see the new value come in
  useEffect(() => {
    setOffset(0);
  }, [value]);

  const renderGrid = () => {
    const grid = [];
    const visibleCols = fullBuffer.slice(offset, offset + DISPLAY_WIDTH);

    // If for some reason visibleCols is short (shouldn't happen due to logic), pad it
    while (visibleCols.length < DISPLAY_WIDTH) visibleCols.push(0);

    for (let r = 0; r < 7; r++) { // 7 rows
      const rowDots = [];
      for (let c = 0; c < DISPLAY_WIDTH; c++) {
        const colData = visibleCols[c];
        // Check bit r
        const isActive = (colData >> r) & 1;
        
        rowDots.push(
          <div 
            key={`${r}-${c}`} 
            className={`w-2 h-2 rounded-full transition-colors duration-75 ${
              isActive 
                ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,1)]' 
                : 'bg-red-950/30'
            }`}
          />
        );
      }
      grid.push(<div key={r} className="flex gap-1">{rowDots}</div>);
    }
    return grid;
  };

  return (
    <div className="bg-black p-3 border-2 border-gray-700 rounded inline-block shadow-2xl relative overflow-hidden group">
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10 rounded"></div>
      
      <div className="flex flex-col gap-1 relative z-0">
        {renderGrid()}
      </div>
      
      <div className="flex justify-between items-center mt-2 border-t border-gray-800 pt-1">
         <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">
            SCROLL MATRIX
         </div>
         <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></div>
      </div>
    </div>
  );
};
