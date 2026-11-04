import { AlgorithmDef, Step } from '../core/models';
import { big, gcd, isPrime, mod, modInv, modPow } from '../core/util';
import { extEuclidSteps, fastPowSteps } from './t1-modular';

/* ---------------------------------------------------------------
 * 3-, 7-, 8-, 11-MAVZULAR: Ochiq kalitli kriptografiya
 * RSA, ElGamal, ERI (RSA / ElGamal), Diffie–Hellman
 * ------------------------------------------------------------- */

const prefixed = (pre: string, steps: Step[]): Step[] => steps.map((s) => ({ ...s, title: `${pre}: ${s.title}` }));

function requirePrime(x: bigint, name: string): Step {
  if (!isPrime(x)) throw new Error(`${name} = ${x} tub son emas`);
  return { title: `${name} tub sonmi?`, visuals: [{ kind: 'note', tone: 'ok', text: `${name} = ${x} — tub son ✓` }] };
}

/* ---------- RSA ---------- */
export const rsa: AlgorithmDef = {
  id: 'rsa', topic: 3, name: 'RSA: kalit generatsiyasi, shifrlash, deshifrlash',
  short: 'n = p·q, φ(n), e, d = e⁻¹ mod φ(n), C = Mᵉ mod n, M = Cᵈ mod n',
  theory: [
    'RSA xavfsizligi katta sonlarni faktorlash (n = p·q dan p va q ni topish) murakkabligiga asoslanadi.',
    'Ochiq kalit (e, n), maxfiy kalit (d, n). e shart: 1 < e < φ(n), EKUB(e, φ(n)) = 1. d kengaytirilgan Evklid bilan topiladi.',
    'O‘quv misollarida kichik tub sonlar ishlatiladi; real tizimlarda n ≥ 2048 bit va OAEP padding qo‘llaniladi.',
  ],
  formulas: ['n = p·q', 'φ(n) = (p−1)(q−1)', 'd ≡ e⁻¹ (mod φ(n))', 'C = Mᵉ mod n', 'M = Cᵈ mod n'],
  fields: [
    { key: 'p', label: 'p (tub)', type: 'number', default: '5' },
    { key: 'q', label: 'q (tub)', type: 'number', default: '11' },
    { key: 'e', label: 'e (ochiq eksponent)', type: 'number', default: '3' },
    { key: 'm', label: 'Xabar M (0 ≤ M < n)', type: 'number', default: '7' },
  ],
  examples: [
    { label: 'p=7, q=13, e=5, M=8', values: { p: '7', q: '13', e: '5', m: '8' } },
    { label: 'p=11, q=17, e=7, M=9', values: { p: '11', q: '17', e: '7', m: '9' } },
    { label: 'p=61, q=53, e=17, M=65', values: { p: '61', q: '53', e: '17', m: '65' } },
  ],
  run(v) {
    const p = big(v, 'p'), q = big(v, 'q'), e = big(v, 'e'), m = big(v, 'm');
    const steps: Step[] = [requirePrime(p, 'p'), requirePrime(q, 'q')];
    if (p === q) throw new Error('p va q har xil bo‘lishi kerak');
    const n = p * q, phi = (p - 1n) * (q - 1n);
    steps.push({ title: 'Modul n va Eyler funksiyasi φ(n)', visuals: [
      { kind: 'formula', text: `n = p·q = ${p}·${q} = ${n}` },
      { kind: 'formula', text: `φ(n) = (p−1)(q−1) = ${p - 1n}·${q - 1n} = ${phi}` },
    ] });
    const g = gcd(e, phi);
    steps.push({ title: 'Ochiq eksponent e ni tekshirish', visuals: [
      { kind: 'formula', text: `1 < e = ${e} < φ(n) = ${phi},   EKUB(${e}, ${phi}) = ${g}` },
      g === 1n ? { kind: 'note', tone: 'ok', text: 'Shart bajarildi ✓' } : { kind: 'note', tone: 'warn', text: 'EKUB ≠ 1 — boshqa e tanlang' },
    ] });
    if (g !== 1n || e <= 1n || e >= phi) throw new Error(`e noto‘g‘ri: EKUB(${e}, ${phi}) = ${g}`);
    const inv = extEuclidSteps(e, phi);
    steps.push(...prefixed('d = e⁻¹ mod φ(n)', inv.steps));
    const d = inv.inv!;
    steps.push({ title: 'Kalitlar juftligi', visuals: [{ kind: 'kv', items: [
      { label: 'Ochiq kalit (e, n)', value: `(${e}, ${n})`, hl: true },
      { label: 'Maxfiy kalit (d, n)', value: `(${d}, ${n})`, hl: true },
      { label: 'Tekshiruv e·d mod φ(n)', value: `${e}·${d} = ${e * d} ≡ ${mod(e * d, phi)}` },
    ] }] });
    if (m < 0n || m >= n) throw new Error(`M 0 va ${n - 1n} oralig‘ida bo‘lsin`);
    const c = fastPowSteps(m, e, n);
    steps.push(...prefixed(`Shifrlash C = ${m}^${e} mod ${n}`, c.steps));
    const dm = fastPowSteps(c.result, d, n);
    steps.push(...prefixed(`Deshifrlash M = ${c.result}^${d} mod ${n}`, dm.steps));
    steps.push({ title: 'Natija', visuals: [{ kind: 'flow', nodes: [`M = ${m}`, `C = ${c.result}`, `M = ${dm.result}`], active: 2 }, dm.result === m ? { kind: 'note', tone: 'ok', text: 'Verification: SUCCESS — D(E(M)) = M' } : { kind: 'note', tone: 'warn', text: 'Xato!' }] });
    return { steps, output: [
      { label: 'n', value: `${n}` }, { label: 'φ(n)', value: `${phi}` }, { label: 'd', value: `${d}` },
      { label: 'Shifrmatn C', value: `${c.result}` }, { label: 'Deshifrlangan M', value: `${dm.result}` },
    ] };
  },
};

/* ---------- ElGamal ---------- */
export const elgamal: AlgorithmDef = {
  id: 'elgamal', topic: 3, name: 'ElGamal: kalit, shifrlash, deshifrlash',
  short: 'y = gˣ mod p; (c₁, c₂) = (gᵏ, m·yᵏ) mod p',
  theory: [
    'ElGamal diskret logarifm muammosiga asoslanadi: y = gˣ mod p ni hisoblash oson, y dan x ni topish qiyin.',
    'Har bir shifrlashda yangi tasodifiy k tanlanadi — bir xil m har safar turli shifrmatn beradi. k qayta ishlatilsa xavfsizlik buziladi.',
    'Shifrmatn ikki qiymatdan iborat: (c₁, c₂).',
  ],
  formulas: ['y = gˣ mod p', 'c₁ = gᵏ mod p', 'c₂ = m·yᵏ mod p', 's = c₁ˣ mod p', 'm = c₂·s⁻¹ mod p'],
  fields: [
    { key: 'p', label: 'p (tub)', type: 'number', default: '23' },
    { key: 'g', label: 'g (generator)', type: 'number', default: '5' },
    { key: 'x', label: 'x (maxfiy kalit)', type: 'number', default: '6' },
    { key: 'm', label: 'Xabar m', type: 'number', default: '10' },
    { key: 'k', label: 'k (tasodifiy)', type: 'number', default: '3' },
  ],
  examples: [
    { label: 'p=29, g=2, x=5, m=7, k=3', values: { p: '29', g: '2', x: '5', m: '7', k: '3' } },
    { label: 'Xuddi shu m, k=7', values: { p: '23', g: '5', x: '6', m: '10', k: '7' } },
  ],
  run(v) {
    const p = big(v, 'p'), g = big(v, 'g'), x = big(v, 'x'), m = big(v, 'm'), k = big(v, 'k');
    const steps: Step[] = [requirePrime(p, 'p')];
    if (m <= 0n || m >= p) throw new Error(`m 1..${p - 1n} oralig‘ida bo‘lsin`);
    const y = fastPowSteps(g, x, p);
    steps.push(...prefixed(`Ochiq kalit y = ${g}^${x} mod ${p}`, y.steps));
    steps.push({ title: 'Kalitlar', visuals: [{ kind: 'kv', items: [{ label: 'Ochiq kalit (p, g, y)', value: `(${p}, ${g}, ${y.result})`, hl: true }, { label: 'Maxfiy kalit x', value: `${x}`, hl: true }] }] });
    const c1 = fastPowSteps(g, k, p);
    steps.push(...prefixed(`c₁ = ${g}^${k} mod ${p}`, c1.steps));
    const yk = fastPowSteps(y.result, k, p);
    steps.push(...prefixed(`yᵏ = ${y.result}^${k} mod ${p}`, yk.steps));
    const c2 = mod(m * yk.result, p);
    steps.push({ title: 'c₂ ni hisoblash', visuals: [{ kind: 'formula', text: `c₂ = m·yᵏ mod p = ${m}·${yk.result} mod ${p} = ${m * yk.result} mod ${p} = ${c2}` }, { kind: 'note', tone: 'ok', text: `Shifrmatn = (c₁, c₂) = (${c1.result}, ${c2})` }] });
    const s = fastPowSteps(c1.result, x, p);
    steps.push(...prefixed(`Umumiy sir s = c₁^x = ${c1.result}^${x} mod ${p}`, s.steps));
    const si = extEuclidSteps(s.result, p);
    steps.push(...prefixed(`s⁻¹ = ${s.result}⁻¹ mod ${p}`, si.steps));
    const dm = mod(c2 * si.inv!, p);
    steps.push({ title: 'Deshifrlash', visuals: [
      { kind: 'formula', text: `m = c₂·s⁻¹ mod p = ${c2}·${si.inv} mod ${p} = ${c2 * si.inv!} mod ${p} = ${dm}` },
      { kind: 'note', tone: 'info', text: 'Nima uchun ishlaydi: c₂·(c₁ˣ)⁻¹ = m·g^(xk)·g^(−xk) = m' },
      dm === m ? { kind: 'note', tone: 'ok', text: 'Verification: SUCCESS' } : { kind: 'note', tone: 'warn', text: 'Xato!' },
    ] });
    return { steps, output: [{ label: 'y', value: `${y.result}` }, { label: '(c₁, c₂)', value: `(${c1.result}, ${c2})` }, { label: 'Deshifrlangan m', value: `${dm}` }] };
  },
};

/* ---------- RSA ERI ---------- */
export const rsaSign: AlgorithmDef = {
  id: 'rsa-sign', topic: 7, name: 'RSA elektron raqamli imzo',
  short: 'S = H(M)ᵈ mod n, tekshirish: Sᵉ mod n = H(M)',
  theory: ['Imzo maxfiy kalit bilan yaratiladi, ochiq kalit bilan tekshiriladi (shifrlashga teskari).', 'Amalda xabar avval xeshlanadi: H(M). Bu yerda o‘quv maqsadida H(M) son sifatida beriladi.'],
  formulas: ['S = hᵈ mod n', 'h′ = Sᵉ mod n,  h′ = h ⇒ imzo to‘g‘ri'],
  fields: [
    { key: 'p', label: 'p', type: 'number', default: '61' }, { key: 'q', label: 'q', type: 'number', default: '53' },
    { key: 'e', label: 'e', type: 'number', default: '17' }, { key: 'h', label: 'H(M) — xesh qiymat', type: 'number', default: '65' },
  ],
  run(v) {
    const p = big(v, 'p'), q = big(v, 'q'), e = big(v, 'e'), h = big(v, 'h');
    const steps: Step[] = [requirePrime(p, 'p'), requirePrime(q, 'q')];
    const n = p * q, phi = (p - 1n) * (q - 1n);
    if (gcd(e, phi) !== 1n) throw new Error('EKUB(e, φ(n)) ≠ 1');
    const d = modInv(e, phi);
    steps.push({ title: 'Kalitlar', visuals: [{ kind: 'kv', items: [{ label: 'n', value: `${n}` }, { label: 'φ(n)', value: `${phi}` }, { label: 'd = e⁻¹ mod φ(n)', value: `${d}`, hl: true }] }] });
    if (h <= 0n || h >= n) throw new Error(`H(M) 1..${n - 1n} oralig‘ida bo‘lsin`);
    const s = fastPowSteps(h, d, n);
    steps.push(...prefixed(`Imzo S = ${h}^${d} mod ${n}`, s.steps));
    const vv = fastPowSteps(s.result, e, n);
    steps.push(...prefixed(`Tekshirish ${s.result}^${e} mod ${n}`, vv.steps));
    steps.push({ title: 'Xulosa', visuals: [vv.result === h ? { kind: 'note', tone: 'ok', text: `h′ = ${vv.result} = H(M) — imzo HAQIQIY ✓` } : { kind: 'note', tone: 'warn', text: 'Imzo noto‘g‘ri' }] });
    return { steps, output: [{ label: 'Imzo S', value: `${s.result}` }, { label: 'Tekshiruv', value: vv.result === h ? 'to‘g‘ri' : 'noto‘g‘ri' }] };
  },
};

/* ---------- ElGamal ERI ---------- */
export const elgamalSign: AlgorithmDef = {
  id: 'elgamal-sign', topic: 7, name: 'ElGamal elektron raqamli imzo',
  short: 'r = gᵏ mod p, s = k⁻¹(h − x·r) mod (p−1)',
  theory: ['k tasodifiy, EKUB(k, p−1) = 1 bo‘lishi va har imzoda yangi bo‘lishi shart. k qayta ishlatilsa maxfiy kalit x tiklanadi.', 'Tekshirish: gʰ ≡ yʳ·rˢ (mod p).'],
  formulas: ['r = gᵏ mod p', 's = k⁻¹·(h − x·r) mod (p−1)', 'gʰ ≡ yʳ·rˢ (mod p)'],
  fields: [
    { key: 'p', label: 'p', type: 'number', default: '23' }, { key: 'g', label: 'g', type: 'number', default: '5' },
    { key: 'x', label: 'x (maxfiy)', type: 'number', default: '6' }, { key: 'h', label: 'H(M)', type: 'number', default: '10' },
    { key: 'k', label: 'k', type: 'number', default: '7' },
  ],
  run(v) {
    const p = big(v, 'p'), g = big(v, 'g'), x = big(v, 'x'), h = big(v, 'h'), k = big(v, 'k');
    const steps: Step[] = [requirePrime(p, 'p')];
    const y = modPow(g, x, p);
    steps.push({ title: 'Ochiq kalit', visuals: [{ kind: 'formula', text: `y = gˣ mod p = ${g}^${x} mod ${p} = ${y}` }] });
    if (gcd(k, p - 1n) !== 1n) throw new Error(`EKUB(k, p−1) = ${gcd(k, p - 1n)} ≠ 1 — boshqa k tanlang`);
    const r = modPow(g, k, p);
    const ki = extEuclidSteps(k, p - 1n);
    steps.push({ title: 'r ni hisoblash', visuals: [{ kind: 'formula', text: `r = gᵏ mod p = ${g}^${k} mod ${p} = ${r}` }] });
    steps.push(...prefixed(`k⁻¹ mod ${p - 1n}`, ki.steps));
    const s = mod(ki.inv! * (h - x * r), p - 1n);
    steps.push({ title: 's ni hisoblash', visuals: [{ kind: 'formula', text: `s = k⁻¹·(h − x·r) mod (p−1) = ${ki.inv}·(${h} − ${x}·${r}) mod ${p - 1n} = ${ki.inv}·${h - x * r} mod ${p - 1n} = ${s}` }, { kind: 'note', tone: 'ok', text: `Imzo (r, s) = (${r}, ${s})` }] });
    const left = modPow(g, h, p), right = mod(modPow(y, r, p) * modPow(r, s, p), p);
    steps.push({ title: 'Tekshirish', visuals: [
      { kind: 'formula', text: `gʰ mod p = ${g}^${h} mod ${p} = ${left}` },
      { kind: 'formula', text: `yʳ·rˢ mod p = ${y}^${r}·${r}^${s} mod ${p} = ${modPow(y, r, p)}·${modPow(r, s, p)} mod ${p} = ${right}` },
      left === right ? { kind: 'note', tone: 'ok', text: 'Tenglik bajarildi — imzo HAQIQIY ✓' } : { kind: 'note', tone: 'warn', text: 'Imzo noto‘g‘ri' },
    ] });
    return { steps, output: [{ label: 'y', value: `${y}` }, { label: '(r, s)', value: `(${r}, ${s})` }, { label: 'Tekshiruv', value: left === right ? 'to‘g‘ri' : 'noto‘g‘ri' }] };
  },
};

/* ---------- Diffie–Hellman ---------- */
export const dh: AlgorithmDef = {
  id: 'dh', topic: 11, name: 'Diffie–Hellman kalit almashinuvi',
  short: 'A = gᵃ, B = gᵇ, K = Bᵃ = Aᵇ = gᵃᵇ mod p',
  theory: ['Ikki tomon ochiq kanal orqali umumiy maxfiy kalitga kelishadi. Xavfsizlik diskret logarifm muammosiga asoslanadi.', 'Autentifikatsiyasiz DH “o‘rtadagi odam” (MITM) hujumiga zaif.'],
  formulas: ['A = gᵃ mod p', 'B = gᵇ mod p', 'K = Bᵃ mod p = Aᵇ mod p'],
  fields: [
    { key: 'p', label: 'p (tub)', type: 'number', default: '23' }, { key: 'g', label: 'g', type: 'number', default: '5' },
    { key: 'a', label: 'Alice maxfiy a', type: 'number', default: '6' }, { key: 'b', label: 'Bob maxfiy b', type: 'number', default: '15' },
  ],
  run(v) {
    const p = big(v, 'p'), g = big(v, 'g'), a = big(v, 'a'), b = big(v, 'b');
    const steps: Step[] = [requirePrime(p, 'p')];
    const A = fastPowSteps(g, a, p); steps.push(...prefixed(`Alice: A = ${g}^${a} mod ${p}`, A.steps));
    const B = fastPowSteps(g, b, p); steps.push(...prefixed(`Bob: B = ${g}^${b} mod ${p}`, B.steps));
    steps.push({ title: 'Ochiq kanal orqali almashish', visuals: [{ kind: 'flow', nodes: [`Alice: A = ${A.result}`, '⇄ ochiq kanal ⇄', `Bob: B = ${B.result}`] }] });
    const Ka = fastPowSteps(B.result, a, p); steps.push(...prefixed(`Alice: K = ${B.result}^${a} mod ${p}`, Ka.steps));
    const Kb = fastPowSteps(A.result, b, p); steps.push(...prefixed(`Bob: K = ${A.result}^${b} mod ${p}`, Kb.steps));
    steps.push({ title: 'Umumiy kalit', visuals: [Ka.result === Kb.result ? { kind: 'note', tone: 'ok', text: `Ikkala tomonda K = ${Ka.result} — kelishuv muvaffaqiyatli ✓` } : { kind: 'note', tone: 'warn', text: 'Kalitlar mos emas' }] });
    return { steps, output: [{ label: 'A', value: `${A.result}` }, { label: 'B', value: `${B.result}` }, { label: 'K', value: `${Ka.result}` }] };
  },
};

export const TPUB = [rsa, elgamal, rsaSign, elgamalSign, dh];
