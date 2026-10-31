import { AlgorithmDef, Step } from '../core/models';
import { fromHex, hex2, toHex, val } from '../core/util';

/* ---------------------------------------------------------------
 * 4-MAVZU: «Kuznechik» (GOST R 34.12-2015, GOST 34.12-2018)
 * Blok 128 bit, kalit 256 bit, 10 ta raund kaliti, SPN: X → S → L
 * Bayt tartibi: massivning 0-elementi = a₁₅ (eng chapdagi hex bayt)
 * ------------------------------------------------------------- */

export const PI = [
  252, 238, 221, 17, 207, 110, 49, 22, 251, 196, 250, 218, 35, 197, 4, 77, 233, 119, 240, 219, 147, 46, 153, 186, 23, 54, 241, 187, 20, 205, 95, 193,
  249, 24, 101, 90, 226, 92, 239, 33, 129, 28, 60, 66, 139, 1, 142, 79, 5, 132, 2, 174, 227, 106, 143, 160, 6, 11, 237, 152, 127, 212, 211, 31,
  235, 52, 44, 81, 234, 200, 72, 171, 242, 42, 104, 162, 253, 58, 206, 204, 181, 112, 14, 86, 8, 12, 118, 18, 191, 114, 19, 71, 156, 183, 93, 135,
  21, 161, 150, 41, 16, 123, 154, 199, 243, 145, 120, 111, 157, 158, 178, 177, 50, 117, 25, 61, 255, 53, 138, 126, 109, 84, 198, 128, 195, 189, 13, 87,
  223, 245, 36, 169, 62, 168, 67, 201, 215, 121, 214, 246, 124, 34, 185, 3, 224, 15, 236, 222, 122, 148, 176, 188, 220, 232, 40, 80, 78, 51, 10, 74,
  167, 151, 96, 115, 30, 0, 98, 68, 26, 184, 56, 130, 100, 159, 38, 65, 173, 69, 70, 146, 39, 94, 85, 47, 140, 163, 165, 125, 105, 213, 149, 59,
  7, 88, 179, 64, 134, 172, 29, 247, 48, 55, 107, 228, 136, 217, 231, 137, 225, 27, 131, 73, 76, 63, 248, 254, 141, 83, 170, 144, 202, 216, 133, 97,
  32, 113, 103, 164, 45, 43, 9, 91, 203, 155, 37, 208, 190, 229, 108, 82, 89, 166, 116, 210, 230, 244, 180, 192, 209, 102, 175, 194, 57, 75, 99, 182,
];
export const PI_INV = (() => { const t = new Array(256); PI.forEach((v, i) => (t[v] = i)); return t; })();
export const LVEC = [148, 32, 133, 16, 194, 192, 1, 251, 1, 192, 194, 16, 133, 32, 148, 1];

export function kmul(a: number, b: number): number {
  let r = 0;
  while (b) { if (b & 1) r ^= a; a = (a << 1) ^ (a & 0x80 ? 0xc3 : 0); a &= 0xff; b >>= 1; }
  return r;
}
const lfun = (a: number[]): number => a.reduce((acc, x, i) => acc ^ kmul(x, LVEC[i]), 0);
export const R = (a: number[]): number[] => [lfun(a), ...a.slice(0, 15)];
export const Rinv = (a: number[]): number[] => { const s = [...a.slice(1), a[0]]; return [...a.slice(1), lfun(s)]; };
export const L = (a: number[]): number[] => { for (let i = 0; i < 16; i++) a = R(a); return a; };
export const Linv = (a: number[]): number[] => { for (let i = 0; i < 16; i++) a = Rinv(a); return a; };
export const S = (a: number[]): number[] => a.map((b) => PI[b]);
export const Sinv = (a: number[]): number[] => a.map((b) => PI_INV[b]);
const X = (a: number[], k: number[]): number[] => a.map((b, i) => b ^ k[i]);
const hx = (a: number[]): string => a.map(hex2).join(' ');

export function keySchedule(key: number[]): { K: number[][]; C: number[][] } {
  const C = Array.from({ length: 32 }, (_, i) => L([...new Array(15).fill(0), i + 1]));
  const K = [key.slice(0, 16), key.slice(16, 32)];
  let [a, b] = K;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) { const t = X(L(S(X(a, C[8 * i + j]))), b); [a, b] = [t, a]; }
    K.push(a, b);
  }
  return { K, C };
}

export const kuznechik: AlgorithmDef = {
  id: 'kuznechik', topic: 4, name: 'Kuznechik: to‘liq shifrlash / deshifrlash',
  short: 'GOST R 34.12-2015: 9 raund L(S(X ⊕ Kᵢ)) + yakuniy ⊕ K₁₀, kalit jadvali bilan',
  theory: [
    'Blok 128 bit, kalit 256 bit, 10 ta raund kaliti. SPN tuzilma: X (kalit bilan XOR) → S (nochiziqli almashtirish, π jadval) → L (chiziqli akslantirish).',
    'L = R¹⁶: R baytlarni o‘ngga 1 ga suradi va yangi a₁₅ ni GF(2⁸) dagi chiziqli kombinatsiya bilan hosil qiladi. Modul p(x) = x⁸ + x⁷ + x⁶ + x + 1 (0x1C3).',
    'Kalit jadvali: K₁, K₂ — kalitning ikki yarmi; keyingi juftliklar F[Cᵢ] Feistel almashtirishini 8 marta qo‘llab olinadi, Cᵢ = L(Vec₁₂₈(i)).',
    'Oxirgi qadamda L qo‘llanilmaydi — faqat K₁₀ bilan XOR.',
  ],
  formulas: ['E(a) = X[K₁₀] LSX[K₉] … LSX[K₁](a)', 'R(a₁₅…a₀) = l(a₁₅,…,a₀) ‖ a₁₅…a₁', 'l = 148a₁₅ + 32a₁₄ + 133a₁₃ + 16a₁₂ + 194a₁₁ + 192a₁₀ + a₉ + 251a₈ + a₇ + 192a₆ + 194a₅ + 16a₄ + 133a₃ + 32a₂ + 148a₁ + a₀', 'F[C](a₁, a₀) = (LSX[C](a₁) ⊕ a₀, a₁)'],
  fields: [
    { key: 'mode', label: 'Rejim', type: 'select', default: 'enc', options: [{ value: 'enc', label: 'Shifrlash' }, { value: 'dec', label: 'Deshifrlash' }] },
    { key: 'text', label: 'Blok (32 hex)', type: 'text', default: '1122334455667700ffeeddccbbaa9988' },
    { key: 'key', label: 'Kalit (64 hex)', type: 'text', default: '8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef' },
  ],
  examples: [{ label: 'GOST test — deshifr', values: { mode: 'dec', text: '7f679d90bebc24305a468d42b9d4edcd', key: '8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef' } }],
  run(v) {
    const enc = val(v, 'mode') !== 'dec';
    const input = fromHex(val(v, 'text'), 16, 'Blok');
    const key = fromHex(val(v, 'key'), 32, 'Kalit');
    const { K, C } = keySchedule(key);
    const steps: Step[] = [];
    steps.push({ title: 'Kirish ma’lumotlari', text: 'Baytlar a₁₅ … a₀ tartibida (chapdan o‘ngga).', visuals: [{ kind: 'bytes', title: 'Blok', bytes: input.map(hex2), labels: input.map((_, i) => `a${15 - i}`) }, { kind: 'bytes', title: 'Kalit K = K₁ ‖ K₂', bytes: key.map(hex2) }] });
    steps.push({ title: 'Raund konstantalari Cᵢ = L(Vec₁₂₈(i))', visuals: [{ kind: 'table', headers: ['i', 'Vec₁₂₈(i)', 'Cᵢ'], rows: C.slice(0, 8).map((c, i) => [i + 1, '00…' + hex2(i + 1), toHex(c)]).concat([['…', '…', '…'], [32, '00…20', toHex(C[31])]]) }] });
    steps.push({ title: 'Raund kalitlari K₁…K₁₀', text: '(K₃, K₄) = F⁸(K₁, K₂, C₁…C₈), (K₅, K₆) = F⁸(K₃, K₄, C₉…C₁₆) va hokazo.', visuals: [{ kind: 'table', headers: ['Kalit', 'Qiymat', 'Hosil bo‘lishi'], rows: K.map((k, i) => [`K${i + 1}`, toHex(k), i < 2 ? 'Asosiy kalit yarmi' : `F⁸, C${8 * Math.floor((i - 2) / 2) + 1}…C${8 * Math.floor((i - 2) / 2) + 8}`]) }] });
    // R ning batafsil ko'rinishi (birinchi raund L bosqichi uchun)
    const rDetail = (a: number[]): Step => {
      const prods = a.map((x, i) => [`a${15 - i}`, hex2(x), `${LVEC[i]} (0x${hex2(LVEC[i])})`, hex2(kmul(x, LVEC[i]))]);
      const nb = lfun(a);
      return { title: 'R-almashtirish: batafsil (1-surilish)', text: 'Yangi bayt = barcha aᵢ·cᵢ ko‘paytmalarining XOR yig‘indisi (GF(2⁸), modul 0x1C3). So‘ng vektor o‘ngga 1 bayt suriladi.', visuals: [
        { kind: 'table', headers: ['Bayt', 'aᵢ', 'Koeff. cᵢ', 'aᵢ·cᵢ'], rows: prods },
        { kind: 'formula', text: `l = ${prods.map((p) => p[3]).join(' ⊕ ')} = ${hex2(nb)}` },
        { kind: 'bytes', title: 'Oldin', bytes: a.map(hex2) },
        { kind: 'bytes', title: 'R(a)', bytes: R(a).map(hex2), hl: [0] },
      ] };
    };
    let a = input;
    if (enc) {
      for (let i = 0; i < 9; i++) {
        const x = X(a, K[i]), s = S(x);
        steps.push({ title: `${i + 1}-raund: X[K${i + 1}] — kalit bilan XOR`, visuals: [{ kind: 'bytes', title: 'Holat', bytes: a.map(hex2) }, { kind: 'bytes', title: `K${i + 1}`, bytes: K[i].map(hex2) }, { kind: 'bytes', title: '⊕ natija', bytes: x.map(hex2), hl: x.map((_, j) => j) }] });
        steps.push({ title: `${i + 1}-raund: S — π jadval bo‘yicha almashtirish`, text: 'Har bir bayt mustaqil almashtiriladi — baytlar o‘zaro aralashmaydi (diffuziya yo‘q).', visuals: [{ kind: 'table', headers: ['', ...x.map((_, j) => `a${15 - j}`)], rows: [['kirish', ...x.map(hex2)], ['π(·)', ...s.map(hex2)]], hlRows: [1] }] });
        if (i === 0) steps.push(rDetail(s));
        const rows: (string | number)[][] = [['Boshlang‘ich', hx(s)]];
        let t = s;
        for (let j = 1; j <= 16; j++) { t = R(t); if ([1, 2, 4, 8, 12, 16].includes(j)) rows.push([`R${j === 1 ? '¹' : '^' + j}`, hx(t)]); }
        steps.push({ title: `${i + 1}-raund: L = R¹⁶ — chiziqli aralashtirish`, visuals: [{ kind: 'table', headers: ['Bosqich', 'Holat (hex)'], rows, hlRows: [rows.length - 1] }] });
        a = t;
      }
      const out = X(a, K[9]);
      steps.push({ title: 'Yakuniy: X[K₁₀] (L va S yo‘q)', visuals: [{ kind: 'bytes', title: 'Holat', bytes: a.map(hex2) }, { kind: 'bytes', title: 'K₁₀', bytes: K[9].map(hex2) }, { kind: 'bytes', title: 'Shifrmatn', bytes: out.map(hex2), hl: out.map((_, j) => j) }] });
      a = out;
    } else {
      a = X(a, K[9]);
      steps.push({ title: 'X[K₁₀]', visuals: [{ kind: 'bytes', title: 'Holat', bytes: a.map(hex2) }] });
      for (let i = 8; i >= 0; i--) {
        const l = Linv(a), s = Sinv(l), x = X(s, K[i]);
        steps.push({ title: `L⁻¹ → S⁻¹ → X[K${i + 1}]`, visuals: [{ kind: 'table', headers: ['Amal', 'Holat'], rows: [['kirish', hx(a)], ['L⁻¹', hx(l)], ['S⁻¹', hx(s)], [`⊕ K${i + 1}`, hx(x)]], hlRows: [3] }] });
        a = x;
      }
    }
    return { steps, output: [{ label: enc ? 'Shifrmatn' : 'Ochiq matn', value: toHex(a) }] };
  },
};

export const kuzTransforms: AlgorithmDef = {
  id: 'kuz-transforms', topic: 4, name: 'Kuznechik: S, R, L almashtirishlari alohida',
  short: 'Bitta 16 baytli vektor ustida S, R, L va teskarilarini qadamma-qadam',
  theory: ['S — har bir baytni π jadval bo‘yicha almashtiradi (confusion).', 'R — LFSR kabi: yangi bayt l(a) chiqadi, qolganlari o‘ngga suriladi. L = R¹⁶ — har bir chiqish bayti barcha kirish baytlariga bog‘liq (diffusion).'],
  fields: [
    { key: 'op', label: 'Almashtirish', type: 'select', default: 'L', options: [{ value: 'S', label: 'S' }, { value: 'R', label: 'R' }, { value: 'L', label: 'L = R¹⁶' }, { value: 'Sinv', label: 'S⁻¹' }, { value: 'Linv', label: 'L⁻¹' }] },
    { key: 'text', label: 'Vektor (32 hex)', type: 'text', default: '64a59400000000000000000000000000' },
  ],
  examples: [{ label: 'S(ffeeddcc…)', values: { op: 'S', text: 'ffeeddccbbaa99881122334455667700' } }, { label: 'R(00…0100)', values: { op: 'R', text: '00000000000000000000000000000100' } }],
  run(v) {
    const a = fromHex(val(v, 'text'), 16, 'Vektor');
    const op = val(v, 'op');
    const steps: Step[] = [{ title: 'Kirish', visuals: [{ kind: 'bytes', bytes: a.map(hex2), labels: a.map((_, i) => `a${15 - i}`) }] }];
    let out: number[];
    if (op === 'S' || op === 'Sinv') {
      out = op === 'S' ? S(a) : Sinv(a);
      steps.push({ title: op === 'S' ? 'π jadval' : 'π⁻¹ jadval', visuals: [{ kind: 'table', headers: ['Kirish', 'Chiqish'], rows: a.map((x, i) => [hex2(x), hex2(out[i])]) }] });
    } else if (op === 'R') {
      const prods = a.map((x, i) => [`a${15 - i}`, hex2(x), hex2(LVEC[i]), hex2(kmul(x, LVEC[i]))]);
      out = R(a);
      steps.push({ title: 'l(a) ni hisoblash', visuals: [{ kind: 'table', headers: ['Bayt', 'aᵢ', 'cᵢ', 'aᵢ·cᵢ'], rows: prods }, { kind: 'formula', text: `l = ${prods.map((p) => p[3]).join(' ⊕ ')} = ${hex2(out[0])}` }] });
    } else {
      const f = op === 'L' ? R : Rinv;
      let t = a; const rows: (string | number)[][] = [];
      for (let j = 1; j <= 16; j++) { t = f(t); rows.push([j, hx(t)]); }
      out = t;
      steps.push({ title: `${op === 'L' ? 'R' : 'R⁻¹'} ni 16 marta qo‘llash`, visuals: [{ kind: 'table', headers: ['#', 'Holat'], rows, hlRows: [15] }] });
    }
    steps.push({ title: 'Natija', visuals: [{ kind: 'bytes', bytes: out.map(hex2), hl: out.map((_, i) => i) }] });
    return { steps, output: [{ label: 'Natija', value: toHex(out) }] };
  },
};

export const T4 = [kuznechik, kuzTransforms];
