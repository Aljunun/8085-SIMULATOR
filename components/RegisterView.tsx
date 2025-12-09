import React from 'react';
import { Registers, Flags } from '../types';

interface RegisterViewProps {
  registers: Registers;
  flags: Flags;
}

const RegBox = ({ name, val, hexColor = "text-yellow-400" }: { name: string, val: number, hexColor?: string }) => (
  <div className="bg-retro-panel border border-gray-700 p-2 rounded flex flex-col items-center min-w-[3.5rem]">
    <span className="text-gray-400 text-xs font-bold mb-1">{name}</span>
    <span className={`font-mono text-lg font-bold ${hexColor}`}>
      {val.toString(16).toUpperCase().padStart(2, '0')}H
    </span>
    <span className="text-gray-500 text-[10px] font-mono mt-1">
      {val.toString().padStart(3, '0')}
    </span>
  </div>
);

const FlagBox = ({ name, val }: { name: string, val: boolean }) => (
    <div className={`flex flex-col items-center p-1 rounded border ${val ? 'bg-green-900/30 border-green-500/50' : 'bg-gray-800 border-gray-700'}`}>
        <span className="text-[10px] text-gray-400 font-bold">{name}</span>
        <div className={`w-3 h-3 rounded-full mt-1 ${val ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-gray-600'}`}></div>
    </div>
);

export const RegisterView: React.FC<RegisterViewProps> = ({ registers, flags }) => {
  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-gray-700 p-4 shadow-xl">
      <h3 className="text-retro-text font-bold mb-3 border-b border-gray-700 pb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M15 9h.01"/><path d="M9 15h.01"/><path d="M9 9h.01"/><path d="M15 15h.01"/></svg>
        Registerlar
      </h3>
      
      <div className="grid grid-cols-4 gap-3 mb-4">
        <RegBox name="A" val={registers.A} hexColor="text-blue-400" />
        <RegBox name="B" val={registers.B} />
        <RegBox name="C" val={registers.C} />
        <RegBox name="D" val={registers.D} />
        <RegBox name="E" val={registers.E} />
        <RegBox name="H" val={registers.H} />
        <RegBox name="L" val={registers.L} />
      </div>

      <div className="flex gap-4 mb-4">
        <div className="bg-retro-panel border border-gray-700 p-2 rounded flex flex-col items-center flex-1">
            <span className="text-gray-400 text-xs font-bold mb-1">PC (Program Counter)</span>
            <span className="font-mono text-lg text-purple-400 font-bold">
                {registers.PC.toString(16).toUpperCase().padStart(4, '0')}H
            </span>
        </div>
        <div className="bg-retro-panel border border-gray-700 p-2 rounded flex flex-col items-center flex-1">
            <span className="text-gray-400 text-xs font-bold mb-1">SP (Stack Pointer)</span>
            <span className="font-mono text-lg text-orange-400 font-bold">
                {registers.SP.toString(16).toUpperCase().padStart(4, '0')}H
            </span>
        </div>
      </div>

      <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Flags (Bayraklar)</h4>
      <div className="flex justify-between bg-retro-panel p-2 rounded border border-gray-700">
          <FlagBox name="S" val={flags.S} />
          <FlagBox name="Z" val={flags.Z} />
          <FlagBox name="AC" val={flags.AC} />
          <FlagBox name="P" val={flags.P} />
          <FlagBox name="CY" val={flags.CY} />
      </div>
    </div>
  );
};
