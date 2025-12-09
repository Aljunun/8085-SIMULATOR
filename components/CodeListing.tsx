import React, { useEffect, useRef } from 'react';
import { InstructionStep } from '../types';

interface CodeListingProps {
  program: InstructionStep[];
  currentStepIndex: number;
}

export const CodeListing: React.FC<CodeListingProps> = ({ program, currentStepIndex }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStepIndex]);

  if (program.length === 0) {
      return (
        <div className="bg-[#1e1e1e] rounded-lg border border-gray-700 p-4 shadow-xl h-96 flex items-center justify-center text-gray-500">
            Kod oluşturmak için bir sayı girip "Başlat"a basın.
        </div>
      )
  }

  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-gray-700 p-4 shadow-xl flex flex-col h-[500px]">
       <h3 className="text-retro-text font-bold mb-3 border-b border-gray-700 pb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
        Assembly Kodu
      </h3>
      <div className="flex-1 overflow-y-auto bg-retro-panel rounded border border-gray-700 font-mono relative" ref={scrollRef}>
        <table className="w-full text-left text-sm">
            <thead className="bg-gray-800 text-gray-400 sticky top-0 z-10 text-xs uppercase">
                <tr>
                    <th className="p-2 pl-3 w-16">Addr</th>
                    <th className="p-2">Instruction</th>
                    <th className="p-2 hidden sm:table-cell">Açıklama</th>
                </tr>
            </thead>
            <tbody>
                {program.map((step, idx) => {
                    const isActive = idx === currentStepIndex;
                    return (
                        <tr 
                            key={idx} 
                            data-active={isActive}
                            className={`border-b border-gray-700/50 transition-colors ${isActive ? 'bg-blue-900/40' : 'hover:bg-gray-700/30'}`}
                        >
                            <td className={`p-2 pl-3 font-mono text-xs ${isActive ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>
                                {step.address.toString(16).toUpperCase()}H
                            </td>
                            <td className="p-2 font-mono text-green-400 font-medium">
                                {isActive && <span className="absolute left-0 text-blue-500 -ml-1">▶</span>}
                                {step.code}
                            </td>
                            <td className="p-2 text-gray-400 text-xs italic hidden sm:table-cell truncate max-w-[200px]">
                                {step.description}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};
