import { AlgorithmDef, Step, Visual } from '../core/models';
import { gcd, isPrime, mod, modInv, modPow, utf8, val } from '../core/util';
import { extEuclidSteps, fastPowSteps } from './t1-modular';
import { sha256 } from './t6-sha';

/* ---------------------------------------------------------------
 * 8-MAVZU: DSA — har bir qadam alohida ko'rsatiladi
 * Bosqichlar: parametrlar → kalitlar → xesh → imzo → tekshirish → xavfsizlik
 * ------------------------------------------------------------- */

const PHASES = ['1. Parametrlar', '2. Kalitlar', '3. Xesh', '4. Imzo', '5. Tekshirish', '6. Xavfsizlik'];

/** Har bir qadam tepasida joriy bosqich ko'rinib turadi. */
const inPhase = (n: number, pre: string, steps: Step[]): Step[] =>
  steps.map((s) => ({
    ...s,
    title: `${pre}: ${s.title}`,
    visuals: [{ kind: 'flow', nodes: PHASES, active: n - 1 } as Visual, ...s.visuals],
  }));

const titled = (pre: string, steps: Step[]): Step[] => steps.map((s) => ({ ...s, title: `${pre} — ${s.title}` }));

/** Tezkor daraja; 0-daraja uchun alohida qadam (masalan, z ≡ 0 bo'lganda u₁ = 0). */
function pow(a: bigint, e: bigint, n: bigint): { steps: Step[]; result: bigint } {
  if (e === 0n) {
    return { result: 1n, steps: [{ title: 'Nolinchi daraja', visuals: [{ kind: 'formula', text: `${a}⁰ mod ${n} = 1` }] }] };
  }
  return fastPowSteps(a, e, n);
}

function inverse(a: bigint, n: bigint): { steps: Step[]; result: bigint } {
  const r = extEuclidSteps(a, n);
  if (r.inv === null) throw new Error(`${a}⁻¹ mod ${n} mavjud emas: EKUB(${a}, ${n}) = ${gcd(a, n)} ≠ 1`);
  return { steps: r.steps, result: r.inv };
}

/** Kichik sonlar uchun bo'luvchilarni sinash jadvali, kattalari uchun Miller–Rabin izohi. */
function primeStep(n: bigint, name: string): Step {
  if (!isPrime(n)) throw new Error(`${name} = ${n} tub son emas`);
  if (n > 10000n) {
    return { title: `${name} tub sonmi?`, visuals: [
      { kind: 'note', tone: 'ok', text: `${name} (${n.toString(2).length} bit) Miller–Rabin testidan o‘tdi — tub son ✓` },
    ] };
  }
  const rows: (string | number)[][] = [];
  for (let d = 2n; d * d <= n; d += d === 2n ? 1n : 2n) rows.push([`${d}`, `${n} mod ${d}`, `${n % d}`]);
  return {
    title: `${name} tub sonmi?`,
    text: `√${name} gacha bo‘lgan sonlarga bo‘lib ko‘ramiz. Birorta qoldiq 0 bo‘lmasa — son tub.`,
    visuals: [
      ...(rows.length ? [{ kind: 'table', headers: ['Bo‘luvchi', 'Amal', 'Qoldiq'], rows } as Visual] : []),
      { kind: 'note', tone: 'ok', text: `${name} = ${n} — tub son ✓` },
    ],
  };
}

export const dsa: AlgorithmDef = {
  id: 'dsa', topic: 8, name: 'DSA imzo algoritmi',
  short: 'r = (gᵏ mod p) mod q, s = k⁻¹(z + x·r) mod q',
  theory: [
    'DSA (FIPS 186) — diskret logarifm muammosiga asoslangan raqamli imzo. U xabarni shifrlamaydi: faqat xabar muallifini va o‘zgarmaganini isbotlaydi.',
    'Parametrlar: p — katta tub son, q — (p−1) ning tub bo‘luvchisi, g — tartibi q bo‘lgan element. Maxfiy kalit x, ochiq kalit y = gˣ mod p.',
    'Imzo xabar xeshi z va har imzo uchun yangi tasodifiy k dan hosil bo‘ladi. Tekshiruvchiga x va k kerak emas — faqat (p, q, g, y) va (r, s).',
    'O‘quv misollarida kichik sonlar ishlatiladi; real tizimlarda p kamida 2048 bit, q esa 224–256 bit bo‘ladi.',
  ],
  formulas: [
    'g = h₀^((p−1)/q) mod p', 'y = gˣ mod p', 'z = H(M) ning chap N biti (N = q ning bit uzunligi)',
    'r = (gᵏ mod p) mod q', 's = k⁻¹(z + x·r) mod q',
    'w = s⁻¹ mod q,  u₁ = z·w mod q,  u₂ = r·w mod q', 'v = (g^u₁ · y^u₂ mod p) mod q,  v = r ⇒ imzo to‘g‘ri',
  ],
  fields: [
    { key: 'p', label: 'p (tub)', type: 'number', default: '23' },
    { key: 'q', label: 'q (tub, q | p−1)', type: 'number', default: '11' },
    { key: 'g', label: 'g (tartibi q)', type: 'number', default: '4' },
    { key: 'x', label: 'x (maxfiy, 0 < x < q)', type: 'number', default: '3' },
    { key: 'k', label: 'k (bir martalik, 0 < k < q)', type: 'number', default: '7' },
    { key: 'm', label: 'Xabar M', type: 'text', default: 'SALOM' },
    { key: 'h', label: 'H(M) — son (ixtiyoriy)', type: 'number', default: '', hint: 'Bo‘sh bo‘lsa, SHA-256(M) hisoblanadi' },
  ],
  examples: [
    { label: 'Darslik: H(M) = 5', values: { p: '23', q: '11', g: '4', x: '3', k: '7', m: '', h: '5' } },
    { label: 'p=283, q=47, H(M)=41', values: { p: '283', q: '47', g: '60', x: '24', k: '15', m: '', h: '41' } },
    { label: 'p=7879, q=101, H(M)=22', values: { p: '7879', q: '101', g: '170', x: '75', k: '50', m: '', h: '22' } },
    { label: 'p=7879, q=101, SHA-256', values: { p: '7879', q: '101', g: '170', x: '75', k: '50', m: 'Kriptografiya', h: '' } },
  ],
  run(v) {
    const num = (key: string, name: string): bigint => {
      const s = val(v, key);
      if (!/^\d+$/.test(s)) throw new Error(`${name}: musbat butun son kiriting`);
      return BigInt(s);
    };
    const p = num('p', 'p'), q = num('q', 'q'), g = num('g', 'g'), x = num('x', 'x'), k = num('k', 'k');
    const message = v['m'] ?? '';
    const steps: Step[] = [];

    /* ---------- 1. Parametrlar ---------- */
    const params: Step[] = [primeStep(p, 'p'), primeStep(q, 'q')];
    if ((p - 1n) % q !== 0n) throw new Error(`q = ${q} soni p−1 = ${p - 1n} ni bo‘lmaydi`);
    const c = (p - 1n) / q;
    params.push({
      title: 'q soni p−1 ni bo‘ladimi?',
      text: 'Imzo hisob-kitoblari q tartibli kichik guruhda bajariladi. Bunday kichik guruh faqat q | (p−1) bo‘lganda mavjud.',
      visuals: [
        { kind: 'formula', text: `p − 1 = ${p - 1n} = ${q} · ${c}` },
        { kind: 'note', tone: 'ok', text: `(p−1) mod q = 0 ✓   Ko‘paytuvchi c = (p−1)/q = ${c}` },
      ],
    });
    if (g <= 1n || g >= p) throw new Error(`g 2..${p - 1n} oralig‘ida bo‘lsin`);
    if (p.toString(2).length <= 64) {
      const rows: (string | number)[][] = [];
      let h0: bigint | null = null;
      for (let t = 2n; t < p && t <= 40n && h0 === null; t++) {
        const r = modPow(t, c, p);
        rows.push([`${t}`, `${t}^${c} mod ${p}`, `${r}`]);
        if (r === g) h0 = t;
      }
      params.push({
        title: 'g qayerdan olinadi?',
        text: 'Generator 1 < h₀ < p−1 sonidan g = h₀^c mod p ko‘rinishida olinadi. Natija 1 bo‘lmasa, uning tartibi aniq q ga teng bo‘ladi.',
        visuals: [
          { kind: 'table', headers: ['h₀', 'Amal', 'Natija'], rows, hlRows: h0 === null ? [] : [rows.length - 1] },
          h0 === null
            ? { kind: 'note', tone: 'info', text: `h₀ ≤ 40 orasida g = ${g} chiqmadi. Tartibi keyingi qadamda tekshiriladi.` }
            : { kind: 'note', tone: 'ok', text: `h₀ = ${h0} uchun g = ${g} hosil bo‘ladi ✓` },
        ],
      });
    }
    const gq = pow(g, q, p);
    if (gq.result !== 1n) throw new Error(`g^q mod p = ${gq.result} ≠ 1 — g ning tartibi q emas`);
    params.push(...titled('g^q mod p = 1 ni tekshirish', gq.steps));
    if (q <= 40n) {
      const cells: string[] = [];
      for (let i = 1n; i <= q; i++) cells.push(`${modPow(g, i, p)}`);
      params.push({
        title: 'g hosil qilgan kichik guruh',
        text: `g ning darajalari q = ${q} ta qiymatdan keyin takrorlanadi. Barcha gᵏ va y shu to‘plamga tegishli.`,
        visuals: [
          { kind: 'bytes', title: `gⁱ mod ${p},  i = 1…${q}`, bytes: cells, labels: cells.map((_, i) => `i=${i + 1}`), hl: [cells.length - 1] },
          { kind: 'note', tone: 'ok', text: `g^${q} mod ${p} = 1 — g tartibi q = ${q} ✓` },
        ],
      });
    }
    steps.push(...inPhase(1, 'Parametrlar', params));

    /* ---------- 2. Kalitlar ---------- */
    if (x <= 0n || x >= q) throw new Error(`Maxfiy kalit x 1..${q - 1n} oralig‘ida bo‘lsin`);
    const y = pow(g, x, p);
    steps.push(...inPhase(2, 'Kalitlar', [
      { title: 'Maxfiy kalit x', text: 'x — 0 < x < q oralig‘idan tasodifiy tanlanadi va hech kimga berilmaydi.', visuals: [
        { kind: 'formula', text: `0 < x = ${x} < q = ${q} ✓` },
      ] },
      ...titled('y = g^x mod p', y.steps),
      { title: 'Kalitlar juftligi', text: 'y dan x ni topish uchun diskret logarifm yechilishi kerak — real o‘lchamlarda bu amalda imkonsiz.', visuals: [{ kind: 'kv', items: [
        { label: 'Ochiq kalit (p, q, g, y)', value: `(${p}, ${q}, ${g}, ${y.result})`, hl: true },
        { label: 'Maxfiy kalit x', value: `${x}`, hl: true },
      ] }] },
    ]));

    /* ---------- 3. Xesh ---------- */
    const N = q.toString(2).length;
    let z: bigint;
    if (val(v, 'h')) {
      z = num('h', 'H(M)');
      steps.push(...inPhase(3, 'Xesh', [{
        title: 'Xabar xeshi z',
        text: 'Imzo xabarning o‘ziga emas, uning xeshiga qo‘yiladi. Bu yerda xesh qiymati son sifatida berilgan.',
        visuals: [{ kind: 'formula', text: `z = H(M) = ${z}` }, { kind: 'formula', text: `z mod q = ${z} mod ${q} = ${z % q}` }],
      }]));
    } else {
      if (!message) throw new Error('Xabar M yoki H(M) qiymatini kiriting');
      const digest = sha256(utf8(message));
      const full = BigInt('0x' + digest);
      z = N < 256 ? full >> BigInt(256 - N) : full;
      const bits = full.toString(2).padStart(256, '0').slice(0, Math.min(N, 256));
      steps.push(...inPhase(3, 'Xesh', [
        { title: 'SHA-256(M)', text: 'Imzo xabarning o‘ziga emas, uning xeshiga qo‘yiladi: xabar qancha uzun bo‘lmasin, xesh 256 bit.', visuals: [
          { kind: 'kv', items: [{ label: 'M', value: message }, { label: 'SHA-256(M)', value: digest, hl: true }] },
        ] },
        { title: 'Xeshni q uzunligiga qisqartirish', text: `FIPS 186 bo‘yicha xeshning chap tomonidagi N ta bit olinadi. q soni ${N} bit, demak N = ${N}.`, visuals: [
          { kind: 'formula', text: `z = chap ${N} bit = ${bits.length > 64 ? bits.slice(0, 64) + '…' : bits}₂ = ${z}` },
          { kind: 'formula', text: `z mod q = ${z} mod ${q} = ${z % q}` },
        ] },
      ]));
    }

    /* ---------- 4. Imzo ---------- */
    if (k <= 0n || k >= q) throw new Error(`k 1..${q - 1n} oralig‘ida bo‘lsin`);
    const gk = pow(g, k, p);
    const r = gk.result % q;
    if (r === 0n) throw new Error('r = 0 chiqdi — standart bo‘yicha boshqa k tanlanadi');
    const ki = inverse(k, q);
    const xr = x * r;
    const sum = z + xr;
    const s = mod(ki.result * sum, q);
    if (s === 0n) throw new Error('s = 0 chiqdi — standart bo‘yicha boshqa k tanlanadi');
    steps.push(...inPhase(4, 'Imzo', [
      { title: 'Bir martalik k', text: 'k har bir imzo uchun yangidan tasodifiy tanlanadi va imzodan keyin o‘chiriladi.', visuals: [
        { kind: 'formula', text: `0 < k = ${k} < q = ${q} ✓` },
      ] },
      ...titled('gᵏ mod p', gk.steps),
      { title: 'r ni hisoblash', text: 'gᵏ mod p natijasi q bo‘yicha qisqartiriladi. Shu sababli imzo uzunligi p ga emas, q ga bog‘liq.', visuals: [
        { kind: 'formula', text: `r = (gᵏ mod p) mod q = ${gk.result} mod ${q} = ${r}` },
        { kind: 'note', tone: 'ok', text: `r = ${r} ≠ 0 ✓` },
      ] },
      ...titled('k⁻¹ mod q', ki.steps),
      { title: 's ni hisoblash', text: 'Bu yerda xabar xeshi z va maxfiy kalit x imzoga bog‘lanadi.', visuals: [
        { kind: 'table', headers: ['Amal', 'Hisoblash', 'Natija'], rows: [
          ['x·r', `${x} · ${r}`, `${xr}`],
          ['z + x·r', `${z} + ${xr}`, `${sum}`],
          ['k⁻¹·(z + x·r)', `${ki.result} · ${sum}`, `${ki.result * sum}`],
          ['s = … mod q', `${ki.result * sum} mod ${q}`, `${s}`],
        ], hlRows: [3] },
        { kind: 'note', tone: 'ok', text: `s = ${s} ≠ 0 ✓` },
      ] },
      { title: 'Tayyor imzo', text: 'Qabul qiluvchiga xabar M va (r, s) juftligi yuboriladi.', visuals: [
        { kind: 'note', tone: 'ok', text: `Imzo (r, s) = (${r}, ${s})` },
      ] },
    ]));

    /* ---------- 5. Tekshirish ---------- */
    const w = inverse(s, q);
    const u1 = mod(z * w.result, q), u2 = mod(r * w.result, q);
    const a = pow(g, u1, p), b = pow(y.result, u2, p);
    const ab = (a.result * b.result) % p, vv = ab % q;
    const valid = vv === r;
    steps.push(...inPhase(5, 'Tekshirish', [
      { title: 'Imzo oralig‘ini tekshirish', text: 'Oraliqdan tashqaridagi imzo hisoblashsiz rad etiladi. Tekshiruvchida faqat ochiq kalit va (r, s) bor.', visuals: [
        { kind: 'formula', text: `0 < r = ${r} < ${q} ✓    0 < s = ${s} < ${q} ✓` },
      ] },
      ...titled('w = s⁻¹ mod q', w.steps),
      { title: 'u₁ va u₂', visuals: [{ kind: 'table', headers: ['Qiymat', 'Hisoblash', 'Natija'], rows: [
        ['u₁ = z·w mod q', `${z} · ${w.result} mod ${q}`, `${u1}`],
        ['u₂ = r·w mod q', `${r} · ${w.result} mod ${q}`, `${u2}`],
      ] }] },
      ...titled('g^u₁ mod p', a.steps),
      ...titled('y^u₂ mod p', b.steps),
      { title: 'v ni hisoblash', visuals: [{ kind: 'table', headers: ['Amal', 'Hisoblash', 'Natija'], rows: [
        ['g^u₁ · y^u₂', `${a.result} · ${b.result}`, `${a.result * b.result}`],
        ['… mod p', `${a.result * b.result} mod ${p}`, `${ab}`],
        ['v = … mod q', `${ab} mod ${q}`, `${vv}`],
      ], hlRows: [2] }] },
      { title: 'Xulosa: v = r ?', visuals: [
        { kind: 'formula', text: `v = ${vv},   r = ${r}` },
        valid ? { kind: 'note', tone: 'ok', text: 'v = r — imzo HAQIQIY ✓' } : { kind: 'note', tone: 'warn', text: 'v ≠ r — imzo noto‘g‘ri' },
      ] },
      { title: 'Nima uchun v = r bo‘ladi?', text: 'Darajalar q bo‘yicha hisoblanadi, chunki g ning tartibi q. y = gˣ ni o‘rniga qo‘yamiz:', visuals: [
        { kind: 'formula', text: 'g^u₁ · y^u₂ = g^(z·w) · g^(x·r·w) = g^(w·(z + x·r))' },
        { kind: 'formula', text: 's = k⁻¹(z + x·r)  ⇒  w·(z + x·r) = s⁻¹·s·k ≡ k (mod q)' },
        { kind: 'formula', text: `Demak, g^u₁ · y^u₂ mod p = gᵏ mod p = ${gk.result}, ya’ni v = ${gk.result} mod ${q} = r` },
      ] },
    ]));

    /* ---------- 6. Xavfsizlik ---------- */
    const z2 = z + 1n;
    const u1b = mod(z2 * w.result, q);
    const v2 = (modPow(g, u1b, p) * modPow(y.result, u2, p)) % p % q;
    const ri = modInv(r, q);
    const recovered = mod(ri * (s * k - z), q);
    steps.push(...inPhase(6, 'Xavfsizlik', [
      { title: 'Xabar o‘zgartirilsa nima bo‘ladi?', text: 'Xuddi shu imzoni xeshi boshqacha bo‘lgan xabarga qo‘llaymiz (z′ = z + 1).', visuals: [
        { kind: 'formula', text: `u₁′ = z′·w mod q = ${z2} · ${w.result} mod ${q} = ${u1b}` },
        { kind: 'formula', text: `v′ = (g^u₁′ · y^u₂ mod p) mod q = ${v2}` },
        v2 === r
          ? { kind: 'note', tone: 'warn', text: `Tasodifan v′ = r chiqdi: q = ${q} juda kichik bo‘lgani uchun qiymatlar to‘qnashdi. Real q (224–256 bit) da bu amalda yuz bermaydi.` }
          : { kind: 'note', tone: 'ok', text: `v′ = ${v2} ≠ r = ${r} — o‘zgartirilgan xabar rad etildi ✓` },
      ] },
      { title: 'k oshkor bo‘lsa nima bo‘ladi?', text: 's formulasidan x ni ifodalash mumkin. Shuning uchun k ni oshkor qilish yoki ikki imzoda takrorlash maxfiy kalitni beradi.', visuals: [
        { kind: 'formula', text: `x = r⁻¹·(s·k − z) mod q = ${ri} · (${s}·${k} − ${z}) mod ${q} = ${recovered}` },
        { kind: 'note', tone: 'warn', text: `Tiklangan x = ${recovered} — bu haqiqiy maxfiy kalit. k har imzoda yangi va maxfiy bo‘lishi shart.` },
      ] },
    ]));

    return { steps, output: [
      { label: 'Ochiq kalit y', value: `${y.result}` },
      { label: 'z', value: `${z}` },
      { label: '(r, s)', value: `(${r}, ${s})` },
      { label: 'v', value: `${vv}` },
      { label: 'Tekshiruv', value: valid ? 'to‘g‘ri' : 'noto‘g‘ri' },
    ] };
  },
};

export const TDSA = [dsa];
