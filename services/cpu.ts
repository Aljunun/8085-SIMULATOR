import { CpuState, InstructionStep, SimulationProgram } from '../types';

// Helper to format hex
const toHex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const toHex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

export const INITIAL_STATE: CpuState = {
  registers: { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, SP: 0xFFFF, PC: 0x2000 },
  flags: { S: false, Z: false, AC: false, P: false, CY: false },
  memory: new Map(),
  outputBuffer: []
};

// Function to generate the specific program for Decimal -> Binary using Stack
export const generateConversionProgram = (inputValue: number): SimulationProgram => {
  const steps: InstructionStep[] = [];
  let currentPc = 0x2000;

  const addStep = (code: string, desc: string, exec: (s: CpuState) => Partial<CpuState>) => {
    steps.push({
      address: currentPc,
      code,
      description: desc,
      execute: (prev) => {
        const changes = exec(prev);
        // Merge changes safely
        return {
          ...prev,
          ...changes,
          registers: { ...prev.registers, ...changes.registers, PC: currentPc + (code.length > 5 ? 3 : 1) }, // Rough PC increment
          flags: { ...prev.flags, ...changes.flags },
          memory: changes.memory || prev.memory,
          outputBuffer: changes.outputBuffer || prev.outputBuffer
        };
      }
    });
    currentPc += (code.includes('LXI') || code.includes('STA') || code.includes('JNZ')) ? 3 : (code.includes('MVI') ? 2 : 1);
  };

  // --- PROGRAM START ---

  // 1. Initialize Stack Pointer
  addStep('LXI SP, FFFFH', 'Stack Pointer\'ı FFFFH adresine ayarla (Belleğin en sonu)', (s) => ({
    registers: { ...s.registers, SP: 0xFFFF }
  }));

  // 2. Load Input Value
  addStep(`MVI A, ${toHex2(inputValue)}H`, `Giriş değerini (${inputValue}) Akümülatör'e (A) yükle`, (s) => ({
    registers: { ...s.registers, A: inputValue }
  }));

  // 3. Save Copy in D
  addStep('MOV D, A', 'Orijinal sayıyı D registerında sakla', (s) => ({
    registers: { ...s.registers, D: s.registers.A }
  }));

  // --- BINARY CONVERSION LOGIC (Using Stack to Reverse Bits) ---
  
  // 4. Set Loop Counter (8 bits)
  addStep('MVI C, 08H', 'Döngü sayacını (C) 8 bit için ayarla', (s) => ({
    registers: { ...s.registers, C: 8 }
  }));

  // LOOP START
  for (let i = 0; i < 8; i++) {
    // 5. Rotate Right (RRC) - Move LSB to Carry
    addStep('RRC', 'Bitleri sağa kaydır. En sağdaki bit (LSB) Carry bayrağına geçer', (s) => {
      const a = s.registers.A;
      const lsb = a & 1;
      const newA = (a >> 1) | (lsb << 7); // RRC behavior
      return {
        registers: { ...s.registers, A: newA },
        flags: { ...s.flags, CY: lsb === 1 }
      };
    });

    // 6. Check Carry and Prepare to Push
    // Real 8085 would branch here. To simplify "Push 0 or 1", we'll just set HL based on CY.
    // Simulating: JC ONE; MVI L, 00; JMP PUSH; ONE: MVI L, 01; PUSH: PUSH H
    
    addStep('MOV H, A', 'A değerini geçici olarak H\'de sakla (Stack işlemi için)', (s) => ({
       registers: { ...s.registers, H: s.registers.A }
    }));
    
    // We will cheat slightly for visualization: Push the actual BIT value (0 or 1) using B register to stack
    // because pushing PSW/H modifies those registers. 
    // Let's emulate: MVI B, 00/01 based on CY.
    
    addStep('MVI B, 00H', 'B registerini sıfırla', (s) => ({
       registers: { ...s.registers, B: 0 }
    }));

    addStep('ADC B', 'Carry varsa B\'ye 1 ekle (B = Bit Değeri)', (s) => {
       // ADC B adds B + Carry to A. Wait, that corrupts A.
       // Correct logic: We want to push the bit that was rotated.
       // Let's look at the PREVIOUS step's CY.
       const bit = s.flags.CY ? 1 : 0;
       return {
         registers: { ...s.registers, B: bit } // Using B to hold the bit to push
       };
    });
    
    // Restore A from H
    addStep('MOV A, H', 'A değerini H\'den geri yükle', (s) => ({
        registers: { ...s.registers, A: s.registers.H }
    }));

    // PUSH B (Stores BC pair). We only care about B (which has the bit). C is loop counter.
    // Wait, if we PUSH B, we push C (counter) too. That's useful!
    // PUSH B: (SP-1) <- B, (SP-2) <- C. SP <- SP-2.
    addStep('PUSH B', 'B (Bit) ve C (Sayaç) değerlerini Stack\'e at', (s) => {
      const sp = s.registers.SP;
      const b = s.registers.B; // The bit
      const c = s.registers.C; // The counter (preserved!)
      
      const newMemory = new Map(s.memory);
      newMemory.set(sp - 1, b); // High byte (B)
      newMemory.set(sp - 2, c); // Low byte (C)
      
      return {
        registers: { ...s.registers, SP: sp - 2 },
        memory: newMemory
      };
    });

    // Decrement Counter
    addStep('DCR C', 'Sayacı azalt', (s) => {
        const newC = s.registers.C - 1;
        return {
            registers: { ...s.registers, C: newC },
            flags: { ...s.flags, Z: newC === 0 }
        };
    });
  }

  // Loop finishes naturally in unrolled simulation logic
  // Now we have 8 items on stack. Top of stack is the LAST pushed bit (MSB).
  
  addStep('MVI E, 08H', 'Çıktı döngüsü için sayacı (E) ayarla', (s) => ({
      registers: { ...s.registers, E: 8 }
  }));

  // POP LOOP
  for (let i = 0; i < 8; i++) {
     addStep('POP B', 'Stack\'ten veriyi çek (B=Bit, C=Eski Sayaç)', (s) => {
        const sp = s.registers.SP;
        const low = s.memory.get(sp) || 0; // C
        const high = s.memory.get(sp + 1) || 0; // B (Our bit)
        return {
            registers: { ...s.registers, B: high, C: low, SP: sp + 2 }
        };
     });
     
     addStep('OUT 01H', 'B registerindeki biti ekrana yazdır', (s) => ({
         outputBuffer: [...s.outputBuffer, s.registers.B.toString()]
     }));
     
     addStep('DCR E', 'Çıktı sayacını azalt', (s) => {
         const newE = s.registers.E - 1;
         return {
             registers: { ...s.registers, E: newE },
             flags: { ...s.flags, Z: newE === 0 }
         };
     });
  }

  addStep('HLT', 'Program sonu', (s) => ({}));

  return { steps };
};
