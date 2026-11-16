import { AlgorithmDef, Step, Visual } from '../core/models';
import { int, isPrime, modn, sup, val } from '../core/util';

/* ---------------------------------------------------------------
 * 9-, 10-MAVZULAR: Elliptik egri chiziqlar (GF(p) ustida)
 *   E: y² = x³ + a·x + b (mod p)
 *
 * Talablar bo'yicha tuzilma:
 *   1) istalgan mos (a, b, p)          → Curve konstruktori, a va b mod p ga keltiriladi
 *   2) p tub sonmi                      → checkPrime()
 *   3) singulyar emasmi                 → checkNonSingular()
 *   4) nuqta tenglamani qanoatlantiradi → checkPoint()
 *   5) teskari element (Evklid)         → modInverse()
 *   6) qo'shish va ikkilantirish        → pointAdd(), pointDouble()
 *   7) egri chiziq va nuqta tartibi     → curveOrder(), pointOrder()
 *   8) xatolar → EccError (aniq sabab bilan), ogohlantirishlar → note 'warn'
 * ------------------------------------------------------------- */

export type Pt = [number, number] | null; // null = cheksiz nuqta O
export const show = (P: Pt): string => (P ? `(${P[0]}, ${P[1]})` : 'O');

/** Foydalanuvchiga tushunarli xato (sahifada sariq ogohlantirish bo'lib chiqadi) */
export class EccError extends Error {}

/** Hisoblashlar Number da: p ≤ 10⁶ bo'lganda barcha ko'paytmalar 2⁵³ dan kichik qoladi */
export const P_MAX = 1_000_003;
const PLOT_MAX = 251; // grafik chizish chegarasi
const LIST_MAX = 101; // barcha nuqtalarni jadvalda ko'rsatish chegarasi

/* ======================= 2) p tub sonmi ======================= */
export interface PrimeCheck { prime: boolean; divisor?: number; text: string }

export function checkPrime(p: number): PrimeCheck {
  if (!Number.isInteger(p) || p < 3) return { prime: false, text: `p = ${p}: p ≥ 3 bo‘lgan butun son bo‘lishi kerak` };
  for (let d = 2; d * d <= p; d++) {
    if (p % d === 0) return { prime: false, divisor: d, text: `p = ${p} = ${d} · ${p / d} — tub son emas` };
  }
  // Miller–Rabin bilan ikkinchi tekshiruv (util.isPrime)
  const mr = isPrime(BigInt(p));
  return { prime: mr, text: `p = ${p}: 2 dan √p ≈ ${Math.floor(Math.sqrt(p))} gacha bo‘luvchi yo‘q, Miller–Rabin testi ham tasdiqladi — tub son ✓` };
}

/* ======================= 3) singulyarlik ======================= */
export interface SingCheck { ok: boolean; a3: number; b2: number; disc: number; text: string }

export function checkNonSingular(a: number, b: number, p: number): SingCheck {
  const a3 = modn(4 * modn(modn(a * a, p) * a, p), p);
  const b2 = modn(27 * modn(b * b, p), p);
  const disc = modn(a3 + b2, p);
  const text = `4a³ + 27b² = 4·${a}³ + 27·${b}² ≡ ${a3} + ${b2} ≡ ${disc} (mod ${p})`;
  return { ok: disc !== 0, a3, b2, disc, text };
}

/* ======================= 5) teskari element (kengaytirilgan Evklid) ======================= */
export interface InvTrace { inv: number; rows: (string | number)[][] }

/** a⁻¹ mod p ni kengaytirilgan Evklid algoritmi bilan topadi; jadval qatorlari: q, r, t */
export function modInverse(a: number, p: number): InvTrace {
  a = modn(a, p);
  if (a === 0) throw new EccError(`0 ning mod ${p} bo‘yicha teskarisi mavjud emas (maxrajda 0 hosil bo‘ldi)`);
  const rows: (string | number)[][] = [['—', p, 0], ['—', a, 1]];
  let [r0, r1, t0, t1] = [p, a, 0, 1];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
    if (r1 !== 0) rows.push([q, r1, t1]);
  }
  if (r0 !== 1) throw new EccError(`${a}⁻¹ mod ${p} mavjud emas: EKUB(${a}, ${p}) = ${r0} ≠ 1`);
  const inv = modn(t0, p);
  if (modn(a * inv, p) !== 1) throw new EccError(`Teskari element tekshiruvdan o‘tmadi: ${a}·${inv} mod ${p} ≠ 1`);
  return { inv, rows };
}

/** Qadam ichida ko'rsatish uchun Evklid jadvali */
const invVisuals = (a: number, p: number, tr: InvTrace): Visual[] => [
  { kind: 'table', caption: `${a}⁻¹ mod ${p} — kengaytirilgan Evklid algoritmi`, headers: ['q', 'qoldiq r', 't'], rows: tr.rows, hlRows: [tr.rows.length - 1] },
  { kind: 'formula', text: `${a}⁻¹ ≡ ${tr.inv} (mod ${p}),  tekshiruv: ${a}·${tr.inv} = ${a * tr.inv} ≡ 1 ✓` },
];

/* ======================= Egri chiziq ======================= */
export class Curve {
  readonly a: number;
  readonly b: number;
  /** a, b manfiy yoki p dan katta kiritilsa — shu yerda ogohlantirish yoziladi */
  readonly warnings: string[] = [];
  private _order?: number;
  private _sq?: Int32Array;

  constructor(a: number, b: number, public p: number) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(p)) throw new EccError('a, b, p butun son bo‘lishi kerak');
    if (p > P_MAX) throw new EccError(`p ≤ ${P_MAX.toLocaleString()} bo‘lsin (brauzerda barcha nuqtalarni sanash uchun)`);
    const pc = checkPrime(p);
    if (!pc.prime) throw new EccError(`${pc.text}. GF(p) maydon bo‘lishi uchun p tub bo‘lishi shart.`);
    this.a = modn(a, p);
    this.b = modn(b, p);
    if (this.a !== a) this.warnings.push(`a = ${a} mod ${p} ga keltirildi: a = ${this.a}`);
    if (this.b !== b) this.warnings.push(`b = ${b} mod ${p} ga keltirildi: b = ${this.b}`);
    const sc = checkNonSingular(this.a, this.b, p);
    if (!sc.ok) throw new EccError(`${sc.text} — egri chiziq singulyar (karrali ildizi bor), boshqa a yoki b tanlang`);
  }

  /** Tenglama matni: y² = x³ + 2x + 2 (mod 17) */
  eq(): string {
    const t = (k: number, v: string) => (k === 0 ? '' : ` + ${k === 1 && v ? '' : k}${v}`);
    return `y² = x³${t(this.a, 'x')}${t(this.b, '')} (mod ${this.p})`;
  }

  /** f(x) = x³ + ax + b mod p */
  f(x: number): number {
    const p = this.p;
    return modn(modn(modn(x * x, p) * x, p) + modn(this.a * x, p) + this.b, p);
  }

  /** 4) Nuqta tenglamani qanoatlantiradimi */
  on(P: Pt): boolean { return !P || modn(P[1] * P[1], this.p) === this.f(P[0]); }

  /** y² mod p jadvali: sq[v] — y² ≡ v bo'ladigan y lar soni */
  private squares(): Int32Array {
    if (!this._sq) {
      const sq = new Int32Array(this.p);
      for (let y = 0; y < this.p; y++) sq[modn(y * y, this.p)]++;
      this._sq = sq;
    }
    return this._sq;
  }

  /** Barcha affin nuqtalar (O siz). Faqat kichik p uchun */
  points(): [number, number][] {
    const p = this.p, roots: number[][] = Array.from({ length: p }, () => []);
    for (let y = 0; y < p; y++) roots[modn(y * y, p)].push(y);
    const out: [number, number][] = [];
    for (let x = 0; x < p; x++) for (const y of roots[this.f(x)]) out.push([x, y]);
    return out;
  }

  /* -------- 6) qo'shish va ikkilantirish — alohida funksiyalar -------- */

  /** P ≠ Q bo'lganda P + Q */
  pointAdd(P: Pt, Q: Pt, log?: Visual[]): Pt {
    const p = this.p;
    if (!P) { log?.push({ kind: 'formula', text: 'O + Q = Q (O — neytral element)' }); return Q; }
    if (!Q) { log?.push({ kind: 'formula', text: 'P + O = P (O — neytral element)' }); return P; }
    if (P[0] === Q[0]) {
      if (P[1] === Q[1]) return this.pointDouble(P, log);
      log?.push({ kind: 'formula', text: `x₁ = x₂ = ${P[0]} va y₁ = −y₂ (mod ${p}) ⇒ P + Q = O (vertikal to‘g‘ri chiziq)` });
      return null;
    }
    const num = modn(Q[1] - P[1], p), den = modn(Q[0] - P[0], p);
    const tr = modInverse(den, p);
    const lam = modn(num * tr.inv, p);
    log?.push({ kind: 'formula', text: `λ = (y₂ − y₁)/(x₂ − x₁) = (${Q[1]} − ${P[1]})/(${Q[0]} − ${P[0]}) ≡ ${num}·${den}⁻¹ (mod ${p})` });
    log?.push(...invVisuals(den, p, tr));
    log?.push({ kind: 'formula', text: `λ = ${num}·${tr.inv} = ${num * tr.inv} ≡ ${lam} (mod ${p})` });
    return this.finish(P, Q, lam, log);
  }

  /** 2P */
  pointDouble(P: Pt, log?: Visual[]): Pt {
    const p = this.p;
    if (!P) { log?.push({ kind: 'formula', text: '2·O = O' }); return null; }
    if (P[1] === 0) { log?.push({ kind: 'formula', text: `y₁ = 0 ⇒ urinma vertikal ⇒ 2P = O (P ning tartibi 2)` }); return null; }
    const num = modn(3 * modn(P[0] * P[0], p) + this.a, p), den = modn(2 * P[1], p);
    const tr = modInverse(den, p);
    const lam = modn(num * tr.inv, p);
    log?.push({ kind: 'formula', text: `λ = (3x₁² + a)/(2y₁) = (3·${P[0]}² + ${this.a})/(2·${P[1]}) ≡ ${num}·${den}⁻¹ (mod ${p})` });
    log?.push(...invVisuals(den, p, tr));
    log?.push({ kind: 'formula', text: `λ = ${num}·${tr.inv} = ${num * tr.inv} ≡ ${lam} (mod ${p})` });
    return this.finish(P, P, lam, log);
  }

  private finish(P: [number, number], Q: [number, number], lam: number, log?: Visual[]): Pt {
    const p = this.p;
    const x3 = modn(modn(lam * lam, p) - P[0] - Q[0], p);
    const y3 = modn(lam * modn(P[0] - x3, p) - P[1], p);
    log?.push({ kind: 'formula', text: `x₃ = λ² − x₁ − x₂ = ${lam}² − ${P[0]} − ${Q[0]} ≡ ${x3} (mod ${p})` });
    log?.push({ kind: 'formula', text: `y₃ = λ(x₁ − x₃) − y₁ = ${lam}·(${P[0]} − ${x3}) − ${P[1]} ≡ ${y3} (mod ${p})` });
    const R: Pt = [x3, y3];
    if (!this.on(R)) throw new EccError(`Ichki xato: natija ${show(R)} egri chiziqda yotmaydi`);
    return R;
  }

  /** Umumiy qo'shish (P = Q bo'lsa ikkilantirishga yo'naltiradi) — boshqa modullar uchun */
  add(P: Pt, Q: Pt, notes?: string[]): Pt {
    const log: Visual[] | undefined = notes ? [] : undefined;
    const R = P && Q && P[0] === Q[0] && P[1] === Q[1] ? this.pointDouble(P, log) : this.pointAdd(P, Q, log);
    log?.forEach((v) => v.kind === 'formula' && notes!.push(v.text));
    return R;
  }

  neg(P: Pt): Pt { return P ? [P[0], modn(-P[1], this.p)] : null; }

  /** n·P — Double-and-Add */
  mul(n: number, P: Pt): Pt {
    if (n < 0) return this.mul(-n, this.neg(P));
    let R: Pt = null;
    for (const bit of n.toString(2)) { R = this.pointDouble(R); if (bit === '1') R = this.pointAdd(R, P); }
    return R;
  }

  /* -------- 7) egri chiziq va nuqta tartibi — alohida funksiyalar -------- */

  /** #E(F_p) = 1 + Σ (x uchun y lar soni) */
  curveOrder(): number {
    if (this._order === undefined) {
      const sq = this.squares();
      let n = 1; // O nuqta
      for (let x = 0; x < this.p; x++) n += sq[this.f(x)];
      this._order = n;
    }
    return this._order;
  }

  /** ord(P) — k·P = O bo'ladigan eng kichik k (davr). Lagranj: ord(P) | #E */
  pointOrder(P: Pt): number {
    if (!P) return 1;
    if (!this.on(P)) throw new EccError(`${show(P)} egri chiziqda yotmaydi — tartibni hisoblab bo‘lmaydi`);
    const N = this.curveOrder();
    for (const d of divisors(N)) if (this.mul(d, P) === null) return d;
    throw new EccError(`Ichki xato: #E·P ≠ O (#E = ${N})`);
  }
}

export function divisors(n: number): number[] {
  const small: number[] = [], big: number[] = [];
  for (let d = 1; d * d <= n; d++) if (n % d === 0) { small.push(d); if (d * d !== n) big.unshift(n / d); }
  return [...small, ...big];
}

/* ======================= kirish va umumiy qadamlar ======================= */

const curveFields = [
  { key: 'a', label: 'a', type: 'number' as const, default: '2', hint: 'istalgan butun son (mod p ga keltiriladi)' },
  { key: 'b', label: 'b', type: 'number' as const, default: '2' },
  { key: 'p', label: 'p (tub son)', type: 'number' as const, default: '17', hint: `3 ≤ p ≤ ${P_MAX.toLocaleString()}` },
];

/** "(x, y)" ni o'qish */
export function parsePoint(s: string, name: string, c?: Curve, warn?: string[]): Pt {
  const t = s.replace(/[()\s]/g, '');
  if (/^(o|O|inf|∞)$/.test(t)) return null;
  const m = t.split(/[,;]/);
  if (m.length !== 2 || m.some((x) => !/^-?\d+$/.test(x))) throw new EccError(`${name}: nuqtani (x, y) ko‘rinishida kiriting, masalan (5, 1)`);
  let P: [number, number] = [Number(m[0]), Number(m[1])];
  if (c) {
    const r: [number, number] = [modn(P[0], c.p), modn(P[1], c.p)];
    if (r[0] !== P[0] || r[1] !== P[1]) warn?.push(`${name} = (${P[0]}, ${P[1]}) koordinatalari mod ${c.p} ga keltirildi: ${show(r)}`);
    P = r;
  }
  return P;
}

/** 4) nuqta tekshiruvi — qadam ko'rinishida; yotmasa aniq sabab bilan xato */
export function checkPoint(c: Curve, P: Pt, name: string): Visual {
  if (!P) return { kind: 'formula', text: `${name} = O — cheksiz nuqta, egri chiziqqa tegishli ✓` };
  const lhs = modn(P[1] * P[1], c.p), rhs = c.f(P[0]);
  const text = `${name} = ${show(P)}: y² = ${P[1]}² ≡ ${lhs},  x³ + ax + b = ${P[0]}³ + ${c.a}·${P[0]} + ${c.b} ≡ ${rhs} (mod ${c.p})`;
  if (lhs !== rhs) {
    const ys = c.p <= P_MAX ? rootsOf(c, P[0]) : [];
    const hint = ys.length ? ` x = ${P[0]} uchun to‘g‘ri nuqtalar: ${ys.map((y) => show([P[0], y])).join(', ')}.` : ` x = ${P[0]} da egri chiziqda nuqta yo‘q (f(x) kvadrat chegirma emas).`;
    throw new EccError(`${text} — ${lhs} ≠ ${rhs}, ${name} egri chiziqda yotmaydi.${hint}`);
  }
  return { kind: 'formula', text: `${text} — teng ✓` };
}

function rootsOf(c: Curve, x: number): number[] {
  const v = c.f(x), out: number[] = [];
  for (let y = 0; y < c.p && out.length < 2; y++) if (modn(y * y, c.p) === v) out.push(y);
  return out;
}

/** 1–3 talablar: parametrlar tekshiruvi qadami */
function paramsStep(c: Curve): Step {
  const pc = checkPrime(c.p), sc = checkNonSingular(c.a, c.b, c.p);
  return {
    title: 'Parametrlarni tekshirish',
    text: `E: ${c.eq()}`,
    visuals: [
      { kind: 'formula', text: `1) ${pc.text}` },
      { kind: 'formula', text: `2) ${sc.text} ≠ 0 — egri chiziq singulyar emas ✓` },
      ...c.warnings.map((t): Visual => ({ kind: 'note', tone: 'warn', text: t })),
    ],
  };
}

/** Egri chiziq tartibi va Xasse chegarasi */
function orderStep(c: Curve, hl: Pt[] = []): Step {
  const N = c.curveOrder(), p = c.p, s = 2 * Math.sqrt(p);
  const visuals: Visual[] = [
    { kind: 'formula', text: `#E = 1 (O nuqta) + Σₓ [y² ≡ x³ + ax + b yechimlari soni] = ${N}` },
    { kind: 'formula', text: `Xasse teoremasi: |#E − (p + 1)| = |${N} − ${p + 1}| = ${Math.abs(N - p - 1)} ≤ 2√p ≈ ${s.toFixed(2)} ✓` },
    { kind: 'formula', text: `#E = ${N} = ${factor(N)}${isPrime(BigInt(N)) ? ' — tub son: O dan boshqa har bir nuqta generator' : ''}` },
  ];
  if (p <= PLOT_MAX) visuals.push({ kind: 'plot', p, points: c.points(), hl: hl.filter((x): x is [number, number] => !!x) });
  else visuals.push({ kind: 'note', tone: 'info', text: `p > ${PLOT_MAX} — grafik chizilmadi (nuqtalar juda ko‘p).` });
  return { title: 'Egri chiziq tartibi #E', visuals };
}

function factor(n: number): string {
  const f: string[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d++) { let e = 0; while (m % d === 0) { m /= d; e++; } if (e) f.push(e > 1 ? `${d}${sup(e)}` : `${d}`); }
  if (m > 1) f.push(`${m}`);
  return f.join(' · ') || '1';
}

/** Davr (nuqta tartibi) qadami: P, 2P, … , kP = O */
function periodStep(c: Curve, P: Pt, name = 'P'): Step {
  const N = c.curveOrder(), ord = c.pointOrder(P);
  const visuals: Visual[] = [
    { kind: 'formula', text: `Lagranj teoremasi: ord(${name}) | #E = ${N}. Bo‘luvchilar: ${divisors(N).join(', ')}` },
  ];
  if (ord <= 60) {
    const rows: (string | number)[][] = [];
    let R: Pt = null;
    for (let k = 1; k <= ord; k++) { R = c.pointAdd(R, P); rows.push([`${k}·${name}`, show(R)]); }
    visuals.push({ kind: 'table', caption: `${name} ning karralilari (davr ${ord} da takrorlanadi)`, headers: ['k·' + name, 'Natija'], rows, hlRows: [rows.length - 1] });
  } else {
    visuals.push({ kind: 'formula', text: `${ord}·${name} = O, kichikroq bo‘luvchilar uchun d·${name} ≠ O (Double-and-Add bilan tekshirildi)` });
  }
  visuals.push({ kind: 'note', tone: 'ok', text: `${name} = ${show(P)} nuqtaning davri (tartibi): ord(${name}) = ${ord}${ord === N ? ` = #E — ${name} butun guruhning generatori` : `, kofaktor h = #E / ord = ${N / ord}`}` });
  return { title: `Davr: ord(${name}) = ${ord}`, visuals };
}

/* ======================= 9-mavzu: nuqtalar arifmetikasi ======================= */

export const eccArith: AlgorithmDef = {
  id: 'ecc', topic: 9, name: 'Elliptik egri chiziqda nuqtalar arifmetikasi',
  short: 'Tekshiruvlar, P + Q, 2P, n·P, egri chiziq va nuqta tartibi (davr) — GF(p) ustida',
  theory: [
    'E: y² = x³ + ax + b (mod p). Shartlar: p — tub son, 4a³ + 27b² ≢ 0 (mod p) — aks holda egri chiziq singulyar va guruh hosil qilmaydi.',
    'Cheksiz nuqta O — neytral element; −P = (x, −y). P + Q va 2P formulalaridagi bo‘lish — maxrajning mod p bo‘yicha teskarisiga ko‘paytirish (kengaytirilgan Evklid algoritmi).',
    'Egri chiziq tartibi #E — barcha nuqtalar soni (O bilan). Xasse: |#E − (p+1)| ≤ 2√p.',
    'Nuqta tartibi (davri) ord(P) — k·P = O bo‘ladigan eng kichik k. Lagranj teoremasiga ko‘ra ord(P) har doim #E ning bo‘luvchisi. k·P qiymatlari har ord(P) qadamda takrorlanadi.',
    'ECDLP: Q = n·P berilganda n ni topish amalda imkonsiz — ECC xavfsizligining asosi.',
  ],
  formulas: ['P≠Q: λ = (y₂−y₁)·(x₂−x₁)⁻¹', 'P=Q: λ = (3x₁²+a)·(2y₁)⁻¹', 'x₃ = λ² − x₁ − x₂', 'y₃ = λ(x₁ − x₃) − y₁', 'ord(P) | #E'],
  fields: [
    { key: 'op', label: 'Amal', type: 'select', default: 'mul', options: [
      { value: 'add', label: 'P + Q (qo‘shish)' }, { value: 'dbl', label: '2P (ikkilantirish)' }, { value: 'mul', label: 'n·P (Double-and-Add)' },
      { value: 'order', label: 'Nuqta davri ord(P)' }, { value: 'info', label: 'Egri chiziq: barcha nuqtalar va davrlari' },
    ] },
    ...curveFields,
    { key: 'P', label: 'P = (x, y)', type: 'text', default: '(5, 1)' },
    { key: 'Q', label: 'Q = (x, y)', type: 'text', default: '(6, 3)', hint: 'faqat P + Q uchun' },
    { key: 'n', label: 'n', type: 'number', default: '9', hint: 'faqat n·P uchun' },
  ],
  examples: [
    { label: '(5,1) + (6,3), p=17', values: { op: 'add', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(6,3)', n: '1' } },
    { label: '2·(5,1), p=17', values: { op: 'dbl', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(6,3)', n: '2' } },
    { label: '9·(5,1), p=17', values: { op: 'mul', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(6,3)', n: '9' } },
    { label: 'ord(5,1)=19, p=17', values: { op: 'order', a: '2', b: '2', p: '17', P: '(5,1)', Q: '(6,3)', n: '1' } },
    { label: 'y²=x³+x+1, p=23', values: { op: 'info', a: '1', b: '1', p: '23', P: '(3,10)', Q: '(9,7)', n: '1' } },
    { label: 'ord(3,10)=28, p=23', values: { op: 'order', a: '1', b: '1', p: '23', P: '(3,10)', Q: '(9,7)', n: '1' } },
    { label: 'ord(5,4)=7, p=23', values: { op: 'order', a: '1', b: '1', p: '23', P: '(5,4)', Q: '(9,7)', n: '1' } },
    { label: 'ord(11,3)=4, p=23', values: { op: 'order', a: '1', b: '1', p: '23', P: '(11,3)', Q: '(9,7)', n: '1' } },
    { label: 'ord(4,0)=2, p=23', values: { op: 'order', a: '1', b: '1', p: '23', P: '(4,0)', Q: '(9,7)', n: '1' } },
    { label: '(3,10)+(9,7), p=23', values: { op: 'add', a: '1', b: '1', p: '23', P: '(3,10)', Q: '(9,7)', n: '1' } },
  ],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const op = val(v, 'op');
    const warn: string[] = [];
    const steps: Step[] = [paramsStep(c)];

    if (op === 'info') {
      steps.push(orderStep(c));
      if (c.p > LIST_MAX) {
        steps.push({ title: 'Nuqtalar ro‘yxati', visuals: [{ kind: 'note', tone: 'warn', text: `p > ${LIST_MAX} — barcha nuqtalar jadvali juda katta. Bitta nuqta davrini “Nuqta davri” amali bilan hisoblang.` }] });
      } else {
        const pts = c.points(), N = c.curveOrder();
        const rows = pts.map((P, i) => { const o = c.pointOrder(P); return [i + 1, show(P), o, o === N ? 'generator' : `h = ${N / o}`]; });
        rows.unshift([0, 'O', 1, 'neytral']);
        const dist = new Map<number, number>();
        rows.forEach((r) => dist.set(r[2] as number, (dist.get(r[2] as number) ?? 0) + 1));
        steps.push({ title: 'Barcha nuqtalar va ularning davri', visuals: [
          { kind: 'table', headers: ['#', 'Nuqta', 'ord (davr)', 'Izoh'], rows },
          { kind: 'kv', items: [...dist.entries()].sort((x, y) => x[0] - y[0]).map(([o, k]) => ({ label: `ord = ${o}`, value: `${k} ta nuqta`, hl: o === N })) },
        ] });
      }
      return { steps, output: [{ label: 'Egri chiziq', value: c.eq() }, { label: '#E', value: `${c.curveOrder()}` }] };
    }

    const P = parsePoint(val(v, 'P'), 'P', c, warn);
    const checks: Visual[] = [checkPoint(c, P, 'P')];
    let Q: Pt = null;
    if (op === 'add') { Q = parsePoint(val(v, 'Q'), 'Q', c, warn); checks.push(checkPoint(c, Q, 'Q')); }
    steps.push({ title: 'Nuqtalar tenglamani qanoatlantiradimi', visuals: [...checks, ...warn.map((t): Visual => ({ kind: 'note', tone: 'warn', text: t }))] });

    let R: Pt;
    const output: { label: string; value: string }[] = [];
    if (op === 'add' || op === 'dbl') {
      const log: Visual[] = [];
      if (op === 'dbl') R = c.pointDouble(P, log);
      else {
        if (P && Q && P[0] === Q[0] && P[1] === Q[1]) log.push({ kind: 'note', tone: 'warn', text: 'P = Q — qo‘shish o‘rniga ikkilantirish formulasi ishlatiladi' });
        R = c.pointAdd(P, Q, log);
      }
      if (!R) log.push({ kind: 'note', tone: 'warn', text: 'Natija cheksiz nuqta O' });
      steps.push({ title: op === 'dbl' ? 'Nuqtani ikkilantirish 2P' : 'Nuqtalarni qo‘shish P + Q', visuals: [...log, { kind: 'note', tone: 'ok', text: `${op === 'dbl' ? '2P' : 'P + Q'} = ${show(R)}` }] });
      output.push({ label: op === 'dbl' ? '2P' : 'P + Q', value: show(R) });
    } else if (op === 'mul') {
      const n = int(v, 'n');
      if (n < 1) throw new EccError('n ≥ 1 bo‘lishi kerak');
      const ord = c.pointOrder(P);
      const bits = n.toString(2);
      steps.push({ title: 'n ni ikkilik ko‘rinishga ajratish', visuals: [
        { kind: 'formula', text: `n = ${n} = ${bits}₂ — chapdan o‘ngga: har bitda R ← 2R, “1” bo‘lsa R ← R + P` },
        ...(n >= ord ? [{ kind: 'note' as const, tone: 'info' as const, text: `ord(P) = ${ord} bo‘lgani uchun n·P = (n mod ${ord})·P = ${n % ord}·P` }] : []),
      ] });
      R = null;
      const rows: (string | number)[][] = [];
      bits.split('').forEach((bit, i) => {
        const log: Visual[] = [];
        R = c.pointDouble(R, log);
        const afterD = R;
        const addLog: Visual[] = [];
        if (bit === '1') R = c.pointAdd(R, P, addLog);
        rows.push([i + 1, bit, show(afterD), bit === '1' ? show(R) : '—']);
        steps.push({ title: `${i + 1}-bit = ${bit}`, visuals: [
          { kind: 'formula', text: `Double: 2R = ${show(afterD)}` }, ...log,
          ...(bit === '1' ? [{ kind: 'formula' as const, text: `Add: R + P = ${show(R)}` }, ...addLog] : []),
        ] });
      });
      steps.push({ title: 'Double-and-Add jadvali', visuals: [{ kind: 'table', headers: ['#', 'Bit', 'Double', 'Add'], rows, hlRows: [rows.length - 1] }, { kind: 'note', tone: 'ok', text: `${n}·P = ${show(R)}` }] });
      output.push({ label: `${n}·P`, value: show(R) });
    } else if (op === 'order') {
      R = P;
    } else throw new EccError(`Noma’lum amal: ${op}`);

    // 7) Egri chiziq tartibi va davr — har bir misolda
    steps.push(orderStep(c, [P, Q, R]));
    steps.push(periodStep(c, P, 'P'));
    output.push({ label: '#E', value: `${c.curveOrder()}` }, { label: 'ord(P) — davr', value: `${c.pointOrder(P)}` });
    if (op === 'add' && Q) { steps.push(periodStep(c, Q, 'Q')); output.push({ label: 'ord(Q)', value: `${c.pointOrder(Q)}` }); }
    if (op !== 'order' && R) output.push({ label: 'ord(natija)', value: `${c.pointOrder(R)}` });
    return { steps, output };
  },
};

/* ======================= 10-mavzu: ECDH ======================= */

export const ecdh: AlgorithmDef = {
  id: 'ecdh', topic: 10, name: 'ECDH — elliptik egri chiziqda kalit almashish',
  short: 'Q_A = d_A·G, Q_B = d_B·G, K = d_A·Q_B = d_B·Q_A',
  theory: [
    'Diffie–Hellman g’oyasi elliptik egri chiziqda: darajaga oshirish o‘rniga skalyar ko‘paytma ishlatiladi.',
    'G nuqtaning davri n = ord(G) muhim: maxfiy kalitlar 1 < d < n oralig‘ida tanlanadi, chunki d·G qiymatlari har n qadamda takrorlanadi.',
    'ECC 256-bit kalit ≈ RSA 3072-bit xavfsizlik — kichik kalit, yuqori tezlik.',
  ],
  formulas: ['Q = d·G', 'K = d_A·(d_B·G) = d_B·(d_A·G)', 'ord(G) | #E'],
  fields: [...curveFields, { key: 'G', label: 'G (generator)', type: 'text', default: '(5, 1)' }, { key: 'da', label: 'd_A', type: 'number', default: '3' }, { key: 'db', label: 'd_B', type: 'number', default: '7' }],
  examples: [
    { label: 'p=17, G=(5,1)', values: { a: '2', b: '2', p: '17', G: '(5,1)', da: '3', db: '7' } },
    { label: 'p=23, G=(3,10)', values: { a: '1', b: '1', p: '23', G: '(3,10)', da: '5', db: '9' } },
  ],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const warn: string[] = [];
    const G = parsePoint(val(v, 'G'), 'G', c, warn);
    if (!G) throw new EccError('G = O bo‘lishi mumkin emas');
    const steps: Step[] = [paramsStep(c), { title: 'G tenglamani qanoatlantiradimi', visuals: [checkPoint(c, G, 'G'), ...warn.map((t): Visual => ({ kind: 'note', tone: 'warn', text: t }))] }];
    const ord = c.pointOrder(G);
    const da = int(v, 'da'), db = int(v, 'db');
    if (da < 1 || db < 1) throw new EccError('d_A va d_B musbat bo‘lishi kerak');
    const kw: Visual[] = [];
    if (da >= ord || db >= ord) kw.push({ kind: 'note', tone: 'warn', text: `Maxfiy kalit ord(G) = ${ord} dan kichik bo‘lishi kerak: ${da >= ord ? `d_A ≡ ${da % ord}` : ''} ${db >= ord ? `d_B ≡ ${db % ord}` : ''} (mod ${ord})` });
    if (ord < 5) kw.push({ kind: 'note', tone: 'warn', text: `ord(G) = ${ord} juda kichik — kalit fazosi kichik, boshqa G tanlang` });
    steps.push(orderStep(c, [G]), periodStep(c, G, 'G'));
    const QA = c.mul(da, G), QB = c.mul(db, G), KA = c.mul(da, QB), KB = c.mul(db, QA);
    steps.push({ title: 'Ochiq kalitlar', visuals: [...kw, { kind: 'kv', items: [{ label: `Alice: Q_A = ${da}·G`, value: show(QA), hl: true }, { label: `Bob: Q_B = ${db}·G`, value: show(QB), hl: true }] }] });
    if (!KA) throw new EccError('Umumiy kalit O chiqdi — boshqa d_A yoki d_B tanlang');
    steps.push({ title: 'Umumiy kalit', visuals: [{ kind: 'kv', items: [{ label: `Alice: ${da}·Q_B`, value: show(KA) }, { label: `Bob: ${db}·Q_A`, value: show(KB) }] }, show(KA) === show(KB) ? { kind: 'note', tone: 'ok', text: `K = ${show(KA)} — mos keldi ✓ (odatda x koordinatasi kalit sifatida olinadi)` } : { kind: 'note', tone: 'warn', text: 'Mos emas' }] });
    if (c.p <= PLOT_MAX) steps.push({ title: 'Nuqtalar grafikda', visuals: [{ kind: 'plot', p: c.p, points: c.points(), hl: [G, QA, QB, KA].filter((x): x is [number, number] => !!x) }] });
    return { steps, output: [{ label: 'ord(G) — davr', value: `${ord}` }, { label: 'Q_A', value: show(QA) }, { label: 'Q_B', value: show(QB) }, { label: 'K', value: show(KA) }] };
  },
};

export const T9 = [eccArith, ecdh];
