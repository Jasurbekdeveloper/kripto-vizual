import { AlgorithmDef, Step, Visual } from '../core/models';
import { bin8, fromHex, gcd, hex2, int, modn, toHex, utf8, val } from '../core/util';

/* ---------------------------------------------------------------
 * 2-MAVZU: Klassik (simmetrik) shifrlash algoritmlari
 * ------------------------------------------------------------- */

const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const clean = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '');
const idx = (c: string): number => AB.indexOf(c);

const modeField = { key: 'mode', label: 'Rejim', type: 'select' as const, default: 'enc', options: [{ value: 'enc', label: 'Shifrlash' }, { value: 'dec', label: 'Deshifrlash' }] };

function prep(v: Record<string, string>): { text: string; enc: boolean; steps: Step[] } {
  const text = clean(val(v, 'text'));
  if (!text) throw new Error('Matn kiriting (lotin harflari A–Z)');
  const enc = val(v, 'mode') !== 'dec';
  return {
    text, enc,
    steps: [{
      title: 'Matnni tayyorlash va indekslash',
      text: 'Matn katta harflarga o‘tkaziladi, harf bo‘lmagan belgilar olib tashlanadi. Har bir harfga alifbodagi tartib raqami beriladi: A=0, B=1, …, Z=25 (m = 26).',
      visuals: [{ kind: 'chars', rows: [{ label: 'Harf', chars: text.split('') }, { label: 'Indeks', chars: text.split('').map((c) => String(idx(c))) }] }],
    }],
  };
}

const alphaRows = (to: string, label = 'Shifr alifbo', hl?: number[]): Visual => ({
  kind: 'chars',
  rows: [{ label: 'Ochiq alifbo', chars: AB.split(''), hl }, { label, chars: to.split(''), hl }],
});

/* ---------- Sezar ---------- */
export const caesar: AlgorithmDef = {
  id: 'caesar', topic: 2, name: 'Sezar shifri',
  short: 'Har bir harf alifboda k pozitsiyaga siljitiladi',
  theory: ['Monoalfavit almashtirish shifri. Kalit — siljish miqdori k (1..25).', 'Kalit fazosi atigi 25 ta — to‘liq tanlash (brute-force) bilan oson buziladi.'],
  formulas: ['C = (P + k) mod 26', 'P = (C − k) mod 26'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'HELLO' }, { key: 'k', label: 'Kalit k', type: 'number', default: '3' }],
  examples: [{ label: 'CRYPTOGRAPHY, k=7', values: { mode: 'enc', text: 'CRYPTOGRAPHY', k: '7' } }, { label: 'KHOOR → deshifr', values: { mode: 'dec', text: 'KHOOR', k: '3' } }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const k = modn(int(v, 'k'), 26);
    const shifted = AB.split('').map((_, i) => AB[(i + k) % 26]).join('');
    steps.push({ title: 'Siljigan alifbo', text: `Har bir harf ${k} pozitsiyaga o‘ngga siljiydi.`, visuals: [alphaRows(shifted)] });
    let out = '';
    const rows = text.split('').map((c) => {
      const p = idx(c);
      const r = enc ? (p + k) % 26 : modn(p - k, 26);
      out += AB[r];
      return [c, p, enc ? `${p} + ${k} = ${p + k}` : `${p} − ${k} = ${p - k}`, `${r}`, AB[r]];
    });
    steps.push({ title: enc ? 'Shifrlash' : 'Deshifrlash', visuals: [{ kind: 'formula', text: enc ? `C = (P + ${k}) mod 26` : `P = (C − ${k}) mod 26` }, { kind: 'table', headers: ['Belgi', 'Indeks', 'Hisob', 'mod 26', 'Natija'], rows }] });
    steps.push({ title: 'Natija', visuals: [{ kind: 'chars', rows: [{ label: 'Kirish', chars: text.split('') }, { label: 'Chiqish', chars: out.split(''), hl: out.split('').map((_, i) => i) }] }] });
    return { steps, output: [{ label: enc ? 'Shifrmatn' : 'Ochiq matn', value: out }] };
  },
};

/* ---------- Atbash ---------- */
export const atbash: AlgorithmDef = {
  id: 'atbash', topic: 2, name: 'Atbash shifri',
  short: 'Alifbo teskari aks ettiriladi: A↔Z, B↔Y, …',
  theory: ['Kalitsiz almashtirish. Atbash involyutsiya: shifrlash va deshifrlash bir xil formula.'],
  formulas: ['C = 25 − P'],
  fields: [{ key: 'text', label: 'Matn', type: 'text', default: 'HELLO' }],
  examples: [{ label: 'SECURITY', values: { text: 'SECURITY' } }, { label: 'INFORMATION', values: { text: 'INFORMATION' } }],
  run(v) {
    const { text, steps } = prep({ ...v, mode: 'enc' });
    steps.push({ title: 'Teskari alifbo', visuals: [alphaRows(AB.split('').reverse().join(''))] });
    let out = '';
    const rows = text.split('').map((c) => { const p = idx(c); out += AB[25 - p]; return [c, p, `25 − ${p} = ${25 - p}`, AB[25 - p]]; });
    steps.push({ title: 'Almashtirish', visuals: [{ kind: 'table', headers: ['Belgi', 'P', '25 − P', 'Natija'], rows }, { kind: 'note', tone: 'info', text: `Qayta qo‘llansa: ${out} → ${text} (involyutsiya)` }] });
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- Monoalfavit ---------- */
export const mono: AlgorithmDef = {
  id: 'mono', topic: 2, name: 'Monoalfavit almashtirish',
  short: 'Kalit — alifboning ixtiyoriy o‘rin almashtirishi (26! variant)',
  theory: ['Kalit fazosi 26! ≈ 4×10²⁶, lekin har bir harf har doim bir xil harfga almashgani uchun chastota tahliliga zaif.'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'HELLO' }, { key: 'key', label: 'Kalit alifbo (26 harf)', type: 'text', default: 'QWERTYUIOPASDFGHJKLZXCVBNM' }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const key = clean(val(v, 'key'));
    if (key.length !== 26 || new Set(key).size !== 26) throw new Error('Kalit 26 ta turli harfdan iborat bo‘lishi kerak');
    steps.push({ title: 'Almashtirish jadvali', visuals: [alphaRows(key, 'Kalit alifbo')] });
    let out = '';
    const rows = text.split('').map((c) => { const r = enc ? key[idx(c)] : AB[key.indexOf(c)]; out += r; return [c, enc ? `${c} → ${r}` : `${c} ← ${r}`, r]; });
    steps.push({ title: enc ? 'Shifrlash' : 'Deshifrlash', visuals: [{ kind: 'table', headers: ['Belgi', 'Jadval', 'Natija'], rows }] });
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- Affin ---------- */
export const affine: AlgorithmDef = {
  id: 'affine', topic: 2, name: 'Affin shifri',
  short: 'C = (a·P + b) mod 26, EKUB(a, 26) = 1 sharti bilan',
  theory: ['a va 26 o‘zaro tub bo‘lishi shart, aks holda a⁻¹ mavjud emas va deshifrlash imkonsiz.', 'Ruxsat etilgan a: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25 (12 ta). Kalit fazosi 12 × 26 = 312.'],
  formulas: ['C = (a·P + b) mod 26', 'P = a⁻¹·(C − b) mod 26'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'HELLO' }, { key: 'a', label: 'a', type: 'number', default: '5' }, { key: 'b', label: 'b', type: 'number', default: '8' }],
  examples: [{ label: 'CRYPTO, a=7, b=3', values: { mode: 'enc', text: 'CRYPTO', a: '7', b: '3' } }, { label: 'RCLLA → deshifr', values: { mode: 'dec', text: 'RCLLA', a: '5', b: '8' } }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const a = modn(int(v, 'a'), 26), b = modn(int(v, 'b'), 26);
    const g = Number(gcd(BigInt(a), 26n));
    steps.push({ title: 'Kalit shartini tekshirish', visuals: [{ kind: 'formula', text: `EKUB(${a}, 26) = ${g}` }, g === 1 ? { kind: 'note', tone: 'ok', text: 'Shart bajarildi — a⁻¹ mavjud' } : { kind: 'note', tone: 'warn', text: 'EKUB ≠ 1 — bu kalit bilan deshifrlash imkonsiz!' }] });
    if (g !== 1) throw new Error(`EKUB(${a}, 26) = ${g} ≠ 1 — noto‘g‘ri kalit a`);
    let ai = 1; while ((a * ai) % 26 !== 1) ai++;
    let out = '';
    if (enc) {
      const rows = text.split('').map((c) => { const x = idx(c); const r = (a * x + b) % 26; out += AB[r]; return [c, x, `${a}·${x} + ${b} = ${a * x + b}`, r, AB[r]]; });
      steps.push({ title: 'Shifrlash', visuals: [{ kind: 'formula', text: `C = (${a}·P + ${b}) mod 26` }, { kind: 'table', headers: ['Belgi', 'P', 'a·P + b', 'mod 26', 'C'], rows }] });
    } else {
      steps.push({ title: 'a⁻¹ ni topish', visuals: [{ kind: 'formula', text: `${a}⁻¹ mod 26 = ${ai}  (chunki ${a}·${ai} = ${a * ai} ≡ 1)` }] });
      const rows = text.split('').map((c) => { const y = idx(c); const d = modn(y - b, 26); const r = (ai * d) % 26; out += AB[r]; return [c, y, `${y} − ${b} ≡ ${d}`, `${ai}·${d} = ${ai * d} ≡ ${r}`, AB[r]]; });
      steps.push({ title: 'Deshifrlash', visuals: [{ kind: 'formula', text: `P = ${ai}·(C − ${b}) mod 26` }, { kind: 'table', headers: ['Belgi', 'C', 'C − b', 'a⁻¹·(C − b)', 'P'], rows }] });
    }
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- Vijener ---------- */
export const vigenere: AlgorithmDef = {
  id: 'vigenere', topic: 2, name: 'Vijener shifri',
  short: 'Ko‘palfavitli shifr: har bir harf kalit harfi qadar siljiydi',
  theory: ['Kalit so‘z matn uzunligigacha takrorlanadi. Bir xil harf turli joyda turlicha shifrlanadi — chastota tahlilini qiyinlashtiradi.', 'Kasiski usuli orqali kalit uzunligi topilsa, shifr oddiy Sezarlarga ajraladi.'],
  formulas: ['Cᵢ = (Pᵢ + Kᵢ) mod 26', 'Pᵢ = (Cᵢ − Kᵢ) mod 26'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'HELLOWORLD' }, { key: 'key', label: 'Kalit so‘z', type: 'text', default: 'KEY' }],
  examples: [{ label: 'INFORMATION / CODE', values: { mode: 'enc', text: 'INFORMATION', key: 'CODE' } }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const key = clean(val(v, 'key'));
    if (!key) throw new Error('Kalit so‘z kiriting');
    const kk = text.split('').map((_, i) => key[i % key.length]).join('');
    steps.push({ title: 'Kalitni takrorlash', visuals: [{ kind: 'chars', rows: [{ label: 'Matn', chars: text.split('') }, { label: 'Kalit', chars: kk.split(''), hl: kk.split('').map((_, i) => (i % key.length === 0 ? i : -1)).filter((x) => x >= 0) }] }] });
    let out = '';
    const pr: string[] = [], kr: string[] = [], sr: string[] = [];
    text.split('').forEach((c, i) => {
      const p = idx(c), k = idx(kk[i]);
      const r = enc ? (p + k) % 26 : modn(p - k, 26);
      pr.push(String(p)); kr.push(String(k)); sr.push(String(r)); out += AB[r];
    });
    steps.push({
      title: enc ? 'Harfma-harf qo‘shish' : 'Harfma-harf ayirish',
      visuals: [{ kind: 'formula', text: enc ? 'Cᵢ = (Pᵢ + Kᵢ) mod 26' : 'Pᵢ = (Cᵢ − Kᵢ) mod 26' }, {
        kind: 'chars', rows: [
          { label: enc ? 'Pᵢ' : 'Cᵢ', chars: pr }, { label: 'Kᵢ', chars: kr }, { label: 'mod 26', chars: sr }, { label: 'Natija', chars: out.split(''), hl: out.split('').map((_, i) => i) },
        ],
      }],
    });
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- Jadval (ustunli) transpozitsiya ---------- */
function keyOrder(key: string, n: number): number[] {
  // kalit: raqamlar "3 1 4 2" yoki so'z "ZEBRA"
  const digits = key.trim().split(/[\s,]+/);
  if (digits.every((d) => /^\d+$/.test(d)) && digits.length > 1) {
    const ord = digits.map(Number);
    const sorted = [...ord].sort((a, b) => a - b);
    if (sorted.some((x, i) => x !== i + 1)) throw new Error('Raqamli kalit 1..N ning o‘rin almashtirishi bo‘lsin (masalan 3 1 4 2)');
    return ord;
  }
  const w = clean(key);
  if (w.length) {
    const sorted = w.split('').map((c, i) => [c, i] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    const ord = new Array(w.length);
    sorted.forEach(([, i], r) => (ord[i] = r + 1));
    return ord;
  }
  return Array.from({ length: n }, (_, i) => i + 1);
}

export const columnar: AlgorithmDef = {
  id: 'columnar', topic: 2, name: 'Jadval (ustunli) transpozitsiya',
  short: 'Matn qatorlab yoziladi, kalit tartibida ustunlab o‘qiladi',
  theory: ['Transpozitsiyada harflarning o‘zi o‘zgarmaydi, faqat o‘rni o‘zgaradi — shuning uchun harflar chastotasi saqlanadi.', 'Kalit: ustunlar o‘qilish tartibi (masalan 3 1 4 2) yoki kalit so‘z (harflar alifbo bo‘yicha tartiblanadi). Kalit bo‘sh bo‘lsa 1,2,…,N tartibida o‘qiladi.'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'INFORMATIONSECURITY' }, { key: 'key', label: 'Kalit (3 1 4 2 yoki so‘z)', type: 'text', default: '3 1 4 2' }, { key: 'cols', label: 'Ustunlar soni (kalit bo‘sh bo‘lsa)', type: 'number', default: '4' }],
  examples: [{ label: 'KRIPTOGRAFIYA, 4 ustun, kalitsiz', values: { mode: 'enc', text: 'KRIPTOGRAFIYA', key: '', cols: '4' } }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const ord = keyOrder(val(v, 'key'), Math.max(2, int(v, 'cols')));
    const n = ord.length;
    const rowsN = Math.ceil(text.length / n);
    const readOrder = ord.map((o, c) => [o, c] as const).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
    let grid: string[][];
    let out = '';
    if (enc) {
      const padded = text.padEnd(rowsN * n, 'X');
      grid = Array.from({ length: rowsN }, (_, r) => padded.slice(r * n, r * n + n).split(''));
      steps.push({ title: 'Matnni qatorlab yozish', text: `${n} ustunli jadval, yetmagan joylar X bilan to‘ldiriladi.`, visuals: [{ kind: 'grids', items: [{ title: `Tartib: ${ord.join(' ')}`, cells: [ord.map(String), ...grid], hl: ord.map((_, c) => [0, c] as [number, number]) }] }] });
      const rows = readOrder.map((c, i) => { const col = grid.map((r) => r[c]).join(''); out += col; return [`${i + 1}-o‘qish`, `${c + 1}-ustun (raqam ${ord[c]})`, col]; });
      steps.push({ title: 'Ustunlarni kalit tartibida o‘qish', visuals: [{ kind: 'table', headers: ['Navbat', 'Ustun', 'Harflar'], rows }] });
    } else {
      if (text.length % n) throw new Error(`Shifrmatn uzunligi ${n} ga karrali bo‘lishi kerak`);
      grid = Array.from({ length: rowsN }, () => new Array(n).fill(''));
      let p = 0;
      const rows: (string | number)[][] = [];
      for (const c of readOrder) { const chunk = text.slice(p, p + rowsN); p += rowsN; chunk.split('').forEach((ch, r) => (grid[r][c] = ch)); rows.push([`${c + 1}-ustun`, chunk]); }
      steps.push({ title: 'Shifrmatnni ustunlarga qaytarish', visuals: [{ kind: 'table', headers: ['Ustun', 'Harflar'], rows }] });
      out = grid.map((r) => r.join('')).join('');
      steps.push({ title: 'Qatorlab o‘qish', visuals: [{ kind: 'grids', items: [{ title: `Tartib: ${ord.join(' ')}`, cells: [ord.map(String), ...grid] }] }] });
    }
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- Hill 2x2 ---------- */
export const hill: AlgorithmDef = {
  id: 'hill', topic: 2, name: 'Hill shifri (2×2)',
  short: 'Matn juftliklari kalit matritsaga ko‘paytiriladi',
  theory: ['Kalit K — 2×2 matritsa. Shart: det(K) ≠ 0 va EKUB(det K, 26) = 1, aks holda K⁻¹ mavjud emas.', 'K⁻¹ = det⁻¹ · adj(K) mod 26. Known-plaintext hujumiga zaif.'],
  formulas: ['C = K·P mod 26', 'P = K⁻¹·C mod 26'],
  fields: [modeField, { key: 'text', label: 'Matn', type: 'text', default: 'HI' }, { key: 'k', label: 'Kalit (a b c d)', type: 'text', default: '3 3 2 5' }],
  examples: [{ label: 'TC → deshifr', values: { mode: 'dec', text: 'TC', k: '3 3 2 5' } }, { label: 'HELP', values: { mode: 'enc', text: 'HELP', k: '3 3 2 5' } }],
  run(v) {
    const { text, enc, steps } = prep(v);
    const k = val(v, 'k').split(/[\s,]+/).map(Number);
    if (k.length !== 4 || k.some((x) => !Number.isInteger(x))) throw new Error('Kalit 4 ta butun son: a b c d');
    const [a, b, c, d] = k.map((x) => modn(x, 26));
    const det = modn(a * d - b * c, 26);
    const g = Number(gcd(BigInt(det), 26n));
    steps.push({ title: 'Kalit matritsa va determinant', visuals: [
      { kind: 'grids', items: [{ title: 'K', cells: [[String(a), String(b)], [String(c), String(d)]], tone: 'blue' }] },
      { kind: 'formula', text: `det(K) = ${a}·${d} − ${b}·${c} = ${a * d - b * c} ≡ ${det} (mod 26),  EKUB(${det}, 26) = ${g}` },
      g === 1 ? { kind: 'note', tone: 'ok', text: 'K teskarilanuvchi' } : { kind: 'note', tone: 'warn', text: 'K teskarilanmaydi — bu kalit yaroqsiz!' },
    ] });
    if (g !== 1) throw new Error('EKUB(det K, 26) ≠ 1');
    let M = [a, b, c, d];
    if (!enc) {
      let di = 1; while ((det * di) % 26 !== 1) di++;
      M = [modn(di * d, 26), modn(-di * b, 26), modn(-di * c, 26), modn(di * a, 26)];
      steps.push({ title: 'Teskari matritsa K⁻¹', visuals: [
        { kind: 'formula', text: `det⁻¹ = ${det}⁻¹ mod 26 = ${di}` },
        { kind: 'grids', items: [{ title: 'adj(K)', cells: [[String(d), String(-b)], [String(-c), String(a)]] }, { title: 'K⁻¹ = det⁻¹·adj mod 26', cells: [[String(M[0]), String(M[1])], [String(M[2]), String(M[3])]], tone: 'green' }], ops: ['→'] },
      ] });
    }
    const t = text.length % 2 ? text + 'X' : text;
    let out = '';
    const rows: (string | number)[][] = [];
    for (let i = 0; i < t.length; i += 2) {
      const p1 = idx(t[i]), p2 = idx(t[i + 1]);
      const r1 = modn(M[0] * p1 + M[1] * p2, 26), r2 = modn(M[2] * p1 + M[3] * p2, 26);
      out += AB[r1] + AB[r2];
      rows.push([t[i] + t[i + 1], `[${p1}, ${p2}]`, `${M[0]}·${p1} + ${M[1]}·${p2} = ${M[0] * p1 + M[1] * p2} ≡ ${r1}`, `${M[2]}·${p1} + ${M[3]}·${p2} = ${M[2] * p1 + M[3] * p2} ≡ ${r2}`, AB[r1] + AB[r2]]);
    }
    steps.push({ title: 'Juftliklarni matritsaga ko‘paytirish', text: t !== text ? 'Matn uzunligi toq — oxiriga X qo‘shildi.' : undefined, visuals: [{ kind: 'table', headers: ['Juftlik', 'Vektor', '1-qator', '2-qator', 'Natija'], rows }] });
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

/* ---------- XOR ---------- */
export const xorCipher: AlgorithmDef = {
  id: 'xor', topic: 2, name: 'XOR shifrlash',
  short: 'C = P ⊕ K — bitma-bit, o‘ziga teskari amal',
  theory: ['XOR o‘ziga teskari: (P ⊕ K) ⊕ K = P. Shuning uchun shifrlash va deshifrlash bir xil amal.', 'Kalit takrorlansa zaif. Kalit matn uzunligida, tasodifiy va bir martalik bo‘lsa — One-Time Pad (mutlaq maxfiylik).'],
  formulas: ['Cᵢ = Pᵢ ⊕ Kᵢ', 'Pᵢ = Cᵢ ⊕ Kᵢ'],
  fields: [
    { key: 'mode', label: 'Rejim', type: 'select', default: 'enc', options: [{ value: 'enc', label: 'Shifrlash (matn → hex)' }, { value: 'dec', label: 'Deshifrlash (hex → matn)' }] },
    { key: 'text', label: 'Matn yoki hex', type: 'text', default: 'H' },
    { key: 'key', label: 'Kalit (matn)', type: 'text', default: '-' },
  ],
  examples: [{ label: '"H" ⊕ 45 (\'-\')', values: { mode: 'enc', text: 'H', key: '-' } }, { label: 'SALOM / KEY', values: { mode: 'enc', text: 'SALOM', key: 'KEY' } }],
  run(v) {
    const enc = val(v, 'mode') !== 'dec';
    const data = enc ? utf8(val(v, 'text')) : fromHex(val(v, 'text'), undefined, 'Shifrmatn');
    const key = utf8(val(v, 'key'));
    if (!data.length || !key.length) throw new Error('Matn va kalit kiriting');
    const res = data.map((b, i) => b ^ key[i % key.length]);
    const steps: Step[] = [{
      title: 'Baytlarga o‘tkazish', visuals: [{ kind: 'table', headers: ['#', 'Kirish', 'Kalit'], rows: data.map((b, i) => [i, `${b} (0x${hex2(b)})${enc ? ` '${String.fromCharCode(b)}'` : ''}`, `${key[i % key.length]} '${String.fromCharCode(key[i % key.length])}'`]) }],
    }];
    data.slice(0, 8).forEach((b, i) => {
      const kk = key[i % key.length], r = res[i];
      steps.push({ title: `${i + 1}-bayt: bitma-bit XOR`, visuals: [{ kind: 'bits', rows: [
        { label: enc ? `P = ${b}` : `C = ${b}`, bits: bin8(b) },
        { label: `K = ${kk}`, bits: bin8(kk), hl: bin8(kk).split('').map((x, j) => (x === '1' ? j : -1)).filter((j) => j >= 0) },
        { label: `${enc ? 'C' : 'P'} = ${r}`, bits: bin8(r), sep: true },
      ] }, { kind: 'note', tone: 'info', text: `Tekshiruv: ${r} ⊕ ${kk} = ${r ^ kk}` }] });
    });
    const out = enc ? toHex(res) : new TextDecoder().decode(new Uint8Array(res));
    return { steps, output: [{ label: enc ? 'Shifrmatn (hex)' : 'Ochiq matn', value: out }] };
  },
};

export const T2 = [caesar, atbash, mono, affine, vigenere, columnar, hill, xorCipher];
