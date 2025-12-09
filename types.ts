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
  outputBuffer: string[]; // For simulation output
}

export interface InstructionStep {
  address: number;
  code: string;
  description: string;
  execute: (prevState: CpuState) => CpuState;
}

export interface SimulationProgram {
  steps: InstructionStep[];
}
