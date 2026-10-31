import { AlgorithmDef, Step, Visual } from '../core/models';
import { int, modn, val } from '../core/util';

/* ---------------------------------------------------------------
 * 9-, 10-MAVZULAR: Elliptik egri chiziqlar (GF(p) ustida)
 * y² = x³ + a·x + b (mod p)
 * ------------------------------------------------------------- */

export type Pt = [number, number] | null; // null = cheksiz nuqta O
export const show = (P: Pt): string => (P ? `(${P[0]}, ${P[1]})` : 'O');

function inv(a: number, p: number): number {
  a = modn(a, p);
  for (let x = 1; x < p; x++) if ((a * x) % p === 1) return x;
  throw new Error(`${a}⁻¹ mod ${p} mavjud emas`);
}

export class Curve {
  constructor(public a: number, public b: number, public p: number) {
    if (p < 3 || p > 2000) throw new Error('p 3..2000 oralig‘ida bo‘lsin (vizual hisoblash uchun)');
    for (let d = 2; d * d <= p; d++) if (p % d === 0) throw new Error('p tub son bo‘lishi kerak');
    if (modn(4 * a ** 3 + 27 * b ** 2, p) === 0) throw new Error('4a³ + 27b² ≡ 0 (mod p) — egri chiziq singulyar');
  }
  on(P: Pt): boolean { return !P || modn(P[1] ** 2 - (P[0] ** 3 + this.a * P[0] + this.b), this.p) === 0; }
  points(): [number, number][] {
    const out: [number, number][] = [];
    for (let x = 0; x < this.p; x++) for (let y = 0; y < this.p; y++) if (modn(y * y - (x * x * x + this.a * x + this.b), this.p) === 0) out.push([x, y]);
    return out;
  }
  /** Qo'shish — izohli qadamlar bilan */
  add(P: Pt, Q: Pt, notes?: string[]): Pt {
    const p = this.p;
    if (!P) { notes?.push(`O + Q = Q`); return Q; }
    if (!Q) { notes?.push(`P + O = P`); return P; }
    if (P[0] === Q[0] && modn(P[1] + Q[1], p) === 0) { notes?.push(`x₁ = x₂ va y₁ = −y₂ ⇒ P + Q = O`); return null; }
    let lam: number;
    if (P[0] === Q[0] && P[1] === Q[1]) {
      const num = modn(3 * P[0] * P[0] + this.a, p), den = modn(2 * P[1], p), di = inv(den, p);
      lam = modn(num * di, p);
      notes?.push(`λ = (3x₁² + a)/(2y₁) = (3·${P[0]}² + ${this.a})/(2·${P[1]}) = ${num}·${den}⁻¹ = ${num}·${di} ≡ ${lam} (mod ${p})`);
    } else {
      const num = modn(Q[1] - P[1], p), den = modn(Q[0] - P[0], p), di = inv(den, p);
      lam = modn(num * di, p);
      notes?.push(`λ = (y₂ − y₁)/(x₂ − x₁) = (${Q[1]} − ${P[1]})/(${Q[0]} − ${P[0]}) = ${num}·${den}⁻¹ = ${num}·${di} ≡ ${lam} (mod ${p})`);
    }
    const x3 = modn(lam * lam - P[0] - Q[0], p);
    const y3 = modn(lam * (P[0] - x3) - P[1], p);
    notes?.push(`x₃ = λ² − x₁ − x₂ = ${lam}² − ${P[0]} − ${Q[0]} ≡ ${x3} (mod ${p})`);
    notes?.push(`y₃ = λ(x₁ − x₃) − y₁ = ${lam}·(${P[0]} − ${x3}) − ${P[1]} ≡ ${y3} (mod ${p})`);
    return [x3, y3];
  }
}

const curveFields = [
  { key: 'a', label: 'a', type: 'number' as const, default: '2' },
  { key: 'b', label: 'b', type: 'number' as const, default: '2' },
  { key: 'p', label: 'p (tub)', type: 'number' as const, default: '17' },
];
const pt = (s: string, name: string): Pt => {
  const m = s.replace(/[()\s]/g, '').split(',');
  if (m.length !== 2 || m.some((x) => !/^-?\d+$/.test(x))) throw new Error(`${name}: (x, y) ko‘rinishida kiriting`);
  return [Number(m[0]), Number(m[1])];
};

function curveStep(c: Curve, hl: Pt[] = []): Step {
  const pts = c.points();
  return {
    title: 'Egri chiziq nuqtalari',
    text: `E: y² = x³ + ${c.a}x + ${c.b} (mod ${c.p}). Nuqtalar soni: ${pts.length} + O = ${pts.length + 1}.`,
    visuals: [
      { kind: 'formula', text: `4a³ + 27b² = ${4 * c.a ** 3 + 27 * c.b ** 2} ≢ 0 (mod ${c.p}) — singulyar emas ✓` },
      { kind: 'plot', p: c.p, points: pts, hl: hl.filter((x): x is [number, number] => !!x) },
    ],
  };
}

export const eccArith: AlgorithmDef = {
  id: 'ecc', topic: 9, name: 'Elliptik egri chiziqda nuqtalar arifmetikasi',
  short: 'P + Q, 2P va n·P (Double-and-Add) — GF(p) ustida',
  theory: [
    'E: y² = x³ + ax + b (mod p), shart 4a³ + 27b² ≢ 0. Cheksiz nuqta O — neytral element. −P = (x, −y).',
    'Skalyar ko‘paytma n·P Double-and-Add bilan: n ning har biti uchun ikkilantirish, “1” bitda qo‘shish.',
    'ECDLP: Q = n·P berilganda n ni topish amalda imkonsiz — ECC xavfsizligining asosi.',
  ],
  formulas: ['P≠Q: λ = (y₂−y₁)/(x₂−x₁)', 'P=Q: λ = (3x₁²+a)/(2y₁)', 'x₃ = λ² − x₁ − x₂', 'y₃ = λ(x₁ − x₃) − y₁'],
  fields: [
    { key: 'op', label: 'Amal', type: 'select', default: 'mul', options: [{ value: 'add', label: 'P + Q' }, { value: 'dbl', label: '2P' }, { value: 'mul', label: 'n·P' }] },
    ...curveFields,
    { key: 'P', label: 'P = (x, y)', type: 'text', default: '(5, 1)' },
    { key: 'Q', label: 'Q = (x, y)', type: 'text', default: '(6, 3)' },
    { key: 'n', label: 'n', type: 'number', default: '9' },
  ],
  examples: [{ label: '(5,1) + (6,3)', values: { op: 'add', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(6,3)', n: '1' } }, { label: '2·(5,1)', values: { op: 'dbl', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(0,0)', n: '2' } }],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const P = pt(val(v, 'P'), 'P');
    if (!c.on(P)) throw new Error(`P = ${show(P)} egri chiziqda yotmaydi`);
    const op = val(v, 'op');
    const steps: Step[] = [curveStep(c, [P])];
    let R: Pt;
    if (op === 'add' || op === 'dbl') {
      const Q = op === 'dbl' ? P : pt(val(v, 'Q'), 'Q');
      if (!c.on(Q)) throw new Error(`Q = ${show(Q)} egri chiziqda yotmaydi`);
      const notes: string[] = [];
      R = c.add(P, Q, notes);
      steps.push({ title: op === 'dbl' ? 'Nuqtani ikkilantirish 2P' : 'Nuqtalarni qo‘shish P + Q', visuals: [...notes.map((t): Visual => ({ kind: 'formula', text: t })), { kind: 'note', tone: 'ok', text: `${op === 'dbl' ? '2P' : 'P + Q'} = ${show(R)}` }] });
      steps.push({ ...curveStep(c, [P, Q, R]), title: 'Natija grafikda' });
    } else {
      const n = int(v, 'n');
      if (n < 1) throw new Error('n ≥ 1');
      const bits = n.toString(2);
      steps.push({ title: 'n ni ikkilik ko‘rinishga ajratish', visuals: [{ kind: 'formula', text: `n = ${n} = ${bits}₂ — chapdan o‘ngga: har bitda 2R, “1” bo‘lsa + P` }] });
      R = null;
      const rows: (string | number)[][] = [];
      bits.split('').forEach((bit, i) => {
        const notes: string[] = [];
        R = c.add(R, R, notes);
        const afterD = R;
        let addNote = '';
        if (bit === '1') { const n2: string[] = []; R = c.add(R, P, n2); addNote = n2.join(' | '); }
        rows.push([i + 1, bit, show(afterD), bit === '1' ? show(R) : '—']);
        steps.push({ title: `${i + 1}-bit = ${bit}`, visuals: [
          { kind: 'formula', text: `Double: 2R = ${show(afterD)}` }, ...notes.map((t): Visual => ({ kind: 'formula', text: t })),
          ...(bit === '1' ? [{ kind: 'formula' as const, text: `Add: R + P = ${show(R)}` }, ...addNote.split(' | ').filter(Boolean).map((t): Visual => ({ kind: 'formula', text: t }))] : []),
        ] });
      });
      steps.push({ title: 'Double-and-Add jadvali', visuals: [{ kind: 'table', headers: ['#', 'Bit', 'Double', 'Add'], rows, hlRows: [rows.length - 1] }, { kind: 'note', tone: 'ok', text: `${n}·P = ${show(R)}` }] });
      steps.push({ ...curveStep(c, [P, R]), title: 'Natija grafikda' });
    }
    return { steps, output: [{ label: 'Natija', value: show(R) }] };
  },
};

export const ecdh: AlgorithmDef = {
  id: 'ecdh', topic: 10, name: 'ECDH — elliptik egri chiziqda kalit almashish',
  short: 'Q_A = d_A·G, Q_B = d_B·G, K = d_A·Q_B = d_B·Q_A',
  theory: ['Diffie–Hellman g’oyasi elliptik egri chiziqda: darajaga oshirish o‘rniga skalyar ko‘paytma ishlatiladi.', 'ECC 256-bit kalit ≈ RSA 3072-bit xavfsizlik — kichik kalit, yuqori tezlik.'],
  formulas: ['Q = d·G', 'K = d_A·(d_B·G) = d_B·(d_A·G)'],
  fields: [...curveFields, { key: 'G', label: 'G (generator)', type: 'text', default: '(5, 1)' }, { key: 'da', label: 'd_A', type: 'number', default: '3' }, { key: 'db', label: 'd_B', type: 'number', default: '7' }],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const G = pt(val(v, 'G'), 'G');
    if (!c.on(G)) throw new Error('G egri chiziqda yotmaydi');
    const mul = (k: number, P: Pt): Pt => { let R: Pt = null; for (const bit of k.toString(2)) { R = c.add(R, R); if (bit === '1') R = c.add(R, P); } return R; };
    // G tartibi
    let ord = 1; let T: Pt = G; while (T) { T = c.add(T, G); ord++; if (ord > 5000) break; }
    const da = int(v, 'da'), db = int(v, 'db');
    const QA = mul(da, G), QB = mul(db, G), KA = mul(da, QB), KB = mul(db, QA);
    const steps: Step[] = [curveStep(c, [G]), { title: 'G nuqtaning tartibi', visuals: [{ kind: 'formula', text: `n·G = O bo‘ladigan eng kichik n = ${ord}` }] }];
    steps.push({ title: 'Ochiq kalitlar', visuals: [{ kind: 'kv', items: [{ label: `Alice: Q_A = ${da}·G`, value: show(QA), hl: true }, { label: `Bob: Q_B = ${db}·G`, value: show(QB), hl: true }] }] });
    steps.push({ title: 'Umumiy kalit', visuals: [{ kind: 'kv', items: [{ label: `Alice: ${da}·Q_B`, value: show(KA) }, { label: `Bob: ${db}·Q_A`, value: show(KB) }] }, show(KA) === show(KB) ? { kind: 'note', tone: 'ok', text: `K = ${show(KA)} — mos keldi ✓ (odatda x koordinatasi kalit sifatida olinadi)` } : { kind: 'note', tone: 'warn', text: 'Mos emas' }] });
    steps.push({ ...curveStep(c, [G, QA, QB, KA]), title: 'Nuqtalar grafikda' });
    return { steps, output: [{ label: 'Q_A', value: show(QA) }, { label: 'Q_B', value: show(QB) }, { label: 'K', value: show(KA) }] };
  },
};

export const T9 = [eccArith, ecdh];
