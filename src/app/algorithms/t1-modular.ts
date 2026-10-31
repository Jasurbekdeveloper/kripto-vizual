import { AlgorithmDef, Step } from '../core/models';
import { big, binParts, egcd, gcd, mod, modPow, sup, val } from '../core/util';

/* ---------------------------------------------------------------
 * 1-MAVZU: Modulli arifmetika va kriptografik hisoblashlar
 * ------------------------------------------------------------- */

function fastPowSteps(a: bigint, e: bigint, n: bigint): { steps: Step[]; result: bigint } {
  const parts = binParts(e);
  const steps: Step[] = [];
  steps.push({
    title: 'Darajani ikkilik ko‘rinishga ajratish',
    text: `${e} sonini 2 ning darajalari yig‘indisi sifatida yozamiz. Faqat “1” bitlarga mos darajalar ko‘paytiriladi.`,
    visuals: [
      { kind: 'formula', text: `${e} = ${e.toString(2)}₂ = ${parts.join(' + ')}` },
    ],
  });
  const rows: (string | number)[][] = [];
  let cur = mod(a, n);
  let p = 1n;
  const used: bigint[] = [];
  const hl: number[] = [];
  let i = 0;
  while (p <= e) {
    const inSum = (e & p) !== 0n;
    const calc = p === 1n ? `${a} mod ${n}` : `(${a}^${p / 2n})² = ${rows.length ? rows[rows.length - 1][2] : ''}² mod ${n}`;
    rows.push([`${a}${sup(p)}`, calc, cur.toString(), inSum ? `HA (×${cur})` : 'yo‘q']);
    if (inSum) { used.push(cur); hl.push(i); }
    cur = (cur * cur) % n;
    p <<= 1n;
    i++;
  }
  steps.push({
    title: 'Ketma-ket kvadratga oshirish (repeated squaring)',
    text: 'Har bir keyingi daraja oldingisining kvadrati. Har bir qadamda mod olinadi, shuning uchun sonlar kichik bo‘lib qoladi.',
    visuals: [{ kind: 'table', headers: ['Daraja', 'Hisoblash', 'Qiymat', 'Yig‘indida bormi?'], rows, hlRows: hl }],
  });
  let acc = 1n;
  const mrows: (string | number)[][] = [];
  for (const u of used) {
    const prev = acc;
    acc = (acc * u) % n;
    mrows.push([`${prev} × ${u}`, (prev * u).toString(), `${acc}`]);
  }
  steps.push({
    title: 'Tanlangan qiymatlarni ko‘paytirish',
    visuals: [
      { kind: 'table', headers: ['Ko‘paytma', 'Natija', `mod ${n}`], rows: mrows, hlRows: [mrows.length - 1] },
      { kind: 'note', tone: 'ok', text: `${a}${sup(e)} mod ${n} = ${acc}  (tekshiruv: ${modPow(a, e, n)})` },
    ],
  });
  return { steps, result: acc };
}

function euclidSteps(a: bigint, b: bigint): { steps: Step[]; g: bigint } {
  const rows: (string | number)[][] = [];
  let [x, y] = [a, b];
  let k = 1;
  while (y !== 0n) {
    const q = x / y, r = x % y;
    rows.push([k++, `${x} = ${q} · ${y} + ${r}`, r.toString()]);
    [x, y] = [y, r];
  }
  return {
    g: x,
    steps: [
      {
        title: 'Evklid algoritmi',
        text: 'a = q·b + r ko‘rinishida bo‘lamiz, keyin (a, b) ← (b, r). Qoldiq 0 bo‘lganda oxirgi nolmas qoldiq — EKUB.',
        visuals: [
          { kind: 'table', headers: ['Qadam', 'Bo‘lish', 'Qoldiq r'], rows, hlRows: [rows.length - 2 >= 0 ? rows.length - 2 : 0] },
          { kind: 'note', tone: 'ok', text: `EKUB(${a}, ${b}) = ${x}` },
        ],
      },
    ],
  };
}

function extEuclidSteps(a: bigint, n: bigint): { steps: Step[]; inv: bigint | null } {
  const steps: Step[] = [];
  const rows: (string | number)[][] = [];
  let [r0, r1, s0, s1, t0, t1] = [n, mod(a, n), 0n, 1n, 1n, 0n];
  // jadval: r, q, t (a koeffitsienti)
  rows.push(['—', r0.toString(), '—', '0']);
  rows.push(['—', r1.toString(), '—', '1']);
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
    [t0, t1] = [t1, t0 - q * t1];
    rows.push([`${rows.length - 1}`, r1.toString(), q.toString(), s1.toString()]);
  }
  steps.push({
    title: 'Kengaytirilgan Evklid jadvali',
    text: `rᵢ = rᵢ₋₂ − qᵢ·rᵢ₋₁ va xᵢ = xᵢ₋₂ − qᵢ·xᵢ₋₁. Har bir qatorda rᵢ ≡ xᵢ·${a} (mod ${n}).`,
    visuals: [{ kind: 'table', headers: ['i', 'qoldiq rᵢ', 'bo‘linma qᵢ', `${a} koeffitsienti xᵢ`], rows, hlRows: [rows.length - 2] }],
  });
  // orqaga o'rniga qo'yish (klassik ko'rinish)
  const back: string[] = [];
  {
    let [x, y] = [n, mod(a, n)];
    while (y !== 0n) {
      const q = x / y, r = x % y;
      back.push(`${x} = ${q}·${y} + ${r}   ⇒   ${r} = ${x} − ${q}·${y}`);
      [x, y] = [y, r];
    }
  }
  const { g, x } = egcd(mod(a, n), n);
  steps.push({
    title: 'To‘g‘ri yo‘l va orqaga o‘rniga qo‘yish',
    visuals: [
      { kind: 'table', headers: ['Evklid qadamlari'], rows: back.map((b) => [b]) },
      g === 1n
        ? { kind: 'formula', text: `${mod(a, n)}·(${x}) + ${n}·(${egcd(mod(a, n), n).y}) = 1   ⇒   ${a}·(${x}) ≡ 1 (mod ${n})` }
        : { kind: 'formula', text: `EKUB = ${g}` },
    ],
  });
  if (g !== 1n) {
    steps.push({
      title: 'Natija',
      visuals: [{ kind: 'note', tone: 'warn', text: `EKUB(${a}, ${n}) = ${g} ≠ 1 — modulli teskari element MAVJUD EMAS!` }],
    });
    return { steps, inv: null };
  }
  const inv = mod(x, n);
  steps.push({
    title: 'Manfiy koeffitsientni musbatga keltirish va tekshirish',
    visuals: [
      { kind: 'formula', text: `${a}⁻¹ ≡ ${x} ≡ ${x} + ${n}·k ≡ ${inv} (mod ${n})` },
      { kind: 'note', tone: 'ok', text: `Tekshiruv: ${a} · ${inv} = ${a * inv} ≡ ${mod(a * inv, n)} (mod ${n}) ✓` },
    ],
  });
  return { steps, inv };
}

export const modCalc: AlgorithmDef = {
  id: 'mod-calc',
  topic: 1,
  name: 'Modular kalkulyator',
  short: 'Qo‘shish, ayirish, ko‘paytirish, bo‘lish, daraja, EKUB, teskari element — har biri bosqichma-bosqich',
  theory: [
    'a mod n — a ni n ga bo‘lgandagi qoldiq: a = n·q + r, 0 ≤ r < n.',
    'Taqqoslama: a ≡ b (mod n) ⇔ n | (a − b).',
    'Xossalar: (a ± b) mod n = [(a mod n) ± (b mod n)] mod n, (a·b) mod n = [(a mod n)(b mod n)] mod n. Manfiy natijaga n qo‘shiladi.',
    'Modulli bo‘lish: a / b mod n = a · b⁻¹ mod n, b⁻¹ faqat EKUB(b, n) = 1 bo‘lsa mavjud.',
  ],
  formulas: ['a ≡ b (mod n) ⇔ n | (a−b)', 'a·a⁻¹ ≡ 1 (mod n)', 'a/b ≡ a·b⁻¹ (mod n)'],
  fields: [
    {
      key: 'op', label: 'Amal', type: 'select', default: 'add',
      options: [
        { value: 'add', label: '(a + b) mod n' }, { value: 'sub', label: '(a − b) mod n' },
        { value: 'mul', label: '(a · b) mod n' }, { value: 'div', label: '(a / b) mod n' },
        { value: 'pow', label: 'aᵇ mod n' }, { value: 'gcd', label: 'EKUB(a, b)' },
        { value: 'inv', label: 'a⁻¹ mod n' },
      ],
    },
    { key: 'a', label: 'a', type: 'number', default: '123' },
    { key: 'b', label: 'b', type: 'number', default: '456' },
    { key: 'n', label: 'n (modul)', type: 'number', default: '97' },
  ],
  examples: [
    { label: '(1234 − 9876) mod 101', values: { op: 'sub', a: '1234', b: '9876', n: '101' } },
    { label: '12345·6789 mod 101', values: { op: 'mul', a: '12345', b: '6789', n: '101' } },
    { label: '10 / 3 mod 7', values: { op: 'div', a: '10', b: '3', n: '7' } },
    { label: '6⁻¹ mod 15 (mavjud emas)', values: { op: 'inv', a: '6', b: '0', n: '15' } },
  ],
  run(v) {
    const op = val(v, 'op');
    const a = big(v, 'a'), b = big(v, 'b'), n = big(v, 'n');
    if (n <= 0n && op !== 'gcd') throw new Error('n musbat bo‘lishi kerak');
    const steps: Step[] = [];
    let out = '';
    const reduce = (x: bigint, name: string): Step => ({
      title: `${name} ni modul bo‘yicha kichraytirish`,
      visuals: [{ kind: 'formula', text: `${x} = ${n}·${(x - mod(x, n)) / n} + ${mod(x, n)}   ⇒   ${x} mod ${n} = ${mod(x, n)}` }],
    });
    switch (op) {
      case 'add':
      case 'sub':
      case 'mul': {
        steps.push(reduce(a, 'a'), reduce(b, 'b'));
        const ra = mod(a, n), rb = mod(b, n);
        const sym = op === 'add' ? '+' : op === 'sub' ? '−' : '·';
        const raw = op === 'add' ? ra + rb : op === 'sub' ? ra - rb : ra * rb;
        const r = mod(raw, n);
        steps.push({
          title: 'Amalni bajarish',
          visuals: [
            { kind: 'formula', text: `(${ra} ${sym} ${rb}) mod ${n} = ${raw} mod ${n}` },
            ...(raw < 0n ? [{ kind: 'note' as const, tone: 'info' as const, text: `Natija manfiy: ${raw} + ${n}·k → ${r}. Qoldiq har doim 0 ≤ r < n bo‘lishi kerak.` }] : []),
            { kind: 'formula', text: `${raw} = ${n}·${(raw - r) / n} + ${r}` },
            { kind: 'note', tone: 'ok', text: `Natija: ${r}` },
          ],
        });
        out = r.toString();
        break;
      }
      case 'pow': {
        if (b < 0n) throw new Error('Daraja manfiy bo‘lmasin');
        const r = fastPowSteps(a, b, n);
        steps.push(...r.steps);
        out = r.result.toString();
        break;
      }
      case 'gcd': {
        const r = euclidSteps(a < 0n ? -a : a, b < 0n ? -b : b);
        steps.push(...r.steps);
        out = r.g.toString();
        break;
      }
      case 'inv': {
        const r = extEuclidSteps(a, n);
        steps.push(...r.steps);
        out = r.inv === null ? 'mavjud emas' : r.inv.toString();
        break;
      }
      case 'div': {
        steps.push({ title: 'Bo‘lishni ko‘paytirishga o‘tkazish', visuals: [{ kind: 'formula', text: `${a} / ${b} mod ${n} = ${a} · ${b}⁻¹ mod ${n}` }] });
        const r = extEuclidSteps(b, n);
        steps.push(...r.steps.map((s) => ({ ...s, title: `${b}⁻¹: ${s.title}` })));
        if (r.inv === null) { out = 'mavjud emas'; break; }
        const res = mod(a * r.inv, n);
        steps.push({
          title: 'Yakuniy ko‘paytirish',
          visuals: [
            { kind: 'formula', text: `(${a} · ${r.inv}) mod ${n} = ${a * r.inv} mod ${n} = ${res}` },
            { kind: 'note', tone: 'ok', text: `Tekshiruv: ${res} · ${b} mod ${n} = ${mod(res * b, n)} = ${mod(a, n)} ✓` },
          ],
        });
        out = res.toString();
        break;
      }
      default:
        throw new Error('Amalni tanlang');
    }
    return { steps, output: [{ label: 'Natija', value: out }] };
  },
};

export const fastPow: AlgorithmDef = {
  id: 'fast-pow',
  topic: 1,
  name: 'Tezkor darajaga oshirish',
  short: 'Binary exponentiation (repeated squaring) — aᵉ mod n ni O(log e) amalda',
  theory: [
    'e ni ikkilik ko‘rinishda yozamiz: e = Σ 2ᵏ. Keyin a¹, a², a⁴, a⁸, … ketma-ket kvadratga oshirib topiladi.',
    'Faqat e ning “1” bitlariga mos darajalar ko‘paytiriladi. Har bir qadamda mod olinadi — sonlar hech qachon kattalashib ketmaydi.',
    'RSA, ElGamal, Diffie–Hellman, DSA — barchasining asosiy amali shu.',
  ],
  formulas: ['aᵉ = a^(2ᵏ¹) · a^(2ᵏ²) · … (mod n)'],
  fields: [
    { key: 'a', label: 'Asos a', type: 'number', default: '5' },
    { key: 'e', label: 'Daraja e', type: 'number', default: '117' },
    { key: 'n', label: 'Modul n', type: 'number', default: '19' },
  ],
  examples: [
    { label: '3¹⁰ mod 17', values: { a: '3', e: '10', n: '17' } },
    { label: '7¹²³ mod 55', values: { a: '7', e: '123', n: '55' } },
    { label: '17¹²³ mod 43', values: { a: '17', e: '123', n: '43' } },
  ],
  run(v) {
    const a = big(v, 'a'), e = big(v, 'e'), n = big(v, 'n');
    if (e < 1n || n < 2n) throw new Error('e ≥ 1 va n ≥ 2 bo‘lsin');
    const r = fastPowSteps(a, e, n);
    return { steps: r.steps, output: [{ label: `${a}^${e} mod ${n}`, value: r.result.toString() }] };
  },
};

export const euclid: AlgorithmDef = {
  id: 'euclid',
  topic: 1,
  name: 'Evklid algoritmi (EKUB)',
  short: 'EKUB(a, b) ni ketma-ket qoldiqli bo‘lish orqali topish',
  theory: [
    'EKUB(a, b) = EKUB(b, a mod b). Qoldiq 0 bo‘lguncha davom ettiriladi, oxirgi nolmas qoldiq — EKUB.',
    'EKUB(a, n) = 1 bo‘lsa, a va n o‘zaro tub, demak a⁻¹ mod n mavjud. Bu RSA kalit yaratishning asosiy sharti.',
  ],
  fields: [
    { key: 'a', label: 'a', type: 'number', default: '1071' },
    { key: 'b', label: 'b', type: 'number', default: '462' },
  ],
  examples: [
    { label: 'EKUB(252, 105)', values: { a: '252', b: '105' } },
    { label: 'EKUB(357, 221)', values: { a: '357', b: '221' } },
    { label: 'EKUB(123456, 98765)', values: { a: '123456', b: '98765' } },
  ],
  run(v) {
    let a = big(v, 'a'), b = big(v, 'b');
    if (a < b) [a, b] = [b, a];
    const r = euclidSteps(a, b);
    return { steps: r.steps, output: [{ label: 'EKUB', value: r.g.toString() }, { label: 'Tekshiruv', value: gcd(a, b).toString() }] };
  },
};

export const extEuclid: AlgorithmDef = {
  id: 'ext-euclid',
  topic: 1,
  name: 'Kengaytirilgan Evklid va teskari element',
  short: 'a·x + n·y = EKUB(a, n) — x esa a⁻¹ mod n',
  theory: [
    'Kengaytirilgan Evklid algoritmi EKUB ni a va n ning chiziqli kombinatsiyasi sifatida ifodalaydi: a·x + n·y = EKUB(a, n).',
    'Agar EKUB = 1 bo‘lsa, a·x ≡ 1 (mod n), ya’ni x = a⁻¹ mod n. Manfiy x ga n qo‘shiladi.',
    'RSA da d = e⁻¹ mod φ(n) aynan shu usulda topiladi.',
  ],
  formulas: ['a·x + n·y = gcd(a, n)', 'a·a⁻¹ ≡ 1 (mod n)'],
  fields: [
    { key: 'a', label: 'a', type: 'number', default: '17' },
    { key: 'n', label: 'n', type: 'number', default: '43' },
  ],
  examples: [
    { label: '7⁻¹ mod 26', values: { a: '7', n: '26' } },
    { label: '23⁻¹ mod 100', values: { a: '23', n: '100' } },
    { label: '35⁻¹ mod 64', values: { a: '35', n: '64' } },
    { label: '6⁻¹ mod 15', values: { a: '6', n: '15' } },
  ],
  run(v) {
    const a = big(v, 'a'), n = big(v, 'n');
    if (n < 2n) throw new Error('n ≥ 2 bo‘lsin');
    const r = extEuclidSteps(a, n);
    return { steps: r.steps, output: [{ label: `${a}⁻¹ mod ${n}`, value: r.inv === null ? 'mavjud emas' : r.inv.toString() }] };
  },
};

export const T1 = [modCalc, fastPow, euclid, extEuclid];
export { fastPowSteps, extEuclidSteps };
