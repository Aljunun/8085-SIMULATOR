export interface Registers {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  H: number;
  L: number;
  SP: number; // Stack Pointer
  PC: number; // Program Counter
}

export interface Flags {
  S: boolean;  // Sign
  Z: boolean;  // Zero
  AC: boolean; // Auxiliary Carry
  P: boolean;  // Parity
  CY: boolean; // Carry
}

export interface CpuState {
  registers: Registers;
  flags: Flags;
  memory: Map<number, number>; // Address -> Value
  outputBuffer: string[]; // Keep for legacy compatibility/logging
  ports: Record<number, number>; // New: State of I/O ports. Port 1 = LEDs, Port 2 = Matrix
  matrixText: string; // Special field for Matrix Display text
}

export type MachineCycleType = 'OPCODE_FETCH' | 'MEMORY_READ' | 'MEMORY_WRITE' | 'IO_READ' | 'IO_WRITE';

export interface MachineCycle {
  type: MachineCycleType;
  tStates: number;
}

export interface InstructionStep {
  address: number;
  code: string;
  description: string;
  cycles: MachineCycle[];
  execute: (prevState: CpuState) => CpuState;
}

export interface SimulationProgram {
  steps: InstructionStep[];
  programType: 'conversion' | 'counter'; // To help UI decide what to show
}
