/**
 * AES-128 dvigateli (ta'limiy maqsadda yozilgan).
 *
 * Oddiy shifrlash kutubxonalaridan farqli o'laroq, bu yerda har bir oraliq natija
 * ("trace") saqlab qo'yiladi — UI shu ma'lumotlar asosida har bir qadamni ko'rsatadi.
 *
 * MUHIM: State matritsasi FIPS-197 standartidagi kabi "ustun bo'yicha" (column-major)
 * saqlanadi: massivdagi indeks = satr + 4 * ustun.
 *   bytes[0..3]  -> 0-ustun, bytes[4..7] -> 1-ustun, ...
 * Bu AES so'zlari (word = 4 bayt) bilan to'g'ridan-to'g'ri mos keladi: raund kalitining
 * har bir so'zi State'ning bitta ustuniga to'g'ri keladi.
 */

export type Bytes = number[];

// ---------------------------------------------------------------------------
// GF(2^8) arifmetikasi
// ---------------------------------------------------------------------------

/**
 * xtime(b) = b * 02 (GF(2^8) da).
 * Bitlarni 1 ga chapga suramiz; agar eng katta bit (0x80) 1 bo'lgan bo'lsa,
 * natija 8 bitdan oshib ketadi va uni x^8 + x^4 + x^3 + x + 1 (0x11B) polinom bo'yicha
 * "qisqartiramiz" — amalda bu 0x1B bilan XOR qilish demakdir.
 */
export function xtime(b: number): number {
  return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
}

/** GF(2^8) da ixtiyoriy ikki baytni ko'paytirish ("rus dehqoni" usuli). */
export function gmul(a: number, b: number): number {
  let p = 0;
  while (b) {
    if (b & 1) p ^= a; // qo'shish = XOR
    a = xtime(a);
    b >>= 1;
  }
  return p;
}

// ---------------------------------------------------------------------------
// S-Box
// ---------------------------------------------------------------------------

/**
 * S-Box jadvalini qo'lda yozish o'rniga uni ta'rifi bo'yicha hisoblaymiz:
 *   1) baytning GF(2^8) dagi teskarisi olinadi (0 ning teskarisi 0 deb olinadi);
 *   2) unga affin almashtirish qo'llanadi: s = b ⊕ rotl(b,1) ⊕ rotl(b,2) ⊕ rotl(b,3) ⊕ rotl(b,4) ⊕ 0x63.
 * Natija standartdagi jadval bilan aynan bir xil (masalan, SBOX[0x53] = 0xED).
 */
function buildSbox(): number[] {
  const inv = new Array<number>(256).fill(0);
  for (let a = 1; a < 256; a++) {
    for (let b = 1; b < 256; b++) {
      if (gmul(a, b) === 1) {
        inv[a] = b;
        break;
      }
    }
  }
  const rotl8 = (x: number, s: number) => ((x << s) | (x >>> (8 - s))) & 0xff;
  return inv.map((b) => b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63);
}

export const SBOX: readonly number[] = buildSbox();

/** Raund konstantalari: Rcon[i] = 02^(i-1) GF(2^8) da. Faqat so'zning birinchi baytiga qo'shiladi. */
export const RCON: readonly number[] = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/** MixColumns koeffitsiyentlar matritsasi. */
export const MIX_MATRIX: readonly (readonly number[])[] = [
  [2, 3, 1, 1],
  [1, 2, 3, 1],
  [1, 1, 2, 3],
  [3, 1, 1, 2],
];

// ---------------------------------------------------------------------------
// Kalitni kengaytirish (Key Expansion)
// ---------------------------------------------------------------------------

/** Kengaytirilgan kalitning bitta so'zi w[i] va u qanday hosil bo'lgani. */
export interface KeyWord {
  i: number;
  /** Bu so'z qaysi raund kalitiga tegishli (i / 4). */
  round: number;
  word: Bytes;
  /** i >= 4 bo'lgan so'zlar uchun: w[i-1] */
  temp?: Bytes;
  /** w[i-4] */
  prev4?: Bytes;
  /** Faqat i % 4 == 0 bo'lganda: RotWord, SubWord va Rcon bosqichlari */
  rot?: Bytes;
  sub?: Bytes;
  rcon?: Bytes;
  afterRcon?: Bytes;
}

export interface KeySchedule {
  words: KeyWord[]; // 44 ta so'z
  roundKeys: Bytes[]; // 11 ta raund kaliti (har biri 16 bayt, column-major)
}

const xorWords = (a: Bytes, b: Bytes): Bytes => a.map((v, k) => v ^ b[k]);

export function expandKey(key: Bytes): KeySchedule {
  const words: KeyWord[] = [];

  // Birinchi 4 ta so'z — asosiy kalitning o'zi.
  for (let i = 0; i < 4; i++) {
    words.push({ i, round: 0, word: key.slice(4 * i, 4 * i + 4) });
  }

  for (let i = 4; i < 44; i++) {
    const temp = words[i - 1].word;
    const prev4 = words[i - 4].word;
    const entry: KeyWord = { i, round: Math.floor(i / 4), word: [], temp, prev4 };
    let t = temp;

    if (i % 4 === 0) {
      // Har bir raund kalitining birinchi so'zi uchun maxsus funksiya g():
      entry.rot = [t[1], t[2], t[3], t[0]]; // RotWord: 1 baytga chapga aylantirish
      entry.sub = entry.rot.map((b) => SBOX[b]); // SubWord: har bir baytga S-Box
      entry.rcon = [RCON[i / 4 - 1], 0, 0, 0];
      entry.afterRcon = xorWords(entry.sub, entry.rcon); // Rcon bilan XOR
      t = entry.afterRcon;
    }

    entry.word = xorWords(prev4, t); // w[i] = w[i-4] ⊕ temp
    words.push(entry);
  }

  const roundKeys: Bytes[] = [];
  for (let r = 0; r <= 10; r++) {
    roundKeys.push(words.slice(4 * r, 4 * r + 4).flatMap((w) => w.word));
  }
  return { words, roundKeys };
}

// ---------------------------------------------------------------------------
// Raund operatsiyalari (barchasi yangi massiv qaytaradi — asl state o'zgarmaydi)
// ---------------------------------------------------------------------------

export function subBytes(s: Bytes): Bytes {
  return s.map((b) => SBOX[b]);
}

/** r-satr r baytga chapga siklik suriladi: yangi[r][c] = eski[r][(c + r) mod 4]. */
export function shiftRows(s: Bytes): Bytes {
  const out = new Array<number>(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r + 4 * c] = s[r + 4 * ((c + r) % 4)];
    }
  }
  return out;
}

export function mixColumns(s: Bytes): Bytes {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    const col = s.slice(4 * c, 4 * c + 4);
    for (let r = 0; r < 4; r++) {
      out[r + 4 * c] = MIX_MATRIX[r].reduce((acc, coef, k) => acc ^ gmul(coef, col[k]), 0);
    }
  }
  return out;
}

export function addRoundKey(s: Bytes, k: Bytes): Bytes {
  return s.map((b, i) => b ^ k[i]);
}

// ---------------------------------------------------------------------------
// MixColumns batafsil hisob-kitobi (UI uchun)
// ---------------------------------------------------------------------------

/** Bitta ko'paytma: coef • value. */
export interface MulTerm {
  coef: number;
  value: number;
  product: number;
  /** 02 va 03 uchun: value << 1 (8 bit bilan cheklangan) */
  shifted: number;
  /** Eng katta bit 1 bo'lganmi (ya'ni 0x1B bilan XOR kerakmi) */
  overflow: boolean;
  /** xtime(value) = 02 • value */
  doubled: number;
}

export interface MixRow {
  row: number;
  terms: MulTerm[];
  result: number;
}

export function mixColumnDetail(col: Bytes): MixRow[] {
  return MIX_MATRIX.map((coefs, row) => {
    const terms = coefs.map((coef, k) => {
      const value = col[k];
      return {
        coef,
        value,
        product: gmul(coef, value),
        shifted: (value << 1) & 0xff,
        overflow: (value & 0x80) !== 0,
        doubled: xtime(value),
      };
    });
    return { row, terms, result: terms.reduce((acc, t) => acc ^ t.product, 0) };
  });
}

// ---------------------------------------------------------------------------
// To'liq shifrlash "trace"i
// ---------------------------------------------------------------------------

export type StepOp = 'Input' | 'SubBytes' | 'ShiftRows' | 'MixColumns' | 'AddRoundKey';

export interface AesStep {
  index: number;
  round: number;
  op: StepOp;
  before: Bytes;
  after: Bytes;
  /** Faqat AddRoundKey uchun */
  roundKey?: Bytes;
  /** 10-raunddagi MixColumns — bajarilmaydi */
  skipped?: boolean;
}

export interface AesTrace {
  plaintext: Bytes;
  key: Bytes;
  schedule: KeySchedule;
  steps: AesStep[];
  /** Har bir raund oxiridagi State (0..10) */
  roundStates: Bytes[];
  ciphertext: Bytes;
}

/**
 * Bitta 16 baytli blokni AES-128 bilan shifrlaydi va har bir qadamni yozib boradi.
 *
 *   0-raund:      AddRoundKey(K0)
 *   1..9-raundlar: SubBytes → ShiftRows → MixColumns → AddRoundKey(Kr)
 *   10-raund:     SubBytes → ShiftRows → (MixColumns YO'Q) → AddRoundKey(K10)
 */
export function encryptTrace(plaintext: Bytes, key: Bytes): AesTrace {
  if (plaintext.length !== 16 || key.length !== 16) {
    throw new Error('AES-128 uchun matn va kalit aynan 16 baytdan iborat bo\'lishi kerak');
  }

  const schedule = expandKey(key);
  const steps: AesStep[] = [];
  const roundStates: Bytes[] = [];
  const push = (step: Omit<AesStep, 'index'>) => steps.push({ index: steps.length, ...step });

  let state = [...plaintext];

  // Matnni State matritsasiga joylash (ko'rgazmali qadam — qiymatlar o'zgarmaydi).
  push({ round: 0, op: 'Input', before: [...plaintext], after: [...state] });

  // 0-raund: faqat dastlabki kalitni qo'shish.
  let next = addRoundKey(state, schedule.roundKeys[0]);
  push({ round: 0, op: 'AddRoundKey', before: state, after: next, roundKey: schedule.roundKeys[0] });
  state = next;
  roundStates.push(state);

  for (let round = 1; round <= 10; round++) {
    next = subBytes(state);
    push({ round, op: 'SubBytes', before: state, after: next });
    state = next;

    next = shiftRows(state);
    push({ round, op: 'ShiftRows', before: state, after: next });
    state = next;

    if (round < 10) {
      next = mixColumns(state);
      push({ round, op: 'MixColumns', before: state, after: next });
      state = next;
    } else {
      // Oxirgi raundda MixColumns o'tkazib yuboriladi — buni talabalarga aniq ko'rsatamiz.
      push({ round, op: 'MixColumns', before: state, after: [...state], skipped: true });
    }

    next = addRoundKey(state, schedule.roundKeys[round]);
    push({ round, op: 'AddRoundKey', before: state, after: next, roundKey: schedule.roundKeys[round] });
    state = next;
    roundStates.push(state);
  }

  return { plaintext: [...plaintext], key: [...key], schedule, steps, roundStates, ciphertext: state };
}
