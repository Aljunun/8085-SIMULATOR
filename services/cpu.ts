import { CpuState, InstructionStep, SimulationProgram, MachineCycle } from '../types';

// Helper to format hex
const toHex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const toHex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

export const INITIAL_STATE: CpuState = {
  registers: { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, SP: 0xFFFF, PC: 0x2000 },
  flags: { S: false, Z: false, AC: false, P: false, CY: false },
  memory: new Map(),
  outputBuffer: [],
  ports: { 1: 0, 2: 0 },
  matrixText: "  "
};

// Helper to infer machine cycles from opcode
const inferCycles = (code: string): MachineCycle[] => {
  const opcode = code.split(' ')[0];
  
  if (opcode === 'LXI') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_READ', tStates: 3 }
    ];
  } else if (opcode === 'MVI') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 }
    ];
  } else if (opcode === 'MOV' || opcode === 'RRC' || opcode === 'ADC' || opcode === 'DCR' || opcode === 'INR' || opcode === 'EI' || opcode === 'DI') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 }
    ];
  } else if (opcode === 'PUSH') {
    return [
      { type: 'OPCODE_FETCH', tStates: 6 },
      { type: 'MEMORY_WRITE', tStates: 3 },
      { type: 'MEMORY_WRITE', tStates: 3 }
    ];
  } else if (opcode === 'POP') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_READ', tStates: 3 }
    ];
  } else if (opcode === 'OUT') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'IO_WRITE', tStates: 3 }
    ];
  } else if (opcode === 'HLT') {
    return [
      { type: 'OPCODE_FETCH', tStates: 5 }
    ];
  } else if (opcode === 'JMP' || opcode === 'JNZ' || opcode === 'JC') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_READ', tStates: 3 }
    ];
  } else if (opcode === 'CALL') {
    return [
      { type: 'OPCODE_FETCH', tStates: 6 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_WRITE', tStates: 3 },
      { type: 'MEMORY_WRITE', tStates: 3 }
    ];
  } else if (opcode === 'RET') {
    return [
      { type: 'OPCODE_FETCH', tStates: 4 },
      { type: 'MEMORY_READ', tStates: 3 },
      { type: 'MEMORY_READ', tStates: 3 }
    ];
  }
  
  // Default fallback
  return [{ type: 'OPCODE_FETCH', tStates: 4 }];
};

// --- BASE GENERATOR ---
const createProgramBuilder = (startPc: number = 0x2000) => {
  const steps: InstructionStep[] = [];
  let currentPc = startPc;

  const addStep = (code: string, desc: string, exec: (s: CpuState) => Partial<CpuState>, fixedBytes?: number) => {
    const bytes = fixedBytes || ((code.includes('LXI') || code.includes('STA') || code.includes('JNZ') || code.includes('JMP') || code.includes('CALL')) ? 3 : (code.includes('MVI') || code.includes('OUT')) ? 2 : 1);
    
    steps.push({
      address: currentPc,
      code,
      description: desc,
      cycles: inferCycles(code),
      execute: (prev) => {
        const changes = exec(prev);
        // Default PC increment if not specified in changes (JMP/CALL would specify it)
        const nextPc = changes.registers?.PC !== undefined ? changes.registers.PC : currentPc + bytes;
        
        return {
          ...prev,
          ...changes,
          registers: { ...prev.registers, ...changes.registers, PC: nextPc },
          flags: { ...prev.flags, ...changes.flags },
          memory: changes.memory || prev.memory,
          outputBuffer: changes.outputBuffer || prev.outputBuffer,
          ports: { ...prev.ports, ...(changes.ports || {}) },
          matrixText: changes.matrixText !== undefined ? changes.matrixText : prev.matrixText
        };
      }
    });
    currentPc += bytes;
  };
  
  return { steps, addStep, getCurrentPc: () => currentPc, setCurrentPc: (pc: number) => currentPc = pc };
};

// 1. DECIMAL -> BINARY CONVERSION PROGRAM
export const generateConversionProgram = (inputValue: number): SimulationProgram => {
  const { steps, addStep } = createProgramBuilder(0x2000);

  // 1. Initialize Stack Pointer
  addStep('LXI SP, FFFFH', 'Stack Pointer\'ı FFFFH adresine ayarla', (s) => ({
    registers: { ...s.registers, SP: 0xFFFF }
  }));

  // 2. Load Input Value
  addStep(`MVI A, ${toHex2(inputValue)}H`, `Giriş değerini (${inputValue}) Akümülatör'e yükle`, (s) => ({
    registers: { ...s.registers, A: inputValue }
  }));

  // 3. Save Copy in D
  addStep('MOV D, A', 'Orijinal sayıyı D registerında sakla', (s) => ({
    registers: { ...s.registers, D: s.registers.A }
  }));

  // 4. Set Loop Counter
  addStep('MVI C, 08H', 'Döngü sayacını (C) 8 bit için ayarla', (s) => ({
    registers: { ...s.registers, C: 8 }
  }));

  // LOOP
  for (let i = 0; i < 8; i++) {
    addStep('RRC', 'Bitleri sağa kaydır. LSB -> Carry', (s) => {
      const a = s.registers.A;
      const lsb = a & 1;
      const newA = (a >> 1) | (lsb << 7);
      return { registers: { ...s.registers, A: newA }, flags: { ...s.flags, CY: lsb === 1 } };
    });

    addStep('MOV H, A', 'A\'yı H\'de sakla', (s) => ({ registers: { ...s.registers, H: s.registers.A } }));
    addStep('MVI B, 00H', 'B\'yi sıfırla', (s) => ({ registers: { ...s.registers, B: 0 } }));

    addStep('ADC B', 'Carry varsa B=1 yap', (s) => {
       const bit = s.flags.CY ? 1 : 0;
       return { registers: { ...s.registers, B: bit } };
    });
    
    addStep('MOV A, H', 'A\'yı geri yükle', (s) => ({ registers: { ...s.registers, A: s.registers.H } }));

    addStep('PUSH B', 'Biti (B) ve Sayacı (C) Stack\'e at', (s) => {
      const sp = s.registers.SP;
      const b = s.registers.B;
      const c = s.registers.C;
      const newMemory = new Map(s.memory);
      newMemory.set(sp - 1, b);
      newMemory.set(sp - 2, c);
      return { registers: { ...s.registers, SP: sp - 2 }, memory: newMemory };
    });

    addStep('DCR C', 'Sayacı azalt', (s) => {
        const newC = s.registers.C - 1;
        return { registers: { ...s.registers, C: newC }, flags: { ...s.flags, Z: newC === 0 } };
    });
  }

  addStep('MVI E, 08H', 'Çıktı sayacını ayarla', (s) => ({ registers: { ...s.registers, E: 8 } }));

  for (let i = 0; i < 8; i++) {
     addStep('POP B', 'Stack\'ten biti çek', (s) => {
        const sp = s.registers.SP;
        const low = s.memory.get(sp) || 0;
        const high = s.memory.get(sp + 1) || 0;
        return { registers: { ...s.registers, B: high, C: low, SP: sp + 2 } };
     });
     
     addStep('OUT 01H', 'Biti yazdır', (s) => ({
         outputBuffer: [...s.outputBuffer, s.registers.B.toString()],
         ports: { ...s.ports, 1: s.registers.B } // Also update port 1
     }));
     
     addStep('DCR E', 'Çıktı sayacını azalt', (s) => {
         const newE = s.registers.E - 1;
         return { registers: { ...s.registers, E: newE }, flags: { ...s.flags, Z: newE === 0 } };
     });
  }

  addStep('HLT', 'Program sonu', (s) => ({}));

  return { steps, programType: 'conversion' };
};

// 2. COUNTER + INTERRUPT (RST 7.5) PROGRAM
export const generateCounterProgram = (): SimulationProgram => {
  const { steps, addStep, setCurrentPc } = createProgramBuilder(0x2000);

  // --- MAIN LOOP ---
  // 2000: MVI A, 00H
  addStep('MVI A, 00H', 'Sayacı Başlat (A = 0)', (s) => ({
      registers: { ...s.registers, A: 0 }
  }));

  // 2002: OUT 01H
  const loopAddr = 0x2002;
  setCurrentPc(loopAddr);
  addStep('OUT 01H', 'LED\'leri Güncelle', (s) => ({
      ports: { ...s.ports, 1: s.registers.A }
  }));

  // 2004: INR A
  addStep('INR A', 'Sayacı 1 artır', (s) => ({
      registers: { ...s.registers, A: (s.registers.A + 1) & 0xFF }
  }));

  // 2005: JMP 2002H
  addStep('JMP 2002H', 'Başa dön (Sonsuz Döngü)', (s) => ({
      registers: { ...s.registers, PC: loopAddr }
  }));

  // --- ISR (RST 7.5 @ 003CH) ---
  setCurrentPc(0x003C);
  
  // 003C: PUSH PSW
  addStep('PUSH PSW', 'Durumu (A ve Flags) sakla', (s) => {
      const sp = s.registers.SP;
      // Simplified PUSH PSW: just pushing A and F dummy
      const newMemory = new Map(s.memory);
      newMemory.set(sp - 1, s.registers.A);
      newMemory.set(sp - 2, 0); // Flags...
      return { registers: { ...s.registers, SP: sp - 2 }, memory: newMemory };
  });

  // 003D: CALL DISPLAY_ROUTINE
  addStep('CALL 0050H', 'Ekrana yazdırma alt programını çağır', (s) => {
       const sp = s.registers.SP;
       const retAddr = 0x0040; // Address after CALL
       const newMemory = new Map(s.memory);
       newMemory.set(sp - 1, (retAddr >> 8) & 0xFF);
       newMemory.set(sp - 2, retAddr & 0xFF);
       return { registers: { ...s.registers, SP: sp - 2, PC: 0x0050 }, memory: newMemory };
  });

  // 0040: POP PSW
  setCurrentPc(0x0040);
  addStep('POP PSW', 'Eski durumu geri yükle', (s) => {
      const sp = s.registers.SP;
      const a = s.memory.get(sp + 1) || 0;
      return { registers: { ...s.registers, A: a, SP: sp + 2 } };
  });

  // 0041: EI
  addStep('EI', 'Kesmeleri tekrar aç', (s) => ({}));

  // 0042: RET
  addStep('RET', 'Ana programa dön', (s) => {
      const sp = s.registers.SP;
      const low = s.memory.get(sp) || 0;
      const high = s.memory.get(sp + 1) || 0;
      const retAddr = (high << 8) | low;
      return { registers: { ...s.registers, PC: retAddr, SP: sp + 2 } };
  });

  // --- DISPLAY SUBROUTINE (0050H) ---
  setCurrentPc(0x0050);
  
  // This is a "Pseudo-Instruction" block to simulate complex scrolling logic easily
  // In real 8085, this would be a loop of MVI char, OUT port, CALL Delay...
  addStep('SCROLL HEX', 'Değeri kayan yazı olarak göster (DEGER: XX)', (s) => {
      const val = s.registers.A;
      const hex = toHex2(val);
      const msg = `DEGER: ${hex}`;
      return { matrixText: msg };
  });

  // 0052: RET
  setCurrentPc(0x0053); // SCROLL assumed 3 bytes
  addStep('RET', 'Alt programdan dön', (s) => {
      const sp = s.registers.SP;
      const low = s.memory.get(sp) || 0;
      const high = s.memory.get(sp + 1) || 0;
      const retAddr = (high << 8) | low;
      return { registers: { ...s.registers, PC: retAddr, SP: sp + 2 }, matrixText: "  " }; // Clear text on return? Or keep it? Let's clear to indicate done
  });

  return { steps, programType: 'counter' };
};
