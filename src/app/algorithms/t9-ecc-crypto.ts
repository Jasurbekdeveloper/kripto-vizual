import { AlgorithmDef, Step, Visual } from '../core/models';
import { int, isPrime, modn, utf8, val } from '../core/util';
import { sha256 } from './t6-sha';
import { streebog } from './t-gost';
import {
  checkPoint, Curve, curveFields, EccError, modInverse, orderStep, paramsStep, parsePoint, periodStep, Pt, show,
} from './t9-ecc';

/* ---------------------------------------------------------------
 * 8-TOPSHIRIQ: Elliptik egri chiziqlar asosidagi kriptotizimlar
 *   1) ECDSA                         — imzo yaratish va tekshirish
 *   2) GOST R 34.10-2018 (34.10-2012) — imzo, xesh: GOST R 34.11-2018 (Streebog)
 *   3) EC ElGamal                    — matnni shifrlash / deshifrlash
 *   4) Nuqtalarni belgilarga akslantiruvchi jadval
 * Har bir algoritm barcha oraliq qiymatlarni (λ, teskari element,
 * Double-and-Add jadvali) qadamma-qadam ko'rsatadi.
 * ------------------------------------------------------------- */

const DEF = { a: '1', b: '3', p: '31', G: '(1, 6)' }; // #E = 41 — tub son, har bir nuqta generator
const DEF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/* ======================= umumiy yordamchilar ======================= */

const flowStep = (phases: string[], n: number, pre: string, steps: Step[]): Step[] =>
  steps.map((s) => ({ ...s, title: `${pre}: ${s.title}`, visuals: [{ kind: 'flow', nodes: phases, active: n - 1 } as Visual, ...s.visuals] }));

/** a⁻¹ mod n — kengaytirilgan Evklid jadvali bilan */
function invVis(a: number, n: number, label: string): { inv: number; visuals: Visual[] } {
  const tr = modInverse(a, n);
  return {
    inv: tr.inv,
    visuals: [
      { kind: 'table', caption: `${label} = ${modn(a, n)}⁻¹ mod ${n} — kengaytirilgan Evklid algoritmi`, headers: ['q', 'qoldiq r', 't'], rows: tr.rows, hlRows: [tr.rows.length - 1] },
      { kind: 'formula', text: `${label} = ${tr.inv},  tekshiruv: ${modn(a, n)}·${tr.inv} = ${modn(a, n) * tr.inv} ≡ 1 (mod ${n}) ✓` },
    ],
  };
}

/** k·P — Double-and-Add jadvali */
function mulVis(c: Curve, k: number, P: Pt, pName: string, rName: string): { R: Pt; visuals: Visual[] } {
  if (k < 1) throw new EccError(`${rName}: skalyar ko‘paytuvchi ${k} ≥ 1 bo‘lishi kerak`);
  const bits = k.toString(2);
  let R: Pt = null;
  const rows: (string | number)[][] = [];
  bits.split('').forEach((bit, i) => {
    R = c.pointDouble(R);
    const d = R;
    if (bit === '1') R = c.pointAdd(R, P);
    rows.push([i + 1, bit, show(d), bit === '1' ? show(R) : '—']);
  });
  return {
    R,
    visuals: [
      { kind: 'formula', text: `${k} = ${bits}₂ — chapdan o‘ngga: har bitda R ← 2R, bit “1” bo‘lsa R ← R + ${pName}` },
      { kind: 'table', caption: `${rName} = ${k}·${pName} — Double-and-Add`, headers: ['#', 'Bit', 'R ← 2R', `R ← R + ${pName}`], rows, hlRows: [rows.length - 1] },
      { kind: 'note', tone: 'ok', text: `${rName} = ${k}·${pName} = ${k}·${show(P)} = ${show(R)}` },
    ],
  };
}

/** P + Q — λ va Evklid jadvali bilan to'liq hisob */
function addVis(c: Curve, P: Pt, Q: Pt, label: string): { R: Pt; visuals: Visual[] } {
  const log: Visual[] = [];
  const R = P && Q && P[0] === Q[0] && P[1] === Q[1] ? c.pointDouble(P, log) : c.pointAdd(P, Q, log);
  return { R, visuals: [{ kind: 'formula', text: `${label} = ${show(P)} + ${show(Q)}` }, ...log, { kind: 'note', tone: 'ok', text: `${label} = ${show(R)}` }] };
}

/** Egri chiziq, G nuqta va uning tartibi n — barcha tekshiruvlar */
function setup(v: Record<string, string>, gKey = 'G', needPrimeOrder = true, nm = 'G', nn = 'n') {
  const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
  const warn: string[] = [];
  const G = parsePoint(val(v, gKey), nm, c, warn);
  if (!G) throw new EccError(`${nm} = O bo‘lishi mumkin emas — egri chiziqdagi boshqa nuqtani kiriting`);
  const gCheck = checkPoint(c, G, nm);
  const n = c.pointOrder(G);
  if (needPrimeOrder && !isPrime(BigInt(n))) {
    throw new EccError(`ord(${nm}) = ${n} tub son emas. Imzo algoritmlarida ${nn} = ord(${nm}) tub bo‘lishi shart (${nn} bo‘yicha teskari element olinadi). #E = ${c.curveOrder()}; boshqa G yoki egri chiziq tanlang (masalan a=1, b=3, p=31, G=(1,6): n = 41).`);
  }
  if (n < 5) throw new EccError(`ord(${nm}) = ${n} juda kichik — boshqa ${nm} tanlang`);
  const steps: Step[] = [
    paramsStep(c),
    { title: `${nm} nuqta egri chiziqda yotadimi`, visuals: [gCheck, ...warn.map((t): Visual => ({ kind: 'note', tone: 'warn', text: t }))] },
    orderStep(c, [G]),
    periodStep(c, G, nm),
  ];
  if (needPrimeOrder) steps.push({ title: `${nn} = ord(${nm}) = ${n} tub sonmi`, visuals: [{ kind: 'note', tone: 'ok', text: `${nn} = ${n} — tub son ✓. Barcha imzo hisoblari mod ${nn} bajariladi, 1 … n−1 oralig‘idagi har bir sonning teskarisi mavjud.` }] });
  return { c, G, n, steps };
}

function rangeCheck(x: number, n: number, name: string) {
  if (!Number.isInteger(x) || x < 1 || x >= n) throw new EccError(`${name} = ${x}: 1 ≤ ${name} ≤ n − 1 = ${n - 1} oralig‘ida bo‘lishi kerak`);
}

/* ======================= Nuqta ↔ belgi jadvali ======================= */

export interface MapEntry { ch: string; idx: number; k?: number; P: [number, number] }
const showCh = (ch: string) => (ch === ' ' ? '␣ (probel)' : ch);

function parseAlphabet(s: string): string[] {
  const chars = Array.from(s.replace(/␣/g, ' '));
  if (chars.length < 2) throw new EccError('Alifbo kamida 2 ta belgidan iborat bo‘lsin');
  const seen = new Set<string>();
  for (const ch of chars) {
    if (seen.has(ch)) throw new EccError(`Alifboda “${showCh(ch)}” belgisi takrorlangan — har bir belgi bitta nuqtaga mos kelishi kerak`);
    seen.add(ch);
  }
  return chars;
}

/** Belgilarni nuqtalarga akslantirish: kG — i-belgi → (i+1)·G;  list — x bo'yicha tartiblangan nuqtalar */
export function buildMap(c: Curve, G: Pt, alphabet: string[], mode: string): MapEntry[] {
  if (mode === 'list') {
    const pts = c.points();
    if (alphabet.length > pts.length) throw new EccError(`Egri chiziqda O dan tashqari ${pts.length} ta nuqta bor, alifbo esa ${alphabet.length} belgi. Kattaroq p tanlang yoki alifboni qisqartiring.`);
    return alphabet.map((ch, i) => ({ ch, idx: i, P: pts[i] }));
  }
  const n = c.pointOrder(G);
  if (alphabet.length >= n) throw new EccError(`ord(G) = ${n}: k·G usulida k = 1 … ${n - 1} — ko‘pi bilan ${n - 1} ta turli nuqta. Alifbo ${alphabet.length} belgi. Kattaroq tartibli G tanlang.`);
  const out: MapEntry[] = [];
  let R: Pt = null;
  alphabet.forEach((ch, i) => { R = c.pointAdd(R, G); out.push({ ch, idx: i, k: i + 1, P: R as [number, number] }); });
  return out;
}

function mapTable(map: MapEntry[], mode: string, hlChars: string[] = []): Visual {
  const rows = map.map((e) => [e.idx, showCh(e.ch), mode === 'list' ? '—' : `${e.k}·G`, show(e.P)]);
  const hl = map.map((e, i) => (hlChars.includes(e.ch) ? i : -1)).filter((i) => i >= 0);
  return { kind: 'table', caption: mode === 'list' ? 'Belgi → nuqta (nuqtalar x, keyin y bo‘yicha tartiblangan)' : 'Belgi → nuqta: i-belgi ↦ (i+1)·G', headers: ['i', 'Belgi', 'k', 'Nuqta Pₘ'], rows, hlRows: hl };
}

function textToPoints(text: string, map: MapEntry[]): MapEntry[] {
  const byCh = new Map(map.map((e) => [e.ch, e]));
  const up = Array.from(text).map((ch) => (byCh.has(ch) ? ch : ch.toUpperCase()));
  const bad = [...new Set(up.filter((ch) => !byCh.has(ch)))];
  if (bad.length) throw new EccError(`Xabardagi ${bad.map((b) => `“${showCh(b)}”`).join(', ')} belgi(lar)i alifboda yo‘q — alifboga qo‘shing yoki xabarni o‘zgartiring`);
  if (!up.length) throw new EccError('Xabar bo‘sh');
  return up.map((ch) => byCh.get(ch)!);
}

const pointKey = (P: Pt) => show(P);

const mapFields = [
  { key: 'alphabet', label: 'Alifbo', type: 'text' as const, default: DEF_ALPHABET, hint: 'oxiridagi probel ham belgi; ␣ ham probel deb olinadi' },
  { key: 'mode', label: 'Akslantirish usuli', type: 'select' as const, default: 'kG', options: [
    { value: 'kG', label: 'i-belgi → (i+1)·G' }, { value: 'list', label: 'Nuqtalar ro‘yxati (x bo‘yicha) tartibida' },
  ] },
];

export const eccMap: AlgorithmDef = {
  id: 'ecc-map', topic: 9, name: 'Nuqtalarni belgilarga akslantiruvchi jadval',
  short: 'Alifbo belgisi ↔ egri chiziq nuqtasi, matn → nuqtalar → matn',
  theory: [
    'Elliptik egri chiziqli shifrlashda (EC ElGamal) ochiq matn son emas, balki egri chiziq nuqtasi bo‘lishi kerak. Shuning uchun har bir belgiga oldindan kelishilgan nuqta mos qo‘yiladi.',
    'Usul 1: i-belgi ↦ (i+1)·G. Barcha nuqtalar turli bo‘lishi uchun alifbo uzunligi ord(G) dan kichik bo‘lishi kerak.',
    'Usul 2: egri chiziqning barcha nuqtalari x (keyin y) bo‘yicha tartiblanadi va belgilar ketma-ket mos qo‘yiladi.',
    'Jadval o‘zaro bir qiymatli bo‘lgani uchun deshifrlashda nuqtadan belgini aniq tiklash mumkin.',
  ],
  formulas: ['belgi ↦ Pₘ = (i+1)·G', 'Pₘ ↦ belgi (teskari jadval)'],
  fields: [...curveFields.map((f) => ({ ...f, default: DEF[f.key as 'a' | 'b' | 'p'] })), { key: 'G', label: 'G (generator)', type: 'text', default: DEF.G }, ...mapFields, { key: 'm', label: 'Matn', type: 'text', default: 'SALOM' }],
  examples: [
    { label: 'p=31, G=(1,6), k·G', values: { a: '1', b: '3', p: '31', G: '(1, 6)', alphabet: DEF_ALPHABET, mode: 'kG', m: 'SALOM' } },
    { label: 'p=31, ro‘yxat bo‘yicha', values: { a: '1', b: '3', p: '31', G: '(1, 6)', alphabet: DEF_ALPHABET, mode: 'list', m: 'KRIPTO' } },
    { label: 'p=67, a=1, b=8', values: { a: '1', b: '8', p: '67', G: '(1, 12)', alphabet: DEF_ALPHABET, mode: 'kG', m: 'ECC' } },
  ],
  run(v) {
    const c = new Curve(int(v, 'a'), int(v, 'b'), int(v, 'p'));
    const warn: string[] = [];
    const G = parsePoint(val(v, 'G'), 'G', c, warn);
    if (!G) throw new EccError('G = O bo‘lishi mumkin emas');
    const mode = val(v, 'mode') || 'kG';
    const alphabet = parseAlphabet(v['alphabet'] ?? DEF_ALPHABET);
    const steps: Step[] = [paramsStep(c), { title: 'G egri chiziqda yotadimi', visuals: [checkPoint(c, G, 'G'), ...warn.map((t): Visual => ({ kind: 'note', tone: 'warn', text: t }))] }, orderStep(c, [G])];
    const map = buildMap(c, G, alphabet, mode);
    const msg = textToPoints(v['m'] ?? '', map);
    steps.push({ title: 'Akslantirish jadvali', text: `Alifbo: ${alphabet.length} belgi, ord(G) = ${c.pointOrder(G)}, #E = ${c.curveOrder()}`, visuals: [mapTable(map, mode, msg.map((e) => e.ch)), { kind: 'note', tone: 'ok', text: `${map.length} ta belgi ${new Set(map.map((e) => pointKey(e.P))).size} ta turli nuqtaga akslantirildi — jadval o‘zaro bir qiymatli ✓` }] });
    steps.push({ title: 'Matn → nuqtalar', visuals: [
      { kind: 'table', headers: ['#', 'Belgi', 'i', 'Nuqta Pₘ'], rows: msg.map((e, j) => [j + 1, showCh(e.ch), e.idx, show(e.P)]) },
      { kind: 'plot', p: c.p, points: c.points(), hl: msg.map((e) => e.P) },
    ] });
    const back = new Map(map.map((e) => [pointKey(e.P), e.ch]));
    const restored = msg.map((e) => back.get(pointKey(e.P))).join('');
    steps.push({ title: 'Nuqtalar → matn (teskari jadval)', visuals: [
      { kind: 'table', headers: ['Nuqta', 'Belgi'], rows: msg.map((e) => [show(e.P), showCh(back.get(pointKey(e.P))!)]) },
      { kind: 'note', tone: 'ok', text: `Tiklangan matn: “${restored}” ✓` },
    ] });
    return { steps, output: [{ label: 'Nuqtalar', value: msg.map((e) => show(e.P)).join(' ') }, { label: 'Tiklangan matn', value: restored }] };
  },
};

/* ======================= Xesh qadamlari ======================= */

function shaHash(v: Record<string, string>, n: number): { e: number; steps: Step[] } {
  const N = n.toString(2).length;
  if (val(v, 'h')) {
    const h = BigInt(val(v, 'h'));
    const e = Number(h % BigInt(n));
    return { e, steps: [{ title: 'Xabar xeshi e', text: 'Xesh qiymati son sifatida kiritilgan.', visuals: [{ kind: 'formula', text: `H(M) = ${h},  e = H(M) mod n = ${h} mod ${n} = ${e}` }] }] };
  }
  const m = v['m'] ?? '';
  if (!m) throw new EccError('Xabar M yoki H(M) qiymatini kiriting');
  const digest = sha256(utf8(m));
  const full = BigInt('0x' + digest);
  const z = N < 256 ? full >> BigInt(256 - N) : full;
  const bits = full.toString(2).padStart(256, '0').slice(0, N);
  const e = Number(z % BigInt(n));
  return { e, steps: [
    { title: 'SHA-256(M)', text: 'ECDSA da imzo xabarga emas, uning xeshiga qo‘yiladi.', visuals: [{ kind: 'kv', items: [{ label: 'M', value: m }, { label: 'SHA-256(M)', value: digest, hl: true }] }] },
    { title: 'Xeshni n uzunligiga qisqartirish', text: `FIPS 186 / SEC 1: xeshning chap tomonidagi Lₙ ta biti olinadi, n = ${n} — ${N} bit.`, visuals: [
      { kind: 'formula', text: `z = chap ${N} bit = ${bits}₂ = ${z}` },
      { kind: 'formula', text: `e = z mod n = ${z} mod ${n} = ${e}` },
    ] },
  ] };
}

function streebogHash(v: Record<string, string>, q: number): { e: number; steps: Step[] } {
  let alpha: bigint, visuals: Visual[];
  if (val(v, 'h')) {
    alpha = BigInt(val(v, 'h'));
    visuals = [{ kind: 'formula', text: `α = H(M) = ${alpha} (son sifatida kiritilgan)` }];
  } else {
    const m = v['m'] ?? '';
    if (!m) throw new EccError('Xabar M yoki H(M) qiymatini kiriting');
    const digest = streebog(utf8(m), 256);
    alpha = BigInt('0x' + digest);
    visuals = [
      { kind: 'kv', items: [{ label: 'M', value: m }, { label: 'h = Streebog-256(M) — GOST R 34.11-2018', value: digest, hl: true }] },
      { kind: 'formula', text: `α — h vektorining butun son ko‘rinishi: α = 0x${digest.slice(0, 16)}… (${alpha.toString().length} xonali son)` },
    ];
  }
  let e = Number(alpha % BigInt(q));
  visuals.push({ kind: 'formula', text: `e = α mod q = ${alpha.toString().length > 30 ? alpha.toString().slice(0, 12) + '…' : alpha} mod ${q} = ${e}` });
  if (e === 0) { e = 1; visuals.push({ kind: 'note', tone: 'warn', text: 'e = 0 chiqdi — standart bo‘yicha e = 1 olinadi' }); }
  return { e, steps: [{ title: 'GOST R 34.11-2018 (Streebog) xeshi', text: 'GOST R 34.10 da imzo xabarning Streebog xeshiga qo‘yiladi.', visuals }] };
}

const signFields = (hashName: string, dKey: string) => [
  ...curveFields.map((f) => ({ ...f, default: DEF[f.key as 'a' | 'b' | 'p'] })),
  { key: 'G', label: 'G / P (tayanch nuqta)', type: 'text' as const, default: DEF.G, hint: 'ord(G) = n tub bo‘lishi kerak' },
  { key: 'd', label: `${dKey} (maxfiy kalit)`, type: 'number' as const, default: '7', hint: '1 ≤ d ≤ n−1' },
  { key: 'k', label: 'k (bir martalik tasodifiy son)', type: 'number' as const, default: '10', hint: '1 ≤ k ≤ n−1' },
  { key: 'm', label: 'Xabar M', type: 'text' as const, default: 'SALOM' },
  { key: 'h', label: 'H(M) — son (ixtiyoriy)', type: 'number' as const, default: '', hint: `Bo‘sh bo‘lsa ${hashName}(M) hisoblanadi` },
];

/* ======================= ECDSA ======================= */

const PH_SIGN = ['1. Parametrlar', '2. Kalitlar', '3. Xesh', '4. Imzo', '5. Tekshirish', '6. Xavfsizlik'];

export const ecdsa: AlgorithmDef = {
  id: 'ecdsa', topic: 9, name: 'ECDSA — elliptik egri chiziqli raqamli imzo',
  short: 'R = k·G, r = x_R mod n, s = k⁻¹(e + d·r) mod n; tekshirish: u₁G + u₂Q',
  theory: [
    'ECDSA (ANSI X9.62, FIPS 186-5, SEC 1) — DSA ning elliptik egri chiziqdagi varianti. Darajaga oshirish o‘rniga nuqtani skalyarga ko‘paytirish ishlatiladi.',
    'Domen parametrlari: E: y² = x³ + ax + b (mod p), tayanch nuqta G va uning tub tartibi n = ord(G). Maxfiy kalit d ∈ [1, n−1], ochiq kalit Q = d·G.',
    'Imzo: e = H(M) (chap Lₙ bit), tasodifiy k, R = k·G, r = x_R mod n, s = k⁻¹(e + d·r) mod n. Imzo — (r, s) juftligi.',
    'Tekshirish: w = s⁻¹ mod n, u₁ = e·w, u₂ = r·w (mod n), X = u₁·G + u₂·Q; v = x_X mod n. v = r bo‘lsa imzo haqiqiy.',
    'k har bir imzo uchun yangi va maxfiy bo‘lishi shart: k oshkor bo‘lsa yoki takrorlansa d tiklanadi (Sony PS3 hodisasi).',
  ],
  formulas: ['Q = d·G', 'R = k·G,  r = x_R mod n', 's = k⁻¹·(e + d·r) mod n', 'w = s⁻¹,  u₁ = e·w,  u₂ = r·w (mod n)', 'X = u₁·G + u₂·Q,  v = x_X mod n = r'],
  fields: signFields('SHA-256', 'd'),
  examples: [
    { label: 'p=31, G=(1,6), n=41', values: { a: '1', b: '3', p: '31', G: '(1, 6)', d: '7', k: '10', m: 'SALOM', h: '' } },
    { label: 'p=17, G=(5,1), n=19, H=26', values: { a: '2', b: '2', p: '17', G: '(5, 1)', d: '7', k: '10', m: '', h: '26' } },
    { label: 'p=67, G=(1,12), n=79', values: { a: '1', b: '8', p: '67', G: '(1, 12)', d: '25', k: '33', m: 'Kriptografiya', h: '' } },
  ],
  run(v) {
    const { c, G, n, steps: par } = setup(v);
    const d = int(v, 'd'), k = int(v, 'k');
    rangeCheck(d, n, 'd'); rangeCheck(k, n, 'k');
    const steps: Step[] = flowStep(PH_SIGN, 1, 'Parametrlar', par);

    const Qm = mulVis(c, d, G, 'G', 'Q');
    const Q = Qm.R;
    steps.push(...flowStep(PH_SIGN, 2, 'Kalitlar', [
      { title: 'Ochiq kalit Q = d·G', text: `Maxfiy kalit d = ${d} (1 ≤ d ≤ ${n - 1} ✓).`, visuals: Qm.visuals },
      { title: 'Kalitlar juftligi', visuals: [{ kind: 'kv', items: [{ label: 'Maxfiy kalit d', value: `${d}`, hl: true }, { label: 'Ochiq kalit Q', value: show(Q), hl: true }] }, { kind: 'note', tone: 'info', text: 'Q va G dan d ni topish — ECDLP muammosi; real o‘lchamlarda (256 bit) amalda imkonsiz.' }] },
    ]));

    const h = shaHash(v, n);
    const e = h.e;
    steps.push(...flowStep(PH_SIGN, 3, 'Xesh', h.steps));

    const Rm = mulVis(c, k, G, 'G', 'R');
    const R = Rm.R;
    if (!R) throw new EccError('R = O chiqdi — boshqa k tanlang');
    const r = modn(R[0], n);
    if (r === 0) throw new EccError('r = 0 chiqdi — standart bo‘yicha boshqa k tanlanadi');
    const ki = invVis(k, n, 'k⁻¹');
    const dr = d * r, sum = e + dr, s = modn(ki.inv * sum, n);
    if (s === 0) throw new EccError('s = 0 chiqdi — standart bo‘yicha boshqa k tanlanadi');
    steps.push(...flowStep(PH_SIGN, 4, 'Imzo', [
      { title: 'R = k·G', text: `Bir martalik k = ${k} (1 ≤ k ≤ ${n - 1} ✓).`, visuals: Rm.visuals },
      { title: 'r = x_R mod n', visuals: [{ kind: 'formula', text: `r = x_R mod n = ${R[0]} mod ${n} = ${r}` }, { kind: 'note', tone: 'ok', text: `r = ${r} ≠ 0 ✓` }] },
      { title: 'k⁻¹ mod n', visuals: ki.visuals },
      { title: 's ni hisoblash', visuals: [
        { kind: 'table', headers: ['Amal', 'Hisoblash', 'Natija'], rows: [
          ['d·r', `${d} · ${r}`, dr], ['e + d·r', `${e} + ${dr}`, sum], ['k⁻¹·(e + d·r)', `${ki.inv} · ${sum}`, ki.inv * sum], ['s = … mod n', `${ki.inv * sum} mod ${n}`, s],
        ], hlRows: [3] },
        { kind: 'note', tone: 'ok', text: `Imzo (r, s) = (${r}, ${s})` },
      ] },
    ]));

    const wi = invVis(s, n, 'w = s⁻¹');
    const w = wi.inv, u1 = modn(e * w, n), u2 = modn(r * w, n);
    const A = mulVis(c, u1 || n, G, 'G', 'u₁·G');
    const B = mulVis(c, u2, Q, 'Q', 'u₂·Q');
    const X = addVis(c, u1 === 0 ? null : A.R, B.R, 'X = u₁·G + u₂·Q');
    const vv = X.R ? modn(X.R[0], n) : -1;
    const ok = vv === r;
    steps.push(...flowStep(PH_SIGN, 5, 'Tekshirish', [
      { title: 'Imzo oralig‘i', text: 'Tekshiruvchida faqat domen parametrlari, ochiq kalit Q, xabar M va (r, s) bor.', visuals: [{ kind: 'formula', text: `1 ≤ r = ${r} ≤ ${n - 1} ✓,   1 ≤ s = ${s} ≤ ${n - 1} ✓` }] },
      { title: 'w = s⁻¹ mod n', visuals: wi.visuals },
      { title: 'u₁ va u₂', visuals: [{ kind: 'table', headers: ['Qiymat', 'Hisoblash', 'Natija'], rows: [['u₁ = e·w mod n', `${e} · ${w} mod ${n}`, u1], ['u₂ = r·w mod n', `${r} · ${w} mod ${n}`, u2]] }] },
      { title: 'u₁·G', visuals: u1 === 0 ? [{ kind: 'formula', text: 'u₁ = 0 ⇒ u₁·G = O' }] : A.visuals },
      { title: 'u₂·Q', visuals: B.visuals },
      { title: 'X = u₁·G + u₂·Q', visuals: X.visuals },
      { title: 'Xulosa: v = r ?', visuals: [
        { kind: 'formula', text: `v = x_X mod n = ${X.R ? X.R[0] : '—'} mod ${n} = ${vv},   r = ${r}` },
        ok ? { kind: 'note', tone: 'ok', text: 'v = r — imzo HAQIQIY ✓' } : { kind: 'note', tone: 'warn', text: 'v ≠ r — imzo noto‘g‘ri' },
        { kind: 'formula', text: 'Isbot: u₁G + u₂Q = (e·w + r·w·d)·G = w·(e + d·r)·G = s⁻¹·s·k·G = k·G = R' },
      ] },
    ]));

    // Xavfsizlik
    const e2 = modn(e + 1, n), u1b = modn(e2 * w, n);
    const X2 = c.add(u1b ? c.mul(u1b, G) : null, c.mul(u2, Q));
    const v2 = X2 ? modn(X2[0], n) : -1;
    const ri = modInverse(r, n).inv, dRec = modn(ri * modn(s * k - e, n), n);
    steps.push(...flowStep(PH_SIGN, 6, 'Xavfsizlik', [
      { title: 'Xabar o‘zgartirilsa', text: `Xuddi shu (r, s) ni xeshi e′ = e + 1 = ${e2} bo‘lgan xabarga qo‘llaymiz.`, visuals: [
        { kind: 'formula', text: `u₁′ = e′·w mod n = ${u1b},  X′ = u₁′·G + u₂·Q = ${show(X2)},  v′ = ${v2}` },
        v2 === r ? { kind: 'note', tone: 'warn', text: `Tasodifan v′ = r: n = ${n} juda kichik. Real n (256 bit) da bu amalda yuz bermaydi.` } : { kind: 'note', tone: 'ok', text: `v′ = ${v2} ≠ r = ${r} — o‘zgartirilgan xabar rad etildi ✓` },
      ] },
      { title: 'k oshkor bo‘lsa', visuals: [
        { kind: 'formula', text: `d = r⁻¹·(s·k − e) mod n = ${ri}·(${s}·${k} − ${e}) mod ${n} = ${dRec}` },
        { kind: 'note', tone: 'warn', text: `Tiklangan d = ${dRec} — haqiqiy maxfiy kalit. k har imzoda yangi va maxfiy bo‘lishi shart.` },
      ] },
    ]));
    return { steps, output: [
      { label: 'n = ord(G)', value: `${n}` }, { label: 'Ochiq kalit Q', value: show(Q) }, { label: 'e', value: `${e}` },
      { label: 'R = k·G', value: show(R) }, { label: '(r, s)', value: `(${r}, ${s})` }, { label: 'X = u₁G + u₂Q', value: show(X.R) },
      { label: 'Tekshiruv', value: ok ? 'to‘g‘ri' : 'noto‘g‘ri' },
    ] };
  },
};

/* ======================= GOST R 34.10-2018 ======================= */

export const gost2018: AlgorithmDef = {
  id: 'gost-3410-2018', topic: 9, name: 'GOST R 34.10-2018 — elliptik egri chiziqli ERI (Streebog bilan)',
  short: 'C = k·P, r = x_C mod q, s = (r·d + k·e) mod q; xesh — GOST R 34.11-2018',
  theory: [
    'GOST 34.10-2018 (davlatlararo standart, GOST R 34.10-2012 bilan bir xil) — elliptik egri chiziq asosidagi raqamli imzo. Xesh funksiyasi — GOST 34.11-2018 “Streebog” (256 yoki 512 bit).',
    'Parametrlar: E: y² = x³ + ax + b (mod p), tartibi q (tub) bo‘lgan P nuqta. Maxfiy kalit d ∈ (0, q), ochiq kalit Q = d·P.',
    'Imzo: h = H(M), α — h ning soni, e = α mod q (e = 0 bo‘lsa e = 1). Tasodifiy k: C = k·P, r = x_C mod q, s = (r·d + k·e) mod q. Imzo — r ‖ s.',
    'Tekshirish: 0 < r, s < q; v = e⁻¹ mod q, z₁ = s·v, z₂ = −r·v (mod q), C = z₁·P + z₂·Q, R = x_C mod q. R = r bo‘lsa imzo haqiqiy.',
    'ECDSA dan farqi: imzolashda k⁻¹ hisoblanmaydi (s = r·d + k·e), tekshirishda esa s emas, e ning teskarisi olinadi.',
  ],
  formulas: ['Q = d·P', 'e = α mod q  (e = 0 ⇒ e = 1)', 'C = k·P,  r = x_C mod q', 's = (r·d + k·e) mod q', 'v = e⁻¹,  z₁ = s·v,  z₂ = −r·v (mod q)', 'C = z₁·P + z₂·Q,  R = x_C mod q = r'],
  fields: signFields('Streebog-256', 'd'),
  examples: [
    { label: 'p=31, P=(1,6), q=41', values: { a: '1', b: '3', p: '31', G: '(1, 6)', d: '7', k: '10', m: 'SALOM', h: '' } },
    { label: 'p=17, P=(5,1), q=19, α=26', values: { a: '2', b: '2', p: '17', G: '(5, 1)', d: '7', k: '10', m: '', h: '26' } },
    { label: 'p=67, P=(1,12), q=79', values: { a: '1', b: '8', p: '67', G: '(1, 12)', d: '25', k: '33', m: 'Kriptografiya', h: '' } },
  ],
  run(v) {
    const { c, G: P, n: q, steps: par } = setup(v, 'G', true, 'P', 'q');
    const d = int(v, 'd'), k = int(v, 'k');
    rangeCheck(d, q, 'd'); rangeCheck(k, q, 'k');
    const steps: Step[] = flowStep(PH_SIGN, 1, 'Parametrlar', par);

    const Qm = mulVis(c, d, P, 'P', 'Q');
    const Q = Qm.R;
    steps.push(...flowStep(PH_SIGN, 2, 'Kalitlar', [
      { title: 'Ochiq kalit Q = d·P', text: `Maxfiy kalit d = ${d} (0 < d < q = ${q} ✓).`, visuals: Qm.visuals },
      { title: 'Kalitlar juftligi', visuals: [{ kind: 'kv', items: [{ label: 'Maxfiy kalit d', value: `${d}`, hl: true }, { label: 'Ochiq kalit Q', value: show(Q), hl: true }] }] },
    ]));

    const h = streebogHash(v, q);
    const e = h.e;
    steps.push(...flowStep(PH_SIGN, 3, 'Xesh', h.steps));

    const Cm = mulVis(c, k, P, 'P', 'C');
    const C = Cm.R;
    if (!C) throw new EccError('C = O chiqdi — boshqa k tanlang');
    const r = modn(C[0], q);
    if (r === 0) throw new EccError('r = 0 — standart bo‘yicha boshqa k tanlanadi');
    const rd = r * d, ke = k * e, s = modn(rd + ke, q);
    if (s === 0) throw new EccError('s = 0 — standart bo‘yicha boshqa k tanlanadi');
    steps.push(...flowStep(PH_SIGN, 4, 'Imzo', [
      { title: 'C = k·P', text: `Tasodifiy k = ${k} (0 < k < q ✓).`, visuals: Cm.visuals },
      { title: 'r = x_C mod q', visuals: [{ kind: 'formula', text: `r = x_C mod q = ${C[0]} mod ${q} = ${r}` }, { kind: 'note', tone: 'ok', text: `r = ${r} ≠ 0 ✓` }] },
      { title: 's = (r·d + k·e) mod q', visuals: [
        { kind: 'table', headers: ['Amal', 'Hisoblash', 'Natija'], rows: [['r·d', `${r} · ${d}`, rd], ['k·e', `${k} · ${e}`, ke], ['r·d + k·e', `${rd} + ${ke}`, rd + ke], ['s = … mod q', `${rd + ke} mod ${q}`, s]], hlRows: [3] },
        { kind: 'note', tone: 'ok', text: `Imzo ζ = (r, s) = (${r}, ${s})` },
      ] },
    ]));

    const vi = invVis(e, q, 'v = e⁻¹');
    const vv = vi.inv, z1 = modn(s * vv, q), z2 = modn(-r * vv, q);
    const A = mulVis(c, z1 || q, P, 'P', 'z₁·P');
    const B = mulVis(c, z2 || q, Q, 'Q', 'z₂·Q');
    const X = addVis(c, z1 ? A.R : null, z2 ? B.R : null, 'C′ = z₁·P + z₂·Q');
    const R = X.R ? modn(X.R[0], q) : -1;
    const ok = R === r;
    steps.push(...flowStep(PH_SIGN, 5, 'Tekshirish', [
      { title: 'Imzo oralig‘i va xesh', visuals: [{ kind: 'formula', text: `0 < r = ${r} < q ✓,  0 < s = ${s} < q ✓,  e = ${e} (yuqoridagidek qayta hisoblanadi)` }] },
      { title: 'v = e⁻¹ mod q', visuals: vi.visuals },
      { title: 'z₁ va z₂', visuals: [{ kind: 'table', headers: ['Qiymat', 'Hisoblash', 'Natija'], rows: [['z₁ = s·v mod q', `${s} · ${vv} mod ${q}`, z1], ['z₂ = −r·v mod q', `−${r} · ${vv} mod ${q}`, z2]] }] },
      { title: 'z₁·P', visuals: A.visuals },
      { title: 'z₂·Q', visuals: B.visuals },
      { title: 'C′ = z₁·P + z₂·Q', visuals: X.visuals },
      { title: 'Xulosa: R = r ?', visuals: [
        { kind: 'formula', text: `R = x_C′ mod q = ${X.R ? X.R[0] : '—'} mod ${q} = ${R},   r = ${r}` },
        ok ? { kind: 'note', tone: 'ok', text: 'R = r — imzo HAQIQIY ✓' } : { kind: 'note', tone: 'warn', text: 'R ≠ r — imzo noto‘g‘ri' },
        { kind: 'formula', text: 'Isbot: z₁P + z₂Q = e⁻¹(s − r·d)·P = e⁻¹·k·e·P = k·P = C' },
      ] },
    ]));

    const ri = modInverse(r, q).inv, dRec = modn(ri * modn(s - k * e, q), q);
    steps.push(...flowStep(PH_SIGN, 6, 'Xavfsizlik', [
      { title: 'ECDSA bilan taqqoslash', visuals: [{ kind: 'table', headers: ['', 'ECDSA', 'GOST 34.10-2018'], rows: [
        ['Xesh', 'SHA-2 (SHA-256)', 'Streebog (GOST 34.11-2018)'], ['Imzo s', 's = k⁻¹(e + d·r)', 's = r·d + k·e'],
        ['Imzolashda teskari', 'k⁻¹', 'kerak emas'], ['Tekshirishda teskari', 's⁻¹', 'e⁻¹'], ['Tekshiruv nuqtasi', 'e·s⁻¹·G + r·s⁻¹·Q', 's·e⁻¹·P − r·e⁻¹·Q'],
      ] }] },
      { title: 'k oshkor bo‘lsa', visuals: [
        { kind: 'formula', text: `d = r⁻¹·(s − k·e) mod q = ${ri}·(${s} − ${k}·${e}) mod ${q} = ${dRec}` },
        { kind: 'note', tone: 'warn', text: `Tiklangan d = ${dRec} — maxfiy kalit. k maxfiy va har safar yangi bo‘lishi shart.` },
      ] },
    ]));
    return { steps, output: [
      { label: 'q = ord(P)', value: `${q}` }, { label: 'Ochiq kalit Q', value: show(Q) }, { label: 'e', value: `${e}` },
      { label: 'C = k·P', value: show(C) }, { label: '(r, s)', value: `(${r}, ${s})` }, { label: 'C′ = z₁P + z₂Q', value: show(X.R) },
      { label: 'Tekshiruv', value: ok ? 'to‘g‘ri' : 'noto‘g‘ri' },
    ] };
  },
};

/* ======================= EC ElGamal ======================= */

const PH_EG = ['1. Parametrlar', '2. Jadval', '3. Kalitlar', '4. Shifrlash', '5. Deshifrlash'];

export const ecElgamal: AlgorithmDef = {
  id: 'ec-elgamal', topic: 9, name: 'EC ElGamal — elliptik egri chiziqda shifrlash',
  short: 'Pₘ → (C₁ = k·G, C₂ = Pₘ + k·P_B);  Pₘ = C₂ − n_B·C₁; belgi ↔ nuqta jadvali bilan',
  theory: [
    'EC ElGamal — ElGamal shifrining elliptik egri chiziqdagi varianti. Ochiq matn avval nuqtalarga akslantiriladi (belgi → nuqta jadvali).',
    'Qabul qiluvchi (B): maxfiy kalit n_B, ochiq kalit P_B = n_B·G.',
    'Shifrlash: har bir Pₘ uchun tasodifiy k: C₁ = k·G, C₂ = Pₘ + k·P_B. Shifrmatn — nuqtalar juftligi (C₁, C₂).',
    'Deshifrlash: n_B·C₁ = n_B·k·G = k·P_B, shuning uchun Pₘ = C₂ − n_B·C₁. Ayirish — qarama-qarshi nuqtani qo‘shish: −(x, y) = (x, −y).',
    'Bir xil belgi turli k bilan turlicha shifrlanadi — shifrmatn ehtimoliy (probabilistic).',
  ],
  formulas: ['P_B = n_B·G', 'C₁ = k·G', 'C₂ = Pₘ + k·P_B', 'Pₘ = C₂ − n_B·C₁'],
  fields: [
    ...curveFields.map((f) => ({ ...f, default: DEF[f.key as 'a' | 'b' | 'p'] })),
    { key: 'G', label: 'G (generator)', type: 'text', default: DEF.G },
    ...mapFields,
    { key: 'nb', label: 'n_B (qabul qiluvchi maxfiy kaliti)', type: 'number', default: '9' },
    { key: 'ks', label: 'k qiymatlari (vergul bilan)', type: 'text', default: '5, 12, 7, 20, 3', hint: 'har bir belgi uchun navbatdagi k; tugasa boshidan takrorlanadi' },
    { key: 'm', label: 'Ochiq matn', type: 'text', default: 'SALOM' },
  ],
  examples: [
    { label: 'SALOM, p=31', values: { a: '1', b: '3', p: '31', G: '(1, 6)', alphabet: DEF_ALPHABET, mode: 'kG', nb: '9', ks: '5, 12, 7, 20, 3', m: 'SALOM' } },
    { label: 'KRIPTO, ro‘yxat usuli', values: { a: '1', b: '3', p: '31', G: '(1, 6)', alphabet: DEF_ALPHABET, mode: 'list', nb: '13', ks: '4, 11, 17, 6, 29, 8', m: 'KRIPTO' } },
    { label: 'p=67, ECC 2026', values: { a: '1', b: '8', p: '67', G: '(1, 12)', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', mode: 'kG', nb: '21', ks: '7, 15, 40', m: 'ECC 2026' } },
  ],
  run(v) {
    const { c, G, n, steps: par } = setup(v, 'G', false);
    const mode = val(v, 'mode') || 'kG';
    const alphabet = parseAlphabet(v['alphabet'] ?? DEF_ALPHABET);
    const steps: Step[] = flowStep(PH_EG, 1, 'Parametrlar', par);

    const map = buildMap(c, G, alphabet, mode);
    const msg = textToPoints(v['m'] ?? '', map);
    steps.push(...flowStep(PH_EG, 2, 'Jadval', [
      { title: 'Nuqtalarni belgilarga akslantiruvchi jadval', text: `Alifbo ${alphabet.length} belgi, ord(G) = ${n}.`, visuals: [mapTable(map, mode, msg.map((e) => e.ch)), { kind: 'note', tone: 'ok', text: 'Har bir belgiga alohida nuqta mos — jadval o‘zaro bir qiymatli ✓' }] },
      { title: 'Ochiq matn → nuqtalar', visuals: [{ kind: 'table', headers: ['#', 'Belgi', 'Pₘ'], rows: msg.map((e, j) => [j + 1, showCh(e.ch), show(e.P)]) }] },
    ]));

    const nb = int(v, 'nb');
    rangeCheck(nb, n, 'n_B');
    const PBm = mulVis(c, nb, G, 'G', 'P_B');
    const PB = PBm.R;
    steps.push(...flowStep(PH_EG, 3, 'Kalitlar', [{ title: 'P_B = n_B·G', visuals: [...PBm.visuals, { kind: 'kv', items: [{ label: 'Maxfiy n_B', value: `${nb}`, hl: true }, { label: 'Ochiq P_B', value: show(PB), hl: true }] }] }]));

    const ks = val(v, 'ks').split(/[,;\s]+/).filter(Boolean).map((x) => {
      if (!/^\d+$/.test(x)) throw new EccError(`k qiymatlari: “${x}” — musbat butun son emas`);
      const k = Number(x); rangeCheck(k, n, 'k'); return k;
    });
    if (!ks.length) throw new EccError('Kamida bitta k qiymatini kiriting');

    const enc = msg.map((e, j) => {
      const k = ks[j % ks.length];
      const C1 = c.mul(k, G), kPB = c.mul(k, PB);
      const C2 = c.add(e.P, kPB);
      return { e, k, C1, kPB, C2 };
    });
    const f = enc[0];
    const c1m = mulVis(c, f.k, G, 'G', 'C₁');
    const kpm = mulVis(c, f.k, PB, 'P_B', 'k·P_B');
    const c2a = addVis(c, f.e.P, f.kPB, 'C₂ = Pₘ + k·P_B');
    steps.push(...flowStep(PH_EG, 4, 'Shifrlash', [
      { title: `1-belgi “${showCh(f.e.ch)}”: C₁ = k·G`, text: `Pₘ = ${show(f.e.P)}, k = ${f.k}`, visuals: c1m.visuals },
      { title: `1-belgi: k·P_B`, visuals: kpm.visuals },
      { title: `1-belgi: C₂ = Pₘ + k·P_B`, visuals: c2a.visuals },
      { title: 'Barcha belgilar uchun shifrlash jadvali', visuals: [
        { kind: 'table', headers: ['#', 'Belgi', 'Pₘ', 'k', 'C₁ = k·G', 'k·P_B', 'C₂ = Pₘ + k·P_B'], rows: enc.map((x, j) => [j + 1, showCh(x.e.ch), show(x.e.P), x.k, show(x.C1), show(x.kPB), show(x.C2)]) },
        { kind: 'note', tone: 'ok', text: `Shifrmatn: ${enc.map((x) => `{${show(x.C1)}, ${show(x.C2)}}`).join(' ')}` },
      ] },
    ]));

    const back = new Map(map.map((m) => [pointKey(m.P), m.ch]));
    const dec = enc.map((x) => {
      const S = c.mul(nb, x.C1), nS = c.neg(S), Pm = c.add(x.C2, nS);
      const ch = back.get(pointKey(Pm));
      if (ch === undefined) throw new EccError(`Deshifrlangan nuqta ${show(Pm)} jadvalda yo‘q`);
      return { S, nS, Pm, ch };
    });
    const d0 = dec[0];
    const sm = mulVis(c, nb, f.C1, 'C₁', 'n_B·C₁');
    const pa = addVis(c, f.C2, d0.nS, 'Pₘ = C₂ + (−n_B·C₁)');
    const plain = dec.map((x) => x.ch).join('');
    steps.push(...flowStep(PH_EG, 5, 'Deshifrlash', [
      { title: '1-blok: n_B·C₁', text: `C₁ = ${show(f.C1)}, C₂ = ${show(f.C2)}`, visuals: [...sm.visuals, { kind: 'formula', text: `n_B·C₁ = n_B·k·G = k·P_B = ${show(d0.S)} — shifrlashdagi k·P_B bilan bir xil ✓` }] },
      { title: '1-blok: Pₘ = C₂ − n_B·C₁', visuals: [{ kind: 'formula', text: `−n_B·C₁ = −${show(d0.S)} = ${show(d0.nS)}  (y → p − y)` }, ...pa.visuals, { kind: 'note', tone: 'ok', text: `${show(d0.Pm)} → jadvaldan “${showCh(d0.ch)}”` }] },
      { title: 'Barcha bloklar uchun deshifrlash jadvali', visuals: [
        { kind: 'table', headers: ['#', 'C₁', 'C₂', 'n_B·C₁', '−n_B·C₁', 'Pₘ = C₂ − n_B·C₁', 'Belgi'], rows: enc.map((x, j) => [j + 1, show(x.C1), show(x.C2), show(dec[j].S), show(dec[j].nS), show(dec[j].Pm), showCh(dec[j].ch)]) },
        plain === msg.map((e) => e.ch).join('') ? { kind: 'note', tone: 'ok', text: `Deshifrlangan matn: “${plain}” — ochiq matn bilan mos ✓` } : { kind: 'note', tone: 'warn', text: `Deshifrlangan matn mos emas: “${plain}”` },
      ] },
      { title: 'Nuqtalar grafikda', visuals: [{ kind: 'plot', p: c.p, points: c.points(), hl: [G, PB, ...msg.map((e) => e.P), ...enc.map((x) => x.C2)].filter((x): x is [number, number] => !!x) }] },
    ]));
    return { steps, output: [
      { label: 'P_B', value: show(PB) },
      { label: 'Ochiq matn nuqtalari', value: msg.map((e) => show(e.P)).join(' ') },
      { label: 'Shifrmatn (C₁, C₂)', value: enc.map((x) => `{${show(x.C1)}, ${show(x.C2)}}`).join(' ') },
      { label: 'Deshifrlangan matn', value: plain },
    ] };
  },
};

export const T9CRYPTO = [ecdsa, gost2018, ecElgamal, eccMap];
