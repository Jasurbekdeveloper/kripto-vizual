import { AlgorithmDef, Step, Visual } from '../core/models';
import { bin8, fromHex, hex2, stateGrid, toHex, val } from '../core/util';

/* ---------------------------------------------------------------
 * 5-MAVZU: AES (FIPS-197)
 * ------------------------------------------------------------- */

export const xtime = (a: number): number => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
export function gmul(a: number, b: number): number {
  let r = 0;
  while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; }
  return r;
}

/** S-box GF(2^8) dagi teskari element + affin almashtirish orqali quriladi */
export const SBOX: number[] = (() => {
  const inv = new Array(256).fill(0);
  for (let a = 1; a < 256; a++) for (let b = 1; b < 256; b++) if (gmul(a, b) === 1) { inv[a] = b; break; }
  return inv.map((b) => {
    let s = b;
    for (let i = 1; i <= 4; i++) s ^= ((b << i) | (b >> (8 - i))) & 0xff;
    return s ^ 0x63;
  });
})();
export const INV_SBOX: number[] = (() => { const t = new Array(256); SBOX.forEach((v, i) => (t[v] = i)); return t; })();

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];

export function keyExpansion(key: number[]): { w: number[][]; log: (string | number)[][] } {
  const Nk = key.length / 4, Nr = Nk + 6;
  const w: number[][] = [];
  const log: (string | number)[][] = [];
  for (let i = 0; i < Nk; i++) { w.push(key.slice(4 * i, 4 * i + 4)); log.push([`w${i}`, '—', '—', '—', '—', toHex(w[i])]); }
  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    let t = [...w[i - 1]];
    let rot = '—', subw = '—', rc = '—';
    if (i % Nk === 0) {
      t = [t[1], t[2], t[3], t[0]]; rot = toHex(t);
      t = t.map((b) => SBOX[b]); subw = toHex(t);
      t[0] ^= RCON[i / Nk - 1]; rc = toHex([RCON[i / Nk - 1], 0, 0, 0]);
    } else if (Nk > 6 && i % Nk === 4) {
      t = t.map((b) => SBOX[b]); subw = toHex(t);
    }
    w.push(w[i - Nk].map((b, j) => b ^ t[j]));
    log.push([`w${i}`, toHex(w[i - 1]), rot, subw, rc, toHex(w[i])]);
  }
  return { w, log };
}

const shiftRows = (s: number[]): number[] => s.map((_, i) => { const r = i % 4, c = Math.floor(i / 4); return s[r + 4 * ((c + r) % 4)]; });
const invShiftRows = (s: number[]): number[] => s.map((_, i) => { const r = i % 4, c = Math.floor(i / 4); return s[r + 4 * ((c - r + 4) % 4)]; });
function mixCols(s: number[], inv = false): number[] {
  const M = inv ? [14, 11, 13, 9] : [2, 3, 1, 1];
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let x = 0;
    for (let k = 0; k < 4; k++) x ^= gmul(s[k + 4 * c], M[(k - r + 4) % 4]);
    o[r + 4 * c] = x;
  }
  return o;
}
const rk = (w: number[][], r: number): number[] => [...w[4 * r], ...w[4 * r + 1], ...w[4 * r + 2], ...w[4 * r + 3]];
const xor = (a: number[], b: number[]): number[] => a.map((x, i) => x ^ b[i]);
const all: [number, number][] = [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => [r, c] as [number, number]));

function mixDetail(col: number[]): Visual[] {
  const names = ['b₀', 'b₁', 'b₂', 'b₃'];
  const M = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
  return M.map((row, r) => {
    const terms = row.map((m, k) => (m === 1 ? hex2(col[k]) : `${hex2(m)}·${hex2(col[k])}=${hex2(gmul(m, col[k]))}`));
    const res = row.reduce((acc, m, k) => acc ^ gmul(m, col[k]), 0);
    return { kind: 'formula', text: `${names[r]} = ${terms.join(' ⊕ ')} = ${hex2(res)}` } as Visual;
  });
}

export const aes: AlgorithmDef = {
  id: 'aes', topic: 5, name: 'AES: to‘liq shifrlash / deshifrlash',
  short: 'SubBytes → ShiftRows → MixColumns → AddRoundKey, kalit kengaytirish bilan (128/192/256)',
  theory: [
    'AES — SPN tuzilmali blokli shifr: blok 128 bit, kalit 128/192/256 bit, raundlar 10/12/14.',
    'State 4×4 bayt matritsa, USTUNLAR bo‘yicha to‘ldiriladi (column-major).',
    '0-raund: faqat AddRoundKey. 1…Nr−1: SubBytes, ShiftRows, MixColumns, AddRoundKey. Oxirgi raundda MixColumns yo‘q.',
    'SubBytes — nochiziqlilik (confusion), ShiftRows + MixColumns — diffuziya, AddRoundKey — kalitni aralashtirish.',
  ],
  formulas: ['b₀ = 02·a₀ ⊕ 03·a₁ ⊕ a₂ ⊕ a₃', 'xtime(a) = (a≪1) ⊕ (a₇ ? 1B : 0)', 'm(x) = x⁸+x⁴+x³+x+1 (0x11B)'],
  fields: [
    { key: 'mode', label: 'Rejim', type: 'select', default: 'enc', options: [{ value: 'enc', label: 'Shifrlash' }, { value: 'dec', label: 'Deshifrlash' }] },
    { key: 'text', label: 'Blok (32 hex)', type: 'text', default: '00112233445566778899aabbccddeeff' },
    { key: 'key', label: 'Kalit (32/48/64 hex)', type: 'text', default: '000102030405060708090a0b0c0d0e0f' },
  ],
  examples: [
    { label: 'FIPS-197 B ilova', values: { mode: 'enc', text: '3243f6a8885a308d313198a2e0370734', key: '2b7e151628aed2a6abf7158809cf4f3c' } },
    { label: 'AES-256 (FIPS C.3)', values: { mode: 'enc', text: '00112233445566778899aabbccddeeff', key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f' } },
    { label: 'Deshifr: 69c4e0d8…', values: { mode: 'dec', text: '69c4e0d86a7b0430d8cdb78070b4c55a', key: '000102030405060708090a0b0c0d0e0f' } },
  ],
  run(v) {
    const enc = val(v, 'mode') !== 'dec';
    const input = fromHex(val(v, 'text'), 16, 'Blok');
    const key = fromHex(val(v, 'key'), undefined, 'Kalit');
    if (![16, 24, 32].includes(key.length)) throw new Error('Kalit 16, 24 yoki 32 bayt bo‘lishi kerak');
    const Nr = key.length / 4 + 6;
    const { w, log } = keyExpansion(key);
    const steps: Step[] = [];
    steps.push({ title: 'Blokni State matritsaga joylash', text: 'Baytlar ustunlar bo‘yicha yoziladi: s[r][c] = in[r + 4c].', visuals: [
      { kind: 'bytes', title: 'Kirish baytlari', bytes: input.map(hex2) },
      { kind: 'grids', items: [{ title: 'State', cells: stateGrid(input), tone: 'blue' }, { title: `Kalit (AES-${key.length * 8}, Nr = ${Nr})`, cells: stateGrid(key.slice(0, 16)), tone: 'orange' }] },
    ] });
    steps.push({ title: 'Kalitni kengaytirish (Key Expansion)', text: 'i mod Nk = 0 bo‘lganda: temp = SubWord(RotWord(w[i−1])) ⊕ Rcon. So‘ng w[i] = w[i−Nk] ⊕ temp.', visuals: [{ kind: 'table', headers: ['So‘z', 'w[i−1]', 'RotWord', 'SubWord', 'Rcon', 'w[i]'], rows: log, hlRows: log.map((r, i) => (r[2] !== '—' ? i : -1)).filter((i) => i >= 0) }] });
    steps.push({ title: 'Raund kalitlari', visuals: [{ kind: 'table', headers: ['Raund', 'Kalit Kᵢ'], rows: Array.from({ length: Nr + 1 }, (_, r) => [r, toHex(rk(w, r))]) }] });

    let s = input;
    const ark = (r: number, title: string) => {
      const k = rk(w, r), o = xor(s, k);
      steps.push({ title, visuals: [{ kind: 'grids', items: [{ title: 'State', cells: stateGrid(s) }, { title: `K${r}`, cells: stateGrid(k), tone: 'orange' }, { title: 'Natija', cells: stateGrid(o), tone: 'green', hl: all }], ops: ['⊕', '='] }, { kind: 'formula', text: `Masalan: ${hex2(s[0])} ⊕ ${hex2(k[0])} = ${hex2(o[0])}  (${bin8(s[0])} ⊕ ${bin8(k[0])} = ${bin8(o[0])})` }] });
      s = o;
    };
    if (enc) {
      ark(0, '0-raund: AddRoundKey');
      for (let r = 1; r <= Nr; r++) {
        const sb = s.map((b) => SBOX[b]);
        steps.push({ title: `${r}-raund: SubBytes`, text: 'Har bir bayt S-box orqali almashtiriladi: yuqori 4 bit — qator, quyi 4 bit — ustun.', visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s) }, { title: 'SubBytes', cells: stateGrid(sb), tone: 'purple', hl: all }], ops: ['→'] }, { kind: 'formula', text: `${hex2(s[0])} → S[${hex2(s[0])[0]}][${hex2(s[0])[1]}] = ${hex2(sb[0])},   ${hex2(s[1])} → S[${hex2(s[1])[0]}][${hex2(s[1])[1]}] = ${hex2(sb[1])}` }] });
        s = sb;
        const sr = shiftRows(s);
        steps.push({ title: `${r}-raund: ShiftRows`, text: '0-qator joyida, 1-qator 1 ta, 2-qator 2 ta, 3-qator 3 ta bayt chapga aylanma siljiydi.', visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s) }, { title: 'ShiftRows', cells: stateGrid(sr), tone: 'blue', hl: all.filter(([rr]) => rr > 0) }], ops: ['→'] }] });
        s = sr;
        if (r < Nr) {
          const mc = mixCols(s);
          steps.push({ title: `${r}-raund: MixColumns`, text: 'Har bir ustun GF(2⁸) da [02 03 01 01] sirkulyant matritsaga ko‘paytiriladi. 1-ustun hisobi:', visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s), hl: [[0, 0], [1, 0], [2, 0], [3, 0]] }, { title: 'MixColumns', cells: stateGrid(mc), tone: 'green', hl: [[0, 0], [1, 0], [2, 0], [3, 0]] }], ops: ['→'] }, ...mixDetail(s.slice(0, 4))] });
          s = mc;
        } else {
          steps.push({ title: `${r}-raund (oxirgi): MixColumns YO‘Q`, visuals: [{ kind: 'note', tone: 'info', text: 'Oxirgi raundda MixColumns bajarilmaydi — shifrlash va deshifrlash tuzilmasi simmetrik bo‘lishi uchun.' }] });
        }
        ark(r, `${r}-raund: AddRoundKey`);
      }
    } else {
      ark(Nr, `Boshlang‘ich AddRoundKey (K${Nr})`);
      for (let r = Nr - 1; r >= 0; r--) {
        const isr = invShiftRows(s);
        steps.push({ title: `InvShiftRows`, visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s) }, { title: 'InvShiftRows', cells: stateGrid(isr), tone: 'blue' }], ops: ['→'] }] });
        s = isr;
        const isb = s.map((b) => INV_SBOX[b]);
        steps.push({ title: `InvSubBytes`, visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s) }, { title: 'InvSubBytes', cells: stateGrid(isb), tone: 'purple' }], ops: ['→'] }] });
        s = isb;
        ark(r, `AddRoundKey (K${r})`);
        if (r > 0) {
          const imc = mixCols(s, true);
          steps.push({ title: `InvMixColumns`, text: 'Teskari matritsa koeffitsientlari: 0e 0b 0d 09.', visuals: [{ kind: 'grids', items: [{ title: 'Oldin', cells: stateGrid(s) }, { title: 'InvMixColumns', cells: stateGrid(imc), tone: 'green' }], ops: ['→'] }] });
          s = imc;
        }
      }
    }
    steps.push({ title: 'Natija', visuals: [{ kind: 'bytes', title: enc ? 'Shifrmatn' : 'Ochiq matn', bytes: s.map(hex2), hl: s.map((_, i) => i) }] });
    return { steps, output: [{ label: enc ? 'Shifrmatn' : 'Ochiq matn', value: toHex(s) }] };
  },
};

/* ---------- GF(2^8) kalkulyator ---------- */
export const gf256: AlgorithmDef = {
  id: 'gf256', topic: 5, name: 'GF(2⁸) ko‘paytirish va xtime',
  short: 'a·b ni siljitish va 0x1B bilan XOR orqali — AES MixColumns asosi',
  theory: ['GF(2⁸) da qo‘shish = XOR. ×02 (xtime): chapga siljitish, agar eng katta bit 1 bo‘lsa 0x1B bilan XOR.', '×03 = ×02 ⊕ ×01. Umumiy a·b — b ning bitlari bo‘yicha xtime natijalarini XOR qilish.'],
  formulas: ['xtime(a) = (a ≪ 1) ⊕ (a₇·0x1B)', 'a·03 = xtime(a) ⊕ a'],
  fields: [
    { key: 'a', label: 'a (hex)', type: 'text', default: '57' },
    { key: 'b', label: 'b (hex)', type: 'text', default: '13' },
    { key: 'poly', label: 'Modul polinom', type: 'select', default: '11b', options: [{ value: '11b', label: 'AES: x⁸+x⁴+x³+x+1 (0x11B)' }, { value: '1c3', label: 'Kuznechik: x⁸+x⁷+x⁶+x+1 (0x1C3)' }] },
  ],
  examples: [{ label: '57 × 02', values: { a: '57', b: '02', poly: '11b' } }, { label: '57 × 03', values: { a: '57', b: '03', poly: '11b' } }, { label: '83 × 02', values: { a: '83', b: '02', poly: '11b' } }, { label: '94 × 03 (Kuznechik)', values: { a: '94', b: '03', poly: '1c3' } }],
  run(v) {
    const [a] = fromHex(val(v, 'a').padStart(2, '0'), 1, 'a');
    const [b] = fromHex(val(v, 'b').padStart(2, '0'), 1, 'b');
    const red = val(v, 'poly') === '1c3' ? 0xc3 : 0x1b;
    const xt = (x: number) => ((x << 1) ^ (x & 0x80 ? red : 0)) & 0xff;
    const steps: Step[] = [{ title: 'Ikkilik ko‘rinish', visuals: [{ kind: 'bits', rows: [{ label: `a = ${hex2(a)}`, bits: bin8(a) }, { label: `b = ${hex2(b)}`, bits: bin8(b), hl: bin8(b).split('').map((x, i) => (x === '1' ? i : -1)).filter((i) => i >= 0) }] }] }];
    const rows: (string | number)[][] = [];
    let cur = a, acc = 0;
    for (let i = 0; i < 8; i++) {
      const used = (b >> i) & 1;
      if (used) acc ^= cur;
      rows.push([`a·${hex2(1 << i)}`, hex2(cur), bin8(cur), used ? 'HA' : '—']);
      const msb = cur & 0x80;
      const next = xt(cur);
      if (i < 7 && (b >> (i + 1))) steps.push({ title: `xtime: a·${hex2(1 << (i + 1))}`, visuals: [{ kind: 'bits', rows: [{ label: hex2(cur), bits: bin8(cur), hl: [0] }, { label: '≪ 1', bits: bin8((cur << 1) & 0xff) }, ...(msb ? [{ label: `⊕ ${hex2(red)}`, bits: bin8(red) }] : []), { label: `= ${hex2(next)}`, bits: bin8(next), sep: true }] }, { kind: 'note', tone: 'info', text: msb ? `Eng katta bit 1 — ${hex2(red)} bilan XOR qilindi` : 'Eng katta bit 0 — faqat siljitish' }] });
      cur = next;
    }
    steps.push({ title: 'Kerakli qismlarni XOR qilish', visuals: [{ kind: 'table', headers: ['Daraja', 'Hex', 'Ikkilik', 'b da bormi'], rows, hlRows: rows.map((r, i) => (r[3] === 'HA' ? i : -1)).filter((i) => i >= 0) }, { kind: 'note', tone: 'ok', text: `${hex2(a)} · ${hex2(b)} = ${hex2(acc)}` }] });
    return { steps, output: [{ label: 'a·b', value: hex2(acc) }] };
  },
};

/* ---------- MixColumns bitta ustun ---------- */
export const mixColumn: AlgorithmDef = {
  id: 'mixcolumn', topic: 5, name: 'MixColumns — bitta ustun',
  short: 'b = M·a, M = [02 03 01 01] sirkulyant matritsa',
  theory: ['Har bir chiqish bayti kirish ustunining 4 baytiga bog‘liq — kuchli diffuziya. Tarqalish soni 5 (MDS).'],
  formulas: ['b₀ = 02·a₀ ⊕ 03·a₁ ⊕ a₂ ⊕ a₃', 'b₁ = a₀ ⊕ 02·a₁ ⊕ 03·a₂ ⊕ a₃', 'b₂ = a₀ ⊕ a₁ ⊕ 02·a₂ ⊕ 03·a₃', 'b₃ = 03·a₀ ⊕ a₁ ⊕ a₂ ⊕ 02·a₃'],
  fields: [{ key: 'col', label: 'Ustun (4 bayt hex)', type: 'text', default: 'd4bf5d30' }],
  examples: [{ label: 'e0 b4 52 ae', values: { col: 'e0b452ae' } }, { label: 'db 13 53 45', values: { col: 'db135345' } }],
  run(v) {
    const a = fromHex(val(v, 'col'), 4, 'Ustun');
    const b = mixCols([...a, ...a, ...a, ...a]).slice(0, 4);
    const steps: Step[] = [{ title: 'Matritsa ko‘paytmasi', visuals: [{ kind: 'grids', items: [{ title: 'M', cells: [['02', '03', '01', '01'], ['01', '02', '03', '01'], ['01', '01', '02', '03'], ['03', '01', '01', '02']], tone: 'orange' }, { title: 'a', cells: a.map((x) => [hex2(x)]), tone: 'blue' }, { title: 'b', cells: b.map((x) => [hex2(x)]), tone: 'green', hl: [[0, 0], [1, 0], [2, 0], [3, 0]] }], ops: ['·', '='] }] }];
    a.forEach((x, i) => steps.push({ title: `Yordamchi: ${hex2(x)}·02 va ${hex2(x)}·03`, visuals: [{ kind: 'bits', rows: [{ label: hex2(x), bits: bin8(x), hl: [0] }, { label: `·02 = ${hex2(xtime(x))}`, bits: bin8(xtime(x)) }, { label: `·03 = ${hex2(xtime(x) ^ x)}`, bits: bin8(xtime(x) ^ x), sep: true }] }, { kind: 'note', tone: 'info', text: x & 0x80 ? `${hex2(x)} da eng katta bit 1 → (≪1) ⊕ 1B` : `${hex2(x)} da eng katta bit 0 → faqat ≪1` }] }));
    steps.push({ title: 'Har bir chiqish bayti', visuals: mixDetail(a) });
    return { steps, output: [{ label: 'Natija ustun', value: b.map(hex2).join(' ') }] };
  },
};

export const sboxLookup: AlgorithmDef = {
  id: 'aes-sbox', topic: 5, name: 'AES S-box jadvali',
  short: 'Baytning S-box qiymatini qator/ustun bo‘yicha topish',
  theory: ['S-box: GF(2⁸) dagi multiplikativ teskari element + affin almashtirish (c = 0x63). Masalan 53 → ED.'],
  fields: [{ key: 'bytes', label: 'Baytlar (hex, probel bilan)', type: 'text', default: '53 00 7c 09 ff 19' }],
  run(v) {
    const bs = fromHex(val(v, 'bytes'), undefined, 'Baytlar');
    const head = ['x\\y', ...'0123456789abcdef'.split('')];
    const rows = Array.from({ length: 16 }, (_, r) => [r.toString(16), ...Array.from({ length: 16 }, (_, c) => hex2(SBOX[16 * r + c]))]);
    const hlCells: [number, number][] = bs.map((b) => [b >> 4, (b & 15) + 1]);
    return {
      steps: [
        { title: 'S-box jadvali', visuals: [{ kind: 'table', headers: head, rows, hlCells }] },
        { title: 'Qidiruv', visuals: [{ kind: 'table', headers: ['Kirish', 'Qator (yuqori 4 bit)', 'Ustun (quyi 4 bit)', 'S-box'], rows: bs.map((b) => [hex2(b), hex2(b)[0], hex2(b)[1], hex2(SBOX[b])]) }] },
      ],
      output: [{ label: 'Natija', value: bs.map((b) => hex2(SBOX[b])).join(' ') }],
    };
  },
};

export const T5 = [aes, gf256, mixColumn, sboxLookup];
