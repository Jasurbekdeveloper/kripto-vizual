import { AlgorithmDef, Step } from '../core/models';
import { hamming, hex2, int, toHex, utf8, val } from '../core/util';

/* ---------------------------------------------------------------
 * 6-MAVZU: Xesh funksiyalar — SHA-1, SHA-256, SHA-512
 * ------------------------------------------------------------- */

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const H256 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;
const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;
const h8 = (x: number): string => (x >>> 0).toString(16).padStart(8, '0');

function pad(msg: number[], block: number, lenBytes: number): number[] {
  const m = [...msg, 0x80];
  while ((m.length + lenBytes) % block) m.push(0);
  const bits = BigInt(msg.length) * 8n;
  for (let i = lenBytes - 1; i >= 0; i--) m.push(Number((bits >> BigInt(8 * i)) & 0xffn));
  return m;
}

export function sha256(msg: number[], trace?: (info: { block: number; W: number[]; rounds: number[][]; H: number[]; Hn: number[] }) => void): string {
  const m = pad(msg, 64, 8);
  const H = [...H256];
  for (let b = 0; b < m.length / 64; b++) {
    const W: number[] = [];
    for (let t = 0; t < 64; t++) {
      if (t < 16) W.push(((m[64 * b + 4 * t] << 24) | (m[64 * b + 4 * t + 1] << 16) | (m[64 * b + 4 * t + 2] << 8) | m[64 * b + 4 * t + 3]) >>> 0);
      else {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W.push((W[t - 16] + s0 + W[t - 7] + s1) >>> 0);
      }
    }
    let [a, bb, c, d, e, f, g, h] = H;
    const rounds: number[][] = [];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const T1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const T2 = (S0 + maj) >>> 0;
      [h, g, f, e, d, c, bb, a] = [g, f, e, (d + T1) >>> 0, c, bb, a, (T1 + T2) >>> 0];
      rounds.push([t, T1, T2, a, bb, c, d, e, f, g, h]);
    }
    const prev = [...H];
    [a, bb, c, d, e, f, g, h].forEach((x, i) => (H[i] = (H[i] + x) >>> 0));
    trace?.({ block: b, W, rounds, H: prev, Hn: [...H] });
  }
  return H.map(h8).join('');
}

export function sha1(msg: number[]): string {
  const m = pad(msg, 64, 8);
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  for (let b = 0; b < m.length / 64; b++) {
    const W: number[] = [];
    for (let t = 0; t < 80; t++) W.push(t < 16 ? ((m[64 * b + 4 * t] << 24) | (m[64 * b + 4 * t + 1] << 16) | (m[64 * b + 4 * t + 2] << 8) | m[64 * b + 4 * t + 3]) >>> 0 : rotl(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1));
    let [a, bb, c, d, e] = H;
    for (let t = 0; t < 80; t++) {
      const [f, k] = t < 20 ? [(bb & c) | (~bb & d), 0x5a827999] : t < 40 ? [bb ^ c ^ d, 0x6ed9eba1] : t < 60 ? [(bb & c) | (bb & d) | (c & d), 0x8f1bbcdc] : [bb ^ c ^ d, 0xca62c1d6];
      const T = (rotl(a, 5) + f + e + k + W[t]) >>> 0;
      [e, d, c, bb, a] = [d, c, rotl(bb, 30), a, T];
    }
    [a, bb, c, d, e].forEach((x, i) => (H[i] = (H[i] + x) >>> 0));
  }
  return H.map(h8).join('');
}

const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118', 'd807aa98a3030242', '12835b0145706fbe',
  '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694', 'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65',
  '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5', '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725',
  '06ca6351e003826f', '142929670a0e6e70', '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
  'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8', '19a4c116b8d2d0c8', '1e376c085141ab53',
  '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3', '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
  '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b', 'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6',
  '113f9804bef90dae', '1b710b35131c471b', '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817',
].map((x) => BigInt('0x' + x));
const M64 = (1n << 64n) - 1n;
const rotr64 = (x: bigint, n: bigint): bigint => ((x >> n) | (x << (64n - n))) & M64;

export function sha512(msg: number[]): string {
  const m = pad(msg, 128, 16);
  const H = ['6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1', '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179'].map((x) => BigInt('0x' + x));
  for (let b = 0; b < m.length / 128; b++) {
    const W: bigint[] = [];
    for (let t = 0; t < 80; t++) {
      if (t < 16) { let x = 0n; for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(m[128 * b + 8 * t + i]); W.push(x); }
      else {
        const s0 = rotr64(W[t - 15], 1n) ^ rotr64(W[t - 15], 8n) ^ (W[t - 15] >> 7n);
        const s1 = rotr64(W[t - 2], 19n) ^ rotr64(W[t - 2], 61n) ^ (W[t - 2] >> 6n);
        W.push((W[t - 16] + s0 + W[t - 7] + s1) & M64);
      }
    }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let t = 0; t < 80; t++) {
      const T1 = (h + (rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n)) + ((e & f) ^ (~e & M64 & g)) + K512[t] + W[t]) & M64;
      const T2 = ((rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n)) + ((a & bb) ^ (a & c) ^ (bb & c))) & M64;
      [h, g, f, e, d, c, bb, a] = [g, f, e, (d + T1) & M64, c, bb, a, (T1 + T2) & M64];
    }
    [a, bb, c, d, e, f, g, h].forEach((x, i) => (H[i] = (H[i] + x) & M64));
  }
  return H.map((x) => x.toString(16).padStart(16, '0')).join('');
}

export const sha256Steps: AlgorithmDef = {
  id: 'sha256', topic: 6, name: 'SHA-256: qadamma-qadam',
  short: 'Padding → 512 bitli bloklar → W₀…W₆₃ → 64 raund → 256 bitli xesh',
  theory: [
    'SHA-256: blok 512 bit, so‘z 32 bit, 64 raund, natija 256 bit. Barcha qo‘shishlar mod 2³².',
    'Padding: xabar oxiriga “1” bit (0x80), so‘ng uzunlik ≡ 448 (mod 512) bo‘lguncha nollar, oxirida 64 bitli xabar uzunligi.',
    'Ch(x,y,z) = (x∧y) ⊕ (¬x∧z) — x asosida y yoki z ni tanlaydi; Maj(x,y,z) — har bit bo‘yicha ko‘pchilik.',
  ],
  formulas: ['T₁ = h + Σ₁(e) + Ch(e,f,g) + Kₜ + Wₜ', 'T₂ = Σ₀(a) + Maj(a,b,c)', 'Σ₀(a) = ROTR²⊕ROTR¹³⊕ROTR²²', 'Σ₁(e) = ROTR⁶⊕ROTR¹¹⊕ROTR²⁵', 'Wₜ = σ₁(Wₜ₋₂) + Wₜ₋₇ + σ₀(Wₜ₋₁₅) + Wₜ₋₁₆'],
  fields: [{ key: 'text', label: 'Xabar', type: 'text', default: 'abc' }],
  examples: [{ label: 'SALOM', values: { text: 'SALOM' } }, { label: 'Bo‘sh satr', values: { text: '' } }],
  run(v) {
    const msg = utf8(v['text'] ?? '');
    const steps: Step[] = [];
    const padded = pad(msg, 64, 8);
    steps.push({ title: 'Xabarni baytlarga o‘tkazish', visuals: [{ kind: 'bytes', title: `${msg.length} bayt = ${msg.length * 8} bit`, bytes: msg.map(hex2) }] });
    steps.push({ title: 'Padding (to‘ldirish)', text: `0x80 bayti qo‘shiladi, keyin nollar, oxirgi 8 bayt — xabar uzunligi bitlarda (${msg.length * 8}). Jami ${padded.length * 8} bit = ${padded.length / 64} blok.`, visuals: [{ kind: 'bytes', title: 'To‘ldirilgan xabar', bytes: padded.map(hex2), hl: [msg.length, ...Array.from({ length: 8 }, (_, i) => padded.length - 8 + i)] }] });
    steps.push({ title: 'Boshlang‘ich xesh qiymatlari H₀…H₇', text: 'Dastlabki 8 ta tub son kvadrat ildizlarining kasr qismidan olingan.', visuals: [{ kind: 'kv', items: H256.map((h, i) => ({ label: `H${i}`, value: h8(h) })) }] });
    const hex = sha256(msg, ({ block, W, rounds, H, Hn }) => {
      steps.push({ title: `${block + 1}-blok: xabar jadvali W₀…W₆₃`, text: 'W₀…W₁₅ — blokning 16 ta so‘zi, qolganlari σ₀ va σ₁ funksiyalari bilan kengaytiriladi.', visuals: [{ kind: 'table', headers: ['t', 'Wₜ', 't', 'Wₜ', 't', 'Wₜ', 't', 'Wₜ'], rows: Array.from({ length: 16 }, (_, i) => [i, h8(W[i]), i + 16, h8(W[i + 16]), i + 32, h8(W[i + 32]), i + 48, h8(W[i + 48])]) }] });
      const pick = [0, 1, 2, 3, 31, 62, 63];
      steps.push({ title: `${block + 1}-blok: siqish funksiyasi — 64 raund`, text: 'Har raundda T₁ va T₂ hisoblanadi; registrlar suriladi: h←g, g←f, f←e, e←d+T₁, d←c, c←b, b←a, a←T₁+T₂.', visuals: [{ kind: 'table', headers: ['t', 'T₁', 'T₂', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], rows: rounds.filter((_, t) => pick.includes(t) || t < 4).map((r) => r.map((x, i) => (i === 0 ? x : h8(x)))) }] });
      steps.push({ title: `${block + 1}-blok: oraliq xeshni yangilash`, visuals: [{ kind: 'table', headers: ['', 'Oldingi Hᵢ', '+ registr', 'Yangi Hᵢ'], rows: H.map((h, i) => [`H${i}`, h8(h), h8((Hn[i] - h) >>> 0), h8(Hn[i])]) }] });
    });
    steps.push({ title: 'Yakuniy xesh', visuals: [{ kind: 'formula', text: `SHA-256 = H₀‖H₁‖…‖H₇` }, { kind: 'note', tone: 'ok', text: hex }] });
    return { steps, output: [{ label: 'SHA-256', value: hex }] };
  },
};

export const hashCompare: AlgorithmDef = {
  id: 'sha-compare', topic: 6, name: 'SHA-1 / SHA-256 / SHA-512 taqqoslash',
  short: 'Bir xabar — uchta algoritm, uzunliklar va parametrlar',
  theory: ['SHA-1: 160 bit, blok 512, so‘z 32, 80 raund — collision topilgan, eskirgan.', 'SHA-256: 256 bit, blok 512, so‘z 32, 64 raund. SHA-512: 512 bit, blok 1024, so‘z 64, 80 raund.'],
  fields: [{ key: 'text', label: 'Xabar', type: 'text', default: 'ZAMONAVIY KRIPTOGRAFIYA' }],
  run(v) {
    const m = utf8(v['text'] ?? '');
    const r = [['SHA-1', sha1(m)], ['SHA-256', sha256(m)], ['SHA-512', sha512(m)]];
    return {
      steps: [
        { title: 'Parametrlar', visuals: [{ kind: 'table', headers: ['Algoritm', 'Digest', 'Blok', 'So‘z', 'Raund', 'Holati'], rows: [['SHA-1', '160 bit (20 B)', '512', '32', '80', 'Eskirgan'], ['SHA-256', '256 bit (32 B)', '512', '32', '64', 'Tavsiya etiladi'], ['SHA-512', '512 bit (64 B)', '1024', '64', '80', 'Tavsiya etiladi']] }] },
        { title: 'Xesh qiymatlari', visuals: [{ kind: 'table', headers: ['Algoritm', 'Hex', 'Uzunlik'], rows: r.map(([n, h]) => [n, h, `${h.length * 4} bit`]) }] },
      ],
      output: r.map(([n, h]) => ({ label: n, value: h })),
    };
  },
};

export const avalanche: AlgorithmDef = {
  id: 'avalanche', topic: 6, name: 'Avalanche effekt va Hamming masofasi',
  short: 'Kichik o‘zgarish → ~50% bit o‘zgaradi',
  theory: ['Hamming masofasi HD(x, y) = weight(x ⊕ y) — farq qiluvchi bitlar soni.', 'Avalanche % = HD / N × 100. Ideal qiymat ≈ 50%.'],
  formulas: ['HD(x,y) = wt(x ⊕ y)', 'Avalanche = HD/N · 100%'],
  fields: [
    { key: 'a', label: 'Xabar 1', type: 'text', default: 'SALOM' },
    { key: 'b', label: 'Xabar 2', type: 'text', default: 'SALON' },
    { key: 'alg', label: 'Algoritm', type: 'select', default: '256', options: [{ value: '1', label: 'SHA-1' }, { value: '256', label: 'SHA-256' }, { value: '512', label: 'SHA-512' }] },
  ],
  examples: [{ label: 'KRIPTOGRAFIYA / KRIPTOGRAFIYA1', values: { a: 'KRIPTOGRAFIYA', b: 'KRIPTOGRAFIYA1', alg: '256' } }],
  run(v) {
    const f = val(v, 'alg') === '1' ? sha1 : val(v, 'alg') === '512' ? sha512 : sha256;
    const ha = f(utf8(v['a'] ?? '')), hb = f(utf8(v['b'] ?? ''));
    const N = ha.length * 4, hd = hamming(ha, hb);
    const binA = ha.split('').map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    const binB = hb.split('').map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    const diff = binA.split('').map((x, i) => (x !== binB[i] ? i : -1)).filter((i) => i >= 0);
    const show = 64;
    return {
      steps: [
        { title: 'Xeshlar', visuals: [{ kind: 'kv', items: [{ label: `H("${v['a']}")`, value: ha }, { label: `H("${v['b']}")`, value: hb }] }] },
        { title: `Bitlarni solishtirish (dastlabki ${show} bit)`, visuals: [{ kind: 'bits', rows: [{ label: 'H₁', bits: binA.slice(0, show) }, { label: 'H₂', bits: binB.slice(0, show) }, { label: 'XOR', bits: diff.filter((i) => i < show).reduce((s, i) => s.slice(0, i) + '1' + s.slice(i + 1), '0'.repeat(show)), hl: diff.filter((i) => i < show), sep: true }] }] },
        { title: 'Natija', visuals: [{ kind: 'formula', text: `HD = ${hd},  N = ${N},  Avalanche = ${hd}/${N} × 100 = ${((hd / N) * 100).toFixed(2)}%` }, { kind: 'note', tone: Math.abs(hd / N - 0.5) < 0.1 ? 'ok' : 'info', text: 'Ideal ≈ 50% — kuchli avalanche effekt' }] },
      ],
      output: [{ label: 'Hamming masofasi', value: `${hd} / ${N}` }, { label: 'Avalanche', value: `${((hd / N) * 100).toFixed(2)}%` }],
    };
  },
};

export const simpleHash: AlgorithmDef = {
  id: 'simple-hash', topic: 6, name: 'Oddiy (o‘quv) xesh va collision',
  short: 'H(M) = (Σ ASCII) mod N — nima uchun kriptografik emas',
  theory: ['Bu xesh g‘oyasini tushuntirish uchun. Harflar o‘rni almashsa ham natija bir xil (ABC va ACB) — collision juda oson.'],
  formulas: ['H(M) = (Σ ASCII(Mᵢ)) mod N'],
  fields: [{ key: 'a', label: 'Xabar 1', type: 'text', default: 'ABC' }, { key: 'b', label: 'Xabar 2', type: 'text', default: 'ACB' }, { key: 'n', label: 'N', type: 'number', default: '100' }],
  run(v) {
    const n = int(v, 'n');
    const calc = (s: string) => { const codes = s.split('').map((c) => c.charCodeAt(0)); const sum = codes.reduce((a, b) => a + b, 0); return { codes, sum, h: sum % n }; };
    const A = calc(v['a'] ?? ''), B = calc(v['b'] ?? '');
    return {
      steps: [
        { title: 'ASCII kodlar', visuals: [{ kind: 'chars', rows: [{ label: v['a'] ?? '', chars: A.codes.map(String) }, { label: v['b'] ?? '', chars: B.codes.map(String) }] }] },
        { title: 'Yig‘indi va mod', visuals: [{ kind: 'formula', text: `H₁ = ${A.codes.join(' + ')} = ${A.sum} mod ${n} = ${A.h}` }, { kind: 'formula', text: `H₂ = ${B.codes.join(' + ')} = ${B.sum} mod ${n} = ${B.h}` }, A.h === B.h && v['a'] !== v['b'] ? { kind: 'note', tone: 'warn', text: 'COLLISION: turli xabarlar — bir xil xesh!' } : { kind: 'note', tone: 'info', text: 'Xeshlar har xil' }] },
      ],
      output: [{ label: 'H₁', value: String(A.h) }, { label: 'H₂', value: String(B.h) }],
    };
  },
};

export const T6 = [sha256Steps, hashCompare, avalanche, simpleHash];
export { toHex };
