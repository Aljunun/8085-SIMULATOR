import React from 'react';

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
  // Convert value to string and map to columns
  // For simplicity, we just show the first 2 chars if it's > 9
  const text = value.toString().padStart(2, ' ').slice(-2);
  
  // Create an empty 8x16 grid (2 chars side by side)
  // But wait, user asked for Matrix LED. Let's do a single 8x8 or 8x16 module.
  // 8x8 is standard for learning kits. Let's do 8 rows, 16 columns (2 digits).
  
  const getCols = (char: string) => FONT[char] || FONT[' '];
  
  const cols1 = getCols(text[0]);
  const cols2 = getCols(text[1]);
  
  // Combine columns with a spacer
  const allCols = [...cols1, 0x00, ...cols2]; // 5 + 1 + 5 = 11 cols. We have space for more.
  
  // Render grid
  // Rows: 0-7. Cols: 0-15.
  const renderGrid = () => {
    const grid = [];
    for (let r = 0; r < 7; r++) { // 7 rows
      const rowDots = [];
      for (let c = 0; c < 12; c++) { // 12 cols
        const colData = allCols[c] || 0;
        // Check if bit r is set in colData. Top bit is LSB or MSB?
        // Font map: 0x3E = 0011 1110. Let's say LSB is top.
        const isActive = (colData >> r) & 1;
        
        rowDots.push(
          <div 
            key={`${r}-${c}`} 
            className={`led-matrix-dot ${isActive ? 'on' : ''}`}
          />
        );
      }
      grid.push(<div key={r} className="flex gap-1">{rowDots}</div>);
    }
    return grid;
  };

  return (
    <div className="bg-black p-2 border-4 border-gray-800 inline-block shadow-lg">
      <div className="flex flex-col gap-1">
        {renderGrid()}
      </div>
      <div className="text-center text-gray-500 text-[10px] mt-1 font-mono uppercase tracking-widest">
        8x12 Matrix
      </div>
    </div>
  );
};
