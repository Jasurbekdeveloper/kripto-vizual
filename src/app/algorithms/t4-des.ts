import { AlgorithmDef, Step } from '../core/models';
import { fromHex, val } from '../core/util';

/* ---------------------------------------------------------------
 * 4-MA'RUZA: DES (Feistel tarmog'i) — 64 bit blok, 56 bit kalit, 16 raund
 * ------------------------------------------------------------- */

const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const SB = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

type Bits = string;
const perm = (b: Bits, t: number[]): Bits => t.map((i) => b[i - 1]).join('');
const xorb = (a: Bits, b: Bits): Bits => a.split('').map((x, i) => (x === b[i] ? '0' : '1')).join('');
const rotl = (b: Bits, n: number): Bits => b.slice(n) + b.slice(0, n);
const toBits = (bytes: number[]): Bits => bytes.map((x) => x.toString(2).padStart(8, '0')).join('');
const bits2hex = (b: Bits): string => (b.match(/.{4}/g) ?? []).map((n) => parseInt(n, 2).toString(16)).join('');
const grp = (b: Bits, n: number): string => (b.match(new RegExp(`.{1,${n}}`, 'g')) ?? []).join(' ');

export function desSubkeys(key: Bits): { K: Bits[]; rows: (string | number)[][]; c0: Bits; d0: Bits } {
  const k56 = perm(key, PC1);
  let c = k56.slice(0, 28), d = k56.slice(28);
  const c0 = c, d0 = d;
  const K: Bits[] = [], rows: (string | number)[][] = [];
  SHIFTS.forEach((s, i) => { c = rotl(c, s); d = rotl(d, s); const k = perm(c + d, PC2); K.push(k); rows.push([`K${i + 1}`, s, bits2hex(c), bits2hex(d), bits2hex(k)]); });
  return { K, rows, c0, d0 };
}

function feistelF(r: Bits, k: Bits): { out: Bits; e: Bits; x: Bits; sOut: Bits; sRows: (string | number)[][] } {
  const e = perm(r, E), x = xorb(e, k);
  let sOut = '';
  const sRows: (string | number)[][] = [];
  for (let i = 0; i < 8; i++) {
    const six = x.slice(6 * i, 6 * i + 6);
    const row = parseInt(six[0] + six[5], 2), col = parseInt(six.slice(1, 5), 2);
    const val4 = SB[i][16 * row + col];
    sOut += val4.toString(2).padStart(4, '0');
    sRows.push([`S${i + 1}`, six, `${six[0]}${six[5]} = ${row}`, `${six.slice(1, 5)} = ${col}`, val4, val4.toString(2).padStart(4, '0')]);
  }
  return { out: perm(sOut, P), e, x, sOut, sRows };
}

export const des: AlgorithmDef = {
  id: 'des', topic: 4, name: 'DES: Feistel tarmog‘i, 16 raund',
  short: 'IP → 16 × (Lᵢ = Rᵢ₋₁, Rᵢ = Lᵢ₋₁ ⊕ F(Rᵢ₋₁, Kᵢ)) → IP⁻¹',
  theory: [
    'DES (1977, FIPS 46): blok 64 bit, kalit 64 bit (8 tasi juftlik biti) — samarali 56 bit, 16 raund, Feistel tuzilmasi.',
    'F funksiya: E (32→48 kengaytirish) → Kᵢ bilan XOR → 8 ta S-box (6 bit → 4 bit, 48→32) → P permutatsiya.',
    'S-box da qator = b₁b₆ (chetki bitlar), ustun = b₂b₃b₄b₅. S-boxlar — DESdagi yagona nochiziqli komponent.',
    'Kalit jadvali: PC-1 (64→56), C va D yarmlar 1 yoki 2 bitga chapga aylanadi (1, 2, 9, 16-raundlarda 1 bit), PC-2 (56→48).',
    'Deshifrlash — xuddi shu algoritm, raund kalitlari teskari tartibda (K₁₆ … K₁). 2⁵⁶ kalit fazosi bugun brute-force uchun kichik.',
  ],
  formulas: ['Lᵢ = Rᵢ₋₁', 'Rᵢ = Lᵢ₋₁ ⊕ F(Rᵢ₋₁, Kᵢ)', 'F(R, K) = P(S(E(R) ⊕ K))'],
  fields: [
    { key: 'mode', label: 'Rejim', type: 'select', default: 'enc', options: [{ value: 'enc', label: 'Shifrlash' }, { value: 'dec', label: 'Deshifrlash' }] },
    { key: 'text', label: 'Blok (16 hex)', type: 'text', default: '0123456789abcdef' },
    { key: 'key', label: 'Kalit (16 hex)', type: 'text', default: '133457799bbcdff1' },
  ],
  examples: [{ label: 'Deshifr 85e81354…', values: { mode: 'dec', text: '85e813540f0ab405', key: '133457799bbcdff1' } }],
  run(v) {
    const enc = val(v, 'mode') !== 'dec';
    const blk = toBits(fromHex(val(v, 'text'), 8, 'Blok'));
    const key = toBits(fromHex(val(v, 'key'), 8, 'Kalit'));
    const { K, rows, c0, d0 } = desSubkeys(key);
    const steps: Step[] = [];
    steps.push({ title: 'Kalit: PC-1 (64 → 56 bit)', text: 'Har baytning 8-biti (juftlik biti) tashlanadi, qolgan 56 bit C₀ va D₀ ga bo‘linadi.', visuals: [{ kind: 'bits', rows: [{ label: 'K (64)', bits: grp(key, 8) }, { label: 'C₀ (28)', bits: grp(c0, 7) }, { label: 'D₀ (28)', bits: grp(d0, 7) }] }] });
    steps.push({ title: 'Raund kalitlari (Left shift + PC-2)', visuals: [{ kind: 'table', headers: ['Kalit', 'Siljish', 'Cᵢ', 'Dᵢ', 'Kᵢ (48 bit, hex)'], rows }] });
    const ip = perm(blk, IP);
    let L = ip.slice(0, 32), Rr = ip.slice(32);
    steps.push({ title: 'Boshlang‘ich permutatsiya IP', text: 'IP xavfsizlikni oshirmaydi — bitlar belgilangan tartibda qayta joylashadi.', visuals: [{ kind: 'bits', rows: [{ label: 'Blok', bits: grp(blk, 8) }, { label: 'IP', bits: grp(ip, 8) }, { label: 'L₀', bits: grp(L, 8) }, { label: 'R₀', bits: grp(Rr, 8) }] }] });
    const keys = enc ? K : [...K].reverse();
    const roundRows: (string | number)[][] = [];
    for (let i = 0; i < 16; i++) {
      const f = feistelF(Rr, keys[i]);
      const newR = xorb(L, f.out);
      if (i < 2 || i === 15) {
        steps.push({ title: `${i + 1}-raund: F funksiya`, visuals: [
          { kind: 'bits', rows: [
            { label: `R${i} (32)`, bits: grp(Rr, 4) },
            { label: 'E(R) (48)', bits: grp(f.e, 6) },
            { label: `K${enc ? i + 1 : 16 - i} (48)`, bits: grp(keys[i], 6) },
            { label: 'E ⊕ K', bits: grp(f.x, 6), sep: true },
          ] },
          { kind: 'table', caption: 'S-box: qator = b₁b₆, ustun = b₂b₃b₄b₅', headers: ['S-box', '6 bit', 'Qator', 'Ustun', 'Qiymat', '4 bit'], rows: f.sRows },
          { kind: 'bits', rows: [{ label: 'S chiqish', bits: grp(f.sOut, 4) }, { label: 'P(S)', bits: grp(f.out, 4) }, { label: `L${i}`, bits: grp(L, 4) }, { label: `R${i + 1} = L ⊕ F`, bits: grp(newR, 4), sep: true }] },
        ] });
      }
      L = Rr; Rr = newR;
      roundRows.push([i + 1, `K${enc ? i + 1 : 16 - i}`, bits2hex(L), bits2hex(Rr)]);
    }
    steps.push({ title: '16 raund natijalari', text: 'Har raundda: Lᵢ = Rᵢ₋₁, Rᵢ = Lᵢ₋₁ ⊕ F(Rᵢ₋₁, Kᵢ).', visuals: [{ kind: 'table', headers: ['Raund', 'Kalit', 'Lᵢ', 'Rᵢ'], rows: roundRows, hlRows: [15] }] });
    const pre = Rr + L;
    const out = perm(pre, FP);
    steps.push({ title: 'Swap va yakuniy permutatsiya IP⁻¹', visuals: [{ kind: 'bits', rows: [{ label: 'R₁₆L₁₆', bits: grp(pre, 8) }, { label: 'IP⁻¹', bits: grp(out, 8), sep: true }] }, { kind: 'note', tone: 'ok', text: `${enc ? 'Shifrmatn' : 'Ochiq matn'}: ${bits2hex(out)}` }] });
    return { steps, output: [{ label: enc ? 'Shifrmatn' : 'Ochiq matn', value: bits2hex(out) }] };
  },
};

export const T4DES = [des];
