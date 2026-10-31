/* ===================== Umumiy yordamchi funksiyalar ===================== */

export const val = (v: Record<string, string>, k: string): string => (v[k] ?? '').trim();

export function big(v: Record<string, string>, k: string, name?: string): bigint {
  const s = val(v, k);
  if (!/^-?\d+$/.test(s)) throw new Error(`${name ?? k}: butun son kiriting`);
  return BigInt(s);
}

export function int(v: Record<string, string>, k: string, name?: string): number {
  return Number(big(v, k, name));
}

/** Matematik mod: natija har doim 0..n-1 */
export const mod = (a: bigint, n: bigint): bigint => ((a % n) + n) % n;
export const modn = (a: number, n: number): number => ((a % n) + n) % n;

export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return { g: r0, x: s0, y: t0 };
}

export function modInv(a: bigint, n: bigint): bigint {
  const { g, x } = egcd(mod(a, n), n);
  if (g !== 1n) throw new Error(`${a}⁻¹ mod ${n} mavjud emas: EKUB(${a}, ${n}) = ${g} ≠ 1`);
  return mod(x, n);
}

export function modPow(b: bigint, e: bigint, n: bigint): bigint {
  if (n === 1n) return 0n;
  let r = 1n;
  b = mod(b, n);
  while (e > 0n) {
    if (e & 1n) r = (r * b) % n;
    b = (b * b) % n;
    e >>= 1n;
  }
  return r;
}

export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n, s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let comp = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) { comp = false; break; }
    }
    if (comp) return false;
  }
  return true;
}

/* ---------- baytlar / hex ---------- */
export const hex2 = (b: number): string => b.toString(16).padStart(2, '0');
export const toHex = (a: ArrayLike<number>): string => Array.from(a, hex2).join('');
export const bin8 = (b: number): string => b.toString(2).padStart(8, '0');

export function fromHex(s: string, len?: number, name = 'Hex'): number[] {
  const h = s.replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]*$/.test(h) || h.length % 2) throw new Error(`${name}: noto'g'ri hex qiymat`);
  const out: number[] = [];
  for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  if (len !== undefined && out.length !== len) throw new Error(`${name}: aynan ${len} bayt (${len * 2} hex belgi) bo'lishi kerak, hozir ${out.length}`);
  return out;
}

export const utf8 = (s: string): number[] => Array.from(new TextEncoder().encode(s));

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Ikkilik daraja uchun: 117 = 64+32+16+4+1 */
export const binParts = (e: bigint): bigint[] => {
  const parts: bigint[] = [];
  let bit = 1n;
  while (bit <= e) { if (e & bit) parts.push(bit); bit <<= 1n; }
  return parts.reverse();
};

export const sup = (n: number | bigint | string): string =>
  String(n).replace(/[0-9-]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? '⁻');
export const sub = (n: number | bigint | string): string =>
  String(n).replace(/[0-9]/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[+c]);

/** 16 baytli blokni 4x4 AES state (ustun bo'yicha) ko'rinishiga */
export const stateGrid = (s: number[]): string[][] =>
  [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => hex2(s[r + 4 * c])));
