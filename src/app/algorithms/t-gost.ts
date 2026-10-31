import { AlgorithmDef, Step } from '../core/models';
import { big, fromHex, hex2, isPrime, int, mod, modInv, modPow, toHex, utf8, val } from '../core/util';
import { PI } from './t4-kuznechik';
import { STREEBOG_A, STREEBOG_C } from './gost-const';
import { Curve, Pt, show } from './t9-ecc';

/* =====================================================================
 * ROSSIYA STANDARTLARI (GOST)
 *  - GOST 28147-89 / GOST R 34.12-2015 «Magma» — 64 bitli blok shifr
 *  - GOST R 34.11-94 — xesh (28147-89 asosida)
 *  - GOST R 34.11-2012 «Streebog» — xesh 256/512
 *  - GOST R 34.10-94 — imzo (GF(p) da, DSA ga o'xshash)
 *  - GOST R 34.10-2012 — imzo (elliptik egri chiziqda)
 * ===================================================================== */

const h8 = (x: number): string => (x >>> 0).toString(16).padStart(8, '0');
const rol11 = (x: number): number => ((x << 11) | (x >>> 21)) >>> 0;

/* ---------- S-bloklar ---------- */
export const SBOX_Z = [ // GOST R 34.12-2015 (id-tc26-gost-28147-param-Z), pi'_0 … pi'_7
  [12, 4, 6, 2, 10, 5, 11, 9, 14, 8, 13, 7, 0, 3, 15, 1], [6, 8, 2, 3, 9, 10, 5, 12, 1, 14, 4, 7, 11, 13, 0, 15],
  [11, 3, 5, 8, 2, 15, 10, 13, 14, 1, 7, 4, 12, 9, 6, 0], [12, 8, 2, 1, 13, 4, 15, 6, 7, 0, 10, 5, 3, 14, 9, 11],
  [7, 15, 5, 10, 8, 1, 6, 13, 0, 9, 3, 14, 11, 4, 2, 12], [5, 13, 15, 6, 9, 2, 12, 10, 11, 7, 8, 1, 4, 3, 14, 0],
  [8, 14, 2, 5, 6, 9, 1, 12, 15, 4, 11, 0, 13, 10, 3, 7], [1, 7, 14, 13, 0, 5, 8, 3, 4, 15, 10, 6, 9, 12, 11, 2],
];
export const SBOX_TEST_3411 = [ // id-GostR3411-94-TestParamSet
  [4, 10, 9, 2, 13, 8, 0, 14, 6, 11, 1, 12, 7, 15, 5, 3], [14, 11, 4, 12, 6, 13, 15, 10, 2, 3, 8, 1, 0, 7, 5, 9],
  [5, 8, 1, 13, 10, 3, 4, 2, 14, 15, 12, 7, 6, 0, 9, 11], [7, 13, 10, 1, 0, 8, 9, 15, 14, 4, 6, 12, 11, 2, 5, 3],
  [6, 12, 7, 1, 5, 15, 13, 8, 4, 10, 9, 14, 0, 3, 11, 2], [4, 11, 10, 0, 7, 2, 1, 13, 3, 6, 8, 5, 9, 12, 15, 14],
  [13, 11, 4, 1, 3, 15, 5, 9, 0, 10, 14, 7, 6, 8, 2, 12], [1, 15, 13, 0, 5, 7, 10, 4, 9, 2, 3, 14, 6, 11, 8, 12],
];
const tT = (s: number[][], x: number): number => { let r = 0; for (let i = 0; i < 8; i++) r |= s[i][(x >>> (4 * i)) & 15] << (4 * i); return r >>> 0; };
const gFun = (s: number[][], a: number, k: number): number => rol11(tT(s, (a + k) >>> 0));
const SEQ_ENC = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0];

/** GOST 28147-89 ichki yadrosi (n1 = o'ng/kichik yarim, n2 = chap) — 34.11-94 uchun */
function gost28147Enc(s: number[][], keyWords: number[], n1: number, n2: number): [number, number] {
  for (const i of SEQ_ENC) [n1, n2] = [(gFun(s, n1, keyWords[i]) ^ n2) >>> 0, n1];
  return [n2, n1]; // oxirgi raundda almashtirish yo'q
}

/* ================= MAGMA ================= */
export const magma: AlgorithmDef = {
  id: 'magma', topic: 4, name: 'Magma (GOST R 34.12-2015 / GOST 28147-89)',
  short: '64 bit blok, 256 bit kalit, 32 raundli Feistel tarmog‘i',
  theory: [
    'GOST 28147-89 — 1989-yildagi SSSR blok shifri; 2015-yilda GOST R 34.12-2015 standartiga «Magma» nomi bilan, qat’iy belgilangan S-bloklar bilan kiritildi.',
    'Blok 64 bit (a₁ ‖ a₀, har biri 32 bit), kalit 256 bit = 8 ta 32 bitli kalit K₁…K₈, 32 raund. Raund kalitlari: K₁…K₈ uch marta to‘g‘ri tartibda, so‘ng K₈…K₁.',
    'Raund funksiyasi g[k](a) = (t(a ⊞ k)) ⋘ 11: mod 2³² qo‘shish, 8 ta 4-bitli S-blok (t), 11 bitga chapga siklik siljitish.',
    'Feistel: (a₁, a₀) → (a₀, g[k](a₀) ⊕ a₁). Oxirgi raundda yarmlar almashtirilmaydi. Deshifrlash — kalitlar teskari tartibda.',
  ],
  formulas: ['g[k](a) = t(a ⊞ k) ⋘ 11', 'G[k](a₁, a₀) = (a₀, g[k](a₀) ⊕ a₁)', 'Kalitlar: K₁…K₈, K₁…K₈, K₁…K₈, K₈…K₁'],
  fields: [
    { key: 'mode', label: 'Rejim', type: 'select', default: 'enc', options: [{ value: 'enc', label: 'Shifrlash' }, { value: 'dec', label: 'Deshifrlash' }] },
    { key: 'text', label: 'Blok (16 hex)', type: 'text', default: 'fedcba9876543210' },
    { key: 'key', label: 'Kalit (64 hex)', type: 'text', default: 'ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff' },
    { key: 'sbox', label: 'S-bloklar', type: 'select', default: 'z', options: [{ value: 'z', label: 'GOST R 34.12-2015 (param-Z)' }, { value: 't', label: 'GOST R 34.11-94 test to‘plami' }] },
  ],
  examples: [{ label: 'Deshifr 4ee901e5…', values: { mode: 'dec', text: '4ee901e5c2d8ca3d', key: 'ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff', sbox: 'z' } }],
  run(v) {
    const enc = val(v, 'mode') !== 'dec';
    const s = val(v, 'sbox') === 't' ? SBOX_TEST_3411 : SBOX_Z;
    const blk = fromHex(val(v, 'text'), 8, 'Blok');
    const key = fromHex(val(v, 'key'), 32, 'Kalit');
    const K = Array.from({ length: 8 }, (_, i) => ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0);
    const seq = enc ? SEQ_ENC : [...SEQ_ENC].reverse();
    let a1 = ((blk[0] << 24) | (blk[1] << 16) | (blk[2] << 8) | blk[3]) >>> 0;
    let a0 = ((blk[4] << 24) | (blk[5] << 16) | (blk[6] << 8) | blk[7]) >>> 0;
    const steps: Step[] = [
      { title: 'Kalitni 8 ta 32 bitli qismga bo‘lish', visuals: [{ kind: 'kv', items: K.map((k, i) => ({ label: `K${i + 1}`, value: h8(k) })) }, { kind: 'formula', text: `Raund kalitlari tartibi: ${seq.map((i) => `K${i + 1}`).join(' ')}` }] },
      { title: 'S-bloklar (π₀ … π₇)', text: 'πᵢ 32 bitli so‘zning i-yarim baytiga (i = 0 — eng kichik) qo‘llaniladi.', visuals: [{ kind: 'table', headers: ['', ...Array.from({ length: 16 }, (_, i) => i.toString(16))], rows: s.map((r, i) => [`π${i}`, ...r.map((x) => x.toString(16))]) }] },
      { title: 'Blokni ikki yarimga bo‘lish', visuals: [{ kind: 'kv', items: [{ label: 'a₁ (chap)', value: h8(a1) }, { label: 'a₀ (o‘ng)', value: h8(a0) }] }] },
    ];
    const rows: (string | number)[][] = [];
    seq.forEach((ki, r) => {
      const sum = (a0 + K[ki]) >>> 0, t = tT(s, sum), g = rol11(t), na = (g ^ a1) >>> 0;
      if (r === 0) {
        const nibs = Array.from({ length: 8 }, (_, i) => 7 - i).map((i) => [`π${i}`, ((sum >>> (4 * i)) & 15).toString(16), ((t >>> (4 * i)) & 15).toString(16)]);
        steps.push({ title: '1-raund batafsil: g[K₁](a₀)', visuals: [
          { kind: 'formula', text: `a₀ ⊞ K = ${h8(a0)} + ${h8(K[ki])} mod 2³² = ${h8(sum)}` },
          { kind: 'table', caption: 't-almashtirish: har yarim bayt o‘z S-bloki orqali', headers: ['S-blok', 'kirish', 'chiqish'], rows: nibs },
          { kind: 'formula', text: `t(${h8(sum)}) = ${h8(t)},   ⋘ 11 = ${h8(g)}` },
          { kind: 'formula', text: `yangi a₀ = g ⊕ a₁ = ${h8(g)} ⊕ ${h8(a1)} = ${h8(na)};   yangi a₁ = eski a₀ = ${h8(a0)}` },
        ] });
      }
      rows.push([r + 1, `K${ki + 1}`, h8(a1), h8(a0), h8(sum), h8(t), h8(g), r < 31 ? `${h8(a0)} ‖ ${h8(na)}` : `${h8(na)} ‖ ${h8(a0)}`]);
      if (r < 31) [a1, a0] = [a0, na]; else a1 = na;
    });
    steps.push({ title: '32 raund', text: 'Oxirgi (32-) raundda yarmlar almashtirilmaydi.', visuals: [{ kind: 'table', headers: ['Raund', 'Kalit', 'a₁', 'a₀', 'a₀ ⊞ K', 't(·)', '⋘ 11', 'Natija'], rows, hlRows: [31] }] });
    const out = h8(a1) + h8(a0);
    steps.push({ title: 'Natija', visuals: [{ kind: 'note', tone: 'ok', text: `${enc ? 'Shifrmatn' : 'Ochiq matn'}: ${out}` }] });
    return { steps, output: [{ label: enc ? 'Shifrmatn' : 'Ochiq matn', value: out }] };
  },
};

/* ================= GOST R 34.11-94 ================= */
const C3_94 = fromHex('ff00ffff000000ffff0000ff00ffff0000ff00ff00ff00ffff00ff00ff00ff00');
const xorB = (a: number[], b: number[]): number[] => a.map((x, i) => x ^ b[i]);
const A94 = (x: number[]): number[] => [...xorB(x.slice(24, 32), x.slice(16, 24)), ...x.slice(0, 8), ...x.slice(8, 16), ...x.slice(16, 24)];
const P94 = (x: number[]): number[] => { const o: number[] = []; for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) o.push(x[i + 8 * k]); return o; };
const psi = (y: number[]): number[] => {
  const w = (i: number) => [y[32 - 2 * i], y[33 - 2 * i]]; // y_i (1..16), y16 — boshida
  const n = [0, 1].map((b) => w(1)[b] ^ w(2)[b] ^ w(3)[b] ^ w(4)[b] ^ w(13)[b] ^ w(16)[b]);
  return [...n, ...y.slice(0, 30)];
};
const le32 = (b: number[], o: number): number => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const fromLe32 = (x: number): number[] => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, (x >>> 24) & 255];

function step94(hin: number[], m: number[], log?: (rows: (string | number)[][], keys: string[], s: string) => void): number[] {
  const keys: number[][] = [];
  let u = hin, vv = m;
  keys.push(P94(xorB(u, vv)));
  for (const c of [null, C3_94, null]) {
    u = c ? xorB(A94(u), c) : A94(u);
    vv = A94(A94(vv));
    keys.push(P94(xorB(u, vv)));
  }
  const parts: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const hi = hin.slice(24 - 8 * i, 32 - 8 * i).reverse(); // h1 … h4
    const k = keys[i].slice().reverse();
    const kw = Array.from({ length: 8 }, (_, j) => le32(k, 4 * j));
    const [o1, o2] = gost28147Enc(SBOX_TEST_3411, kw, le32(hi, 0), le32(hi, 4));
    parts.push([...fromLe32(o1), ...fromLe32(o2)].reverse());
  }
  const S = [...parts[3], ...parts[2], ...parts[1], ...parts[0]];
  let x = S;
  for (let i = 0; i < 12; i++) x = psi(x);
  x = psi(xorB(x, m));
  x = xorB(hin, x);
  for (let i = 0; i < 61; i++) x = psi(x);
  log?.(parts.map((p, i) => [`s${i + 1} = E_K${i + 1}(h${i + 1})`, toHex(p)]), keys.map(toHex), toHex(S));
  return x;
}

export function gost3411_94(msg: number[], trace?: (t: { label: string; hin: string; m: string; keys: string[]; enc: (string | number)[][]; S: string; hout: string }) => void): string {
  let h = new Array(32).fill(0);
  let sum = 0n, len = 0;
  const run = (label: string, m: number[]) => {
    const hin = h;
    h = step94(h, m, (enc, keys, S) => trace?.({ label, hin: toHex(hin), m: toHex(m), keys, enc, S, hout: '' }));
  };
  const blocks: number[][] = [];
  for (let i = 0; i < msg.length; i += 32) blocks.push(msg.slice(i, i + 32).reverse());
  blocks.forEach((part, i) => {
    len += part.length * 8;
    sum = (sum + BigInt('0x' + (toHex(part) || '0'))) % (1n << 256n);
    const padded = [...new Array(32 - part.length).fill(0), ...part];
    run(`${i + 1}-blok`, padded);
  });
  const L = new Array(24).fill(0).concat(Array.from({ length: 8 }, (_, i) => Number((BigInt(len) >> BigInt(8 * (7 - i))) & 255n)));
  run('Uzunlik L', L);
  run('Nazorat yig‘indisi Σ', fromHex(sum.toString(16).padStart(64, '0')));
  return toHex(h.slice().reverse());
}

export const gost94hash: AlgorithmDef = {
  id: 'gost-3411-94', topic: 6, name: 'GOST R 34.11-94 xesh funksiyasi',
  short: '256 bitli xesh: kalit generatsiyasi + 4 × GOST 28147-89 + ψ aralashtirish',
  theory: [
    'GOST R 34.11-94 — Rossiyaning 1994-yildagi xesh standarti (2012-yildan Streebog bilan almashtirilgan). Xesh uzunligi 256 bit, blok 256 bit.',
    'Har bir qadam f(H, M): 1) kalit generatsiyasi — U, V, W = U ⊕ V, A va P almashtirishlari hamda C₃ konstanta bilan 4 ta 256 bitli kalit K₁…K₄; 2) shifrlash — H ni to‘rtta 64 bitli h₁…h₄ ga bo‘lib, har birini GOST 28147-89 bilan Kᵢ kalitda shifrlash: S = s₄‖s₃‖s₂‖s₁; 3) aralashtirish — H_out = ψ⁶¹(H ⊕ ψ(M ⊕ ψ¹²(S))).',
    'ψ(y₁₆‖…‖y₁) = (y₁ ⊕ y₂ ⊕ y₃ ⊕ y₄ ⊕ y₁₃ ⊕ y₁₆) ‖ y₁₆ ‖ … ‖ y₂ — 16 bitli so‘zlar ustida chiziqli qayta aloqali siljitish.',
    'Xabar 256 bitli bloklarga bo‘linadi; oxirida xabar uzunligi L va barcha bloklar yig‘indisi Σ (mod 2²⁵⁶) ham f orqali o‘tkaziladi. Bu yerda RFC 5831 dagi “test” S-bloklari ishlatiladi.',
  ],
  formulas: ['A(y₄‖y₃‖y₂‖y₁) = (y₁ ⊕ y₂)‖y₄‖y₃‖y₂', 'C₃ = ff00ffff000000ffff0000ff00ffff0000ff00ff00ff00ffff00ff00ff00ff00', 'H_out = ψ⁶¹(H_in ⊕ ψ(M ⊕ ψ¹²(S)))'],
  fields: [{ key: 'text', label: 'Xabar', type: 'text', default: 'abc' }],
  examples: [{ label: 'Bo‘sh satr', values: { text: '' } }, { label: '32 baytli xabar', values: { text: 'This is message, length=32 bytes' } }, { label: '50 baytli xabar', values: { text: 'Suppose the original message has length = 50 bytes' } }],
  run(v) {
    const msg = utf8(v['text'] ?? '');
    const steps: Step[] = [{ title: 'Xabar va boshlang‘ich qiymatlar', text: 'H₀ = 0²⁵⁶, Σ = 0, L = 0. Xabar 32 baytli bloklarga bo‘linadi (oxirgisi chapdan nollar bilan to‘ldiriladi).', visuals: [{ kind: 'bytes', title: `${msg.length} bayt`, bytes: msg.map(hex2) }] }];
    const hash = gost3411_94(msg, (t) => {
      steps.push({ title: `f(H, M) — ${t.label}: kalit generatsiyasi`, visuals: [
        { kind: 'kv', items: [{ label: 'H_in', value: t.hin }, { label: 'M', value: t.m }] },
        { kind: 'table', headers: ['Kalit', 'Qiymat (P(U ⊕ V))'], rows: t.keys.map((k, i) => [`K${i + 1}`, k]) },
      ] });
      steps.push({ title: `f(H, M) — ${t.label}: shifrlash va aralashtirish`, visuals: [
        { kind: 'table', headers: ['GOST 28147-89', 'Natija'], rows: t.enc },
        { kind: 'formula', text: `S = s₄‖s₃‖s₂‖s₁ = ${t.S}` },
        { kind: 'formula', text: 'H_out = ψ⁶¹(H_in ⊕ ψ(M ⊕ ψ¹²(S)))' },
      ] });
    });
    steps.push({ title: 'Natija', visuals: [{ kind: 'note', tone: 'ok', text: hash }] });
    return { steps, output: [{ label: 'GOST R 34.11-94', value: hash }] };
  },
};

/* ================= STREEBOG (GOST R 34.11-2012) ================= */
const SA = STREEBOG_A.map((x) => BigInt('0x' + x));
const SC = STREEBOG_C.map((x) => fromHex(x));
const TAU = Array.from({ length: 64 }, (_, i) => 8 * (i % 8) + Math.floor(i / 8));
const sS = (a: number[]): number[] => a.map((b) => PI[b]);
const sP = (a: number[]): number[] => TAU.map((t) => a[t]);
const sL = (a: number[]): number[] => {
  const o: number[] = [];
  for (let c = 0; c < 8; c++) {
    let r = 0n;
    for (let p = 0; p < 64; p++) if ((a[8 * c + (p >> 3)] >> (7 - (p & 7))) & 1) r ^= SA[p];
    for (let i = 7; i >= 0; i--) o.push(Number((r >> BigInt(8 * i)) & 255n));
  }
  return o;
};
const LPS = (a: number[]): number[] => sL(sP(sS(a)));
const add512 = (a: number[], b: number[]): number[] => { const o = new Array(64).fill(0); let c = 0; for (let i = 63; i >= 0; i--) { const t = a[i] + b[i] + c; o[i] = t & 255; c = t >> 8; } return o; };
const Z64 = (): number[] => new Array(64).fill(0);
const num512 = (n: number): number[] => { const o = Z64(); o[63] = n & 255; o[62] = (n >> 8) & 255; o[61] = (n >> 16) & 255; return o; };

function gN(N: number[], h: number[], m: number[], rounds?: (string | number)[][]): number[] {
  let K = LPS(xorB(h, N));
  let st = xorB(K, m);
  rounds?.push(['K₁ = LPS(h ⊕ N)', toHex(K).slice(0, 32) + '…', toHex(st).slice(0, 32) + '…']);
  for (let i = 0; i < 12; i++) {
    K = LPS(xorB(K, SC[i]));
    st = xorB(LPS(st), K);
    rounds?.push([`${i + 1}: K${i + 2} = LPS(K${i + 1} ⊕ C${i + 1})`, toHex(K).slice(0, 32) + '…', toHex(st).slice(0, 32) + '…']);
  }
  return xorB(xorB(st, h), m);
}

export function streebog(msg: number[], bits: 256 | 512, trace?: (label: string, N: number[], S: number[], h: number[], m: number[], rounds: (string | number)[][], out: number[]) => void): string {
  const M = msg.slice().reverse();
  let h = new Array(64).fill(bits === 512 ? 0 : 1), N = Z64(), S = Z64();
  let rest = M;
  while (rest.length >= 64) {
    const m = rest.slice(rest.length - 64);
    const r: (string | number)[][] = [];
    const nh = gN(N, h, m, r);
    trace?.('To‘liq blok', N, S, h, m, r, nh);
    h = nh; N = add512(N, num512(512)); S = add512(S, m);
    rest = rest.slice(0, rest.length - 64);
  }
  const m = Z64();
  m[63 - rest.length] = 1;
  rest.forEach((b, i) => (m[64 - rest.length + i] = b));
  { const r: (string | number)[][] = []; const nh = gN(N, h, m, r); trace?.('Oxirgi (to‘ldirilgan) blok', N, S, h, m, r, nh); h = nh; }
  N = add512(N, num512(rest.length * 8));
  S = add512(S, m);
  { const r: (string | number)[][] = []; const nh = gN(Z64(), h, N, r); trace?.('g₀(h, N)', Z64(), S, h, N, r, nh); h = nh; }
  { const r: (string | number)[][] = []; const nh = gN(Z64(), h, S, r); trace?.('g₀(h, Σ)', Z64(), S, h, S, r, nh); h = nh; }
  const out = bits === 512 ? h : h.slice(0, 32);
  return toHex(out.slice().reverse());
}

export const streebogAlg: AlgorithmDef = {
  id: 'streebog', topic: 6, name: 'GOST R 34.11-2012 «Streebog»',
  short: '256/512 bitli xesh: g_N(h, m) = E(LPS(h ⊕ N), m) ⊕ h ⊕ m',
  theory: [
    'Streebog — 2012-yildan amaldagi Rossiya xesh standarti (GOST R 34.11-94 o‘rniga). Blok 512 bit, xesh 256 yoki 512 bit, 12 raundli ichki shifr E.',
    'LPS — uch almashtirish: S (har bayt Kuznechik bilan bir xil π jadval), P (τ — 8×8 bayt matritsasini transponirlash), L (har 64 bitli so‘zni GF(2) da 64×64 A matritsaga ko‘paytirish).',
    'E(K, m): 12 raund — Kᵢ₊₁ = LPS(Kᵢ ⊕ Cᵢ), holat = LPS(holat) ⊕ Kᵢ₊₁. Siqish funksiyasi g_N(h, m) = E(LPS(h ⊕ N), m) ⊕ h ⊕ m.',
    'Boshlang‘ich vektor IV: 512 bit uchun 0⁵¹², 256 bit uchun 01⁶⁴ (har bayt 01). N — qayta ishlangan bitlar soni, Σ — bloklar yig‘indisi (mod 2⁵¹²); oxirida g₀(h, N) va g₀(h, Σ).',
  ],
  formulas: ['LPS(a) = L(P(S(a)))', 'g_N(h, m) = E(LPS(h ⊕ N), m) ⊕ h ⊕ m', 'Padding: 0…01 ‖ M'],
  fields: [
    { key: 'text', label: 'Xabar', type: 'text', default: '012345678901234567890123456789012345678901234567890123456789012' },
    { key: 'bits', label: 'Xesh uzunligi', type: 'select', default: '512', options: [{ value: '512', label: '512 bit' }, { value: '256', label: '256 bit' }] },
  ],
  examples: [{ label: 'GOST test M₁, 256 bit', values: { text: '012345678901234567890123456789012345678901234567890123456789012', bits: '256' } }, { label: 'SALOM', values: { text: 'SALOM', bits: '256' } }],
  run(v) {
    const msg = utf8(v['text'] ?? '');
    const bits = val(v, 'bits') === '256' ? 256 : 512;
    const steps: Step[] = [{ title: 'Boshlang‘ich qiymatlar', visuals: [{ kind: 'kv', items: [{ label: 'IV', value: bits === 512 ? '00…00 (512 bit)' : '0101…01 (512 bit)' }, { label: 'N', value: '0' }, { label: 'Σ', value: '0' }, { label: 'Xabar', value: `${msg.length} bayt = ${msg.length * 8} bit` }] }] }];
    const hash = streebog(msg, bits, (label, N, S, h, m, rounds, out) => {
      steps.push({ title: `${label}: g_N(h, m)`, text: 'Jadvalda har raunddagi kalit va holatning dastlabki 16 bayti ko‘rsatilgan.', visuals: [
        { kind: 'kv', items: [{ label: 'N', value: toHex(N).replace(/^0+(?=.)/, '') || '0' }, { label: 'h', value: toHex(h).slice(0, 32) + '…' }, { label: 'm', value: toHex(m).slice(0, 32) + '…' }] },
        { kind: 'table', headers: ['E raundi', 'Kalit', 'Holat'], rows: rounds, hlRows: [12] },
        { kind: 'formula', text: `h' = E ⊕ h ⊕ m = ${toHex(out).slice(0, 48)}…` },
      ] });
    });
    steps.push({ title: 'Natija', visuals: [{ kind: 'note', tone: 'ok', text: hash }] });
    return { steps, output: [{ label: `Streebog-${bits}`, value: hash }] };
  },
};

/* ================= GOST R 34.10-94 ================= */
export const gost94sign: AlgorithmDef = {
  id: 'gost-3410-94', topic: 8, name: 'GOST R 34.10-94 imzo',
  short: 'r = (aᵏ mod p) mod q, s = (x·r + k·h) mod q',
  theory: [
    'GOST R 34.10-94 — Rossiyaning 1994-yildagi ERI standarti, diskret logarifm muammosiga asoslangan (DSA ga o‘xshash). 2001-yilda elliptik egri chiziqli versiyaga almashtirilgan.',
    'Parametrlar: p — tub, q — (p−1) ning tub bo‘luvchisi, a: a^q ≡ 1 (mod p). Maxfiy kalit x < q, ochiq kalit y = aˣ mod p. h = H(M) mod q (h = 0 bo‘lsa h = 1); H — GOST R 34.11-94.',
    'DSA dan farqi: s = (x·r + k·h) mod q (DSA da s = k⁻¹(h + x·r)), tekshirishda h⁻¹ ishlatiladi.',
  ],
  formulas: ['r = (aᵏ mod p) mod q', 's = (x·r + k·h) mod q', 'v = h^(q−2) mod q, z₁ = s·v, z₂ = (q − r)·v', 'u = (a^z₁ · y^z₂ mod p) mod q = r'],
  fields: [
    { key: 'p', label: 'p', type: 'number', default: '23' }, { key: 'q', label: 'q', type: 'number', default: '11' },
    { key: 'a', label: 'a', type: 'number', default: '4' }, { key: 'x', label: 'x (maxfiy)', type: 'number', default: '3' },
    { key: 'h', label: 'H(M) mod q', type: 'number', default: '5' }, { key: 'k', label: 'k (0 < k < q)', type: 'number', default: '7' },
  ],
  run(v) {
    const p = big(v, 'p'), q = big(v, 'q'), a = big(v, 'a'), x = big(v, 'x'), k = big(v, 'k');
    let h = mod(big(v, 'h'), q);
    if (!isPrime(p) || !isPrime(q)) throw new Error('p va q tub bo‘lishi kerak');
    if ((p - 1n) % q !== 0n) throw new Error('q (p−1) ni bo‘lishi kerak');
    if (modPow(a, q, p) !== 1n || a <= 1n) throw new Error('a^q mod p ≠ 1');
    const steps: Step[] = [];
    if (h === 0n) { h = 1n; steps.push({ title: 'h = 0 → h = 1', visuals: [] }); }
    const y = modPow(a, x, p);
    steps.push({ title: 'Parametrlar va kalitlar', visuals: [{ kind: 'formula', text: `a^q mod p = ${a}^${q} mod ${p} = 1 ✓` }, { kind: 'formula', text: `y = aˣ mod p = ${a}^${x} mod ${p} = ${y}` }] });
    const ak = modPow(a, k, p), r = ak % q, s = mod(x * r + k * h, q);
    steps.push({ title: 'Imzo yaratish', visuals: [
      { kind: 'formula', text: `r = (aᵏ mod p) mod q = (${a}^${k} mod ${p}) mod ${q} = ${ak} mod ${q} = ${r}` },
      { kind: 'formula', text: `s = (x·r + k·h) mod q = (${x}·${r} + ${k}·${h}) mod ${q} = ${x * r + k * h} mod ${q} = ${s}` },
      { kind: 'note', tone: 'ok', text: `Imzo (r, s) = (${r}, ${s})` },
    ] });
    if (r === 0n || s === 0n) throw new Error('r yoki s = 0 — boshqa k tanlang');
    const vv = modPow(h, q - 2n, q), z1 = mod(s * vv, q), z2 = mod((q - r) * vv, q);
    const u = mod(modPow(a, z1, p) * modPow(y, z2, p), p) % q;
    steps.push({ title: 'Imzoni tekshirish', visuals: [
      { kind: 'kv', items: [{ label: 'v = h^(q−2) mod q', value: `${vv}` }, { label: 'z₁ = s·v mod q', value: `${z1}` }, { label: 'z₂ = (q−r)·v mod q', value: `${z2}` }] },
      { kind: 'formula', text: `u = (a^z₁·y^z₂ mod p) mod q = (${a}^${z1}·${y}^${z2} mod ${p}) mod ${q} = ${u}` },
      u === r ? { kind: 'note', tone: 'ok', text: `u = r = ${r} — imzo HAQIQIY ✓` } : { kind: 'note', tone: 'warn', text: 'u ≠ r — imzo noto‘g‘ri' },
    ] });
    return { steps, output: [{ label: 'y', value: `${y}` }, { label: '(r, s)', value: `(${r}, ${s})` }, { label: 'u', value: `${u}` }] };
  },
};

/* ================= GOST R 34.10-2012 ================= */
export const gost2012sign: AlgorithmDef = {
  id: 'gost-3410-2012', topic: 8, name: 'GOST R 34.10-2012 imzo (elliptik egri chiziq)',
  short: 'C = kP, r = x_C mod q, s = (r·d + k·e) mod q',
  theory: [
    'GOST R 34.10-2012 (va 2001) — elliptik egri chiziqli ERI. Xesh — Streebog. Kalit: d — maxfiy, Q = d·P — ochiq; P — q tartibli nuqta.',
    'e = α mod q (α — xeshning soni, e = 0 bo‘lsa e = 1). Imzo: C = k·P, r = x_C mod q, s = (r·d + k·e) mod q.',
    'Tekshirish: v = e⁻¹ mod q, z₁ = s·v, z₂ = −r·v (mod q), C = z₁·P + z₂·Q, R = x_C mod q; R = r bo‘lsa imzo to‘g‘ri. ECDSA dan farqi: s formulasi va tekshirish tenglamasi.',
  ],
  formulas: ['Q = d·P', 'r = x(k·P) mod q', 's = (r·d + k·e) mod q', 'C = (s·e⁻¹)·P + (−r·e⁻¹)·Q'],
  fields: [
    { key: 'a', label: 'a', type: 'number', default: '2' }, { key: 'b', label: 'b', type: 'number', default: '2' }, { key: 'p', label: 'p', type: 'number', default: '17' },
    { key: 'P', label: 'P = (x, y)', type: 'text', default: '(5, 1)' }, { key: 'q', label: 'q (P tartibi)', type: 'number', default: '19' },
    { key: 'd', label: 'd (maxfiy)', type: 'number', default: '7' }, { key: 'e', label: 'α = H(M) (son)', type: 'number', default: '26' }, { key: 'k', label: 'k', type: 'number', default: '10' },
  ],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const m = val(v, 'P').replace(/[()\s]/g, '').split(',').map(Number);
    const P: Pt = [m[0], m[1]];
    if (!c.on(P)) throw new Error('P egri chiziqda yotmaydi');
    const q = int(v, 'q'), d = int(v, 'd'), k = int(v, 'k');
    const mul = (n: number, X: Pt): Pt => { let R: Pt = null; for (const bit of n.toString(2)) { R = c.add(R, R); if (bit === '1') R = c.add(R, X); } return R; };
    if (mul(q, P) !== null) throw new Error(`q·P ≠ O — q = ${q} P ning tartibi emas`);
    let e = mod(big(v, 'e'), BigInt(q)); if (e === 0n) e = 1n;
    const Q = mul(d, P), C = mul(k, P);
    if (!C) throw new Error('k·P = O, boshqa k tanlang');
    const r = C[0] % q, s = Number(mod(BigInt(r * d) + BigInt(k) * e, BigInt(q)));
    const steps: Step[] = [
      { title: 'Kalitlar', visuals: [{ kind: 'formula', text: `q·P = O ✓,  Q = d·P = ${d}·${show(P)} = ${show(Q)}` }, { kind: 'formula', text: `e = α mod q = ${v['e']} mod ${q} = ${e}` }] },
      { title: 'Imzo yaratish', visuals: [{ kind: 'formula', text: `C = k·P = ${k}·${show(P)} = ${show(C)}` }, { kind: 'formula', text: `r = x_C mod q = ${C[0]} mod ${q} = ${r}` }, { kind: 'formula', text: `s = (r·d + k·e) mod q = (${r}·${d} + ${k}·${e}) mod ${q} = ${s}` }, { kind: 'note', tone: 'ok', text: `Imzo (r, s) = (${r}, ${s})` }] },
    ];
    if (r === 0 || s === 0) throw new Error('r yoki s = 0 — boshqa k tanlang');
    const vv = Number(modInv(e, BigInt(q))), z1 = (s * vv) % q, z2 = ((q - r) * vv) % q;
    const CC = c.add(mul(z1, P), mul(z2, Q));
    const R = CC ? CC[0] % q : -1;
    steps.push({ title: 'Imzoni tekshirish', visuals: [
      { kind: 'kv', items: [{ label: 'v = e⁻¹ mod q', value: `${vv}` }, { label: 'z₁ = s·v mod q', value: `${z1}` }, { label: 'z₂ = −r·v mod q', value: `${z2}` }] },
      { kind: 'formula', text: `C = z₁·P + z₂·Q = ${z1}·${show(P)} + ${z2}·${show(Q)} = ${show(CC)}` },
      R === r ? { kind: 'note', tone: 'ok', text: `R = x_C mod q = ${R} = r — imzo HAQIQIY ✓` } : { kind: 'note', tone: 'warn', text: 'R ≠ r — imzo noto‘g‘ri' },
    ] });
    return { steps, output: [{ label: 'Q', value: show(Q) }, { label: '(r, s)', value: `(${r}, ${s})` }, { label: 'Tekshiruv', value: R === r ? 'to‘g‘ri' : 'noto‘g‘ri' }] };
  },
};

export const TGOST = [magma, gost94hash, streebogAlg, gost94sign, gost2012sign];
