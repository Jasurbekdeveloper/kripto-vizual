/**
 * Vizual bloklar — har bir qadamda ko'rsatiladigan elementlar.
 * Yangi vizual tur kerak bo'lsa: shu yerga qo'shing va VisualComponent'da chizing.
 */
export type Visual =
  | { kind: 'kv'; items: { label: string; value: string; hl?: boolean }[] }
  | { kind: 'table'; caption?: string; headers: string[]; rows: (string | number)[][]; hlRows?: number[]; hlCells?: [number, number][] }
  | { kind: 'grids'; items: GridItem[]; ops?: string[] }
  | { kind: 'bytes'; title?: string; bytes: string[]; hl?: number[]; labels?: string[] }
  | { kind: 'bits'; rows: { label: string; bits: string; hl?: number[]; sep?: boolean }[] }
  | { kind: 'formula'; text: string }
  | { kind: 'note'; text: string; tone?: 'info' | 'ok' | 'warn' }
  | { kind: 'flow'; nodes: string[]; active?: number }
  | { kind: 'chars'; rows: { label: string; chars: string[]; hl?: number[] }[] }
  | { kind: 'plot'; title?: string; p: number; points: [number, number][]; hl?: [number, number][]; line?: [[number, number], [number, number]] };

export interface GridItem {
  title: string;
  cells: string[][];
  hl?: [number, number][];
  tone?: 'blue' | 'green' | 'orange' | 'purple' | 'gray';
}

export interface Step {
  title: string;
  text?: string;
  visuals: Visual[];
}

export interface RunResult {
  steps: Step[];
  output: { label: string; value: string }[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  default: string;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface AlgorithmDef {
  /** URL'da ishlatiladigan noyob nom, masalan 'aes-128' */
  id: string;
  /** Fan mavzusi raqami (1..12) */
  topic: number;
  name: string;
  short: string;
  /** Qisqa nazariya — paragraflar */
  theory: string[];
  formulas?: string[];
  fields: FieldDef[];
  examples?: { label: string; values: Record<string, string> }[];
  run(values: Record<string, string>): RunResult;
}

export interface Topic {
  n: number;
  title: string;
  kind: 'M' | 'A';
}
