import { computed, signal } from '@angular/core';
import { Bytes } from './aes';

/** Formatlash va kirish ma'lumotlarini tahlil qilish uchun yordamchi funksiyalar. */

export const hex = (b: number): string => b.toString(16).toUpperCase().padStart(2, '0');
export const bin = (b: number): string => b.toString(2).padStart(8, '0');
export const bytesToHex = (bs: Bytes, sep = ' '): string => bs.map(hex).join(sep);
export const isPrintable = (b: number): boolean => b >= 0x20 && b <= 0x7e;
/** Bosib chiqarib bo'lmaydigan baytlar "·" bilan ko'rsatiladi. */
export const asciiChar = (b: number): string => (isPrintable(b) ? String.fromCharCode(b) : '·');

export type InputMode = 'ascii' | 'hex';

export interface ParseResult {
  bytes: Bytes | null;
  error: string | null;
  info: string | null;
}

/** ASCII matnni baytlarga aylantiradi; 16 baytdan qisqa bo'lsa 0x00 bilan to'ldiradi. */
export function parseAscii(text: string): ParseResult {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (!isPrintable(code)) {
      return {
        bytes: null,
        error: `"${ch}" — ASCII belgi emas. Faqat lotin harflari, raqamlar va oddiy belgilardan foydalaning (o'zbekcha ʻ o'rniga ' yozing).`,
        info: null,
      };
    }
    bytes.push(code);
  }
  if (bytes.length > 16) {
    return { bytes: null, error: `${bytes.length} bayt kiritildi — AES-128 uchun ko'pi bilan 16 bayt.`, info: null };
  }
  let info: string | null = null;
  if (bytes.length < 16) {
    info = `${bytes.length} bayt kiritildi — qolgan ${16 - bytes.length} bayt 0x00 bilan to'ldiriladi (padding).`;
    while (bytes.length < 16) bytes.push(0);
  }
  return { bytes, error: null, info };
}

/** Hex qatorni baytlarga aylantiradi. Bo'shliqlar, vergullar va "0x" prefikslari e'tiborsiz qoldiriladi. */
export function parseHex(text: string): ParseResult {
  const clean = text.replace(/0x/gi, '').replace(/[\s,:-]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    return { bytes: null, error: 'Faqat 0–9 va A–F belgilaridan foydalaning.', info: null };
  }
  if (clean.length !== 32) {
    return {
      bytes: null,
      error: `${clean.length}/32 hex raqam — aynan 32 ta raqam (16 bayt) bo'lishi kerak.`,
      info: null,
    };
  }
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return { bytes, error: null, info: null };
}

/** Baytlarni ASCII matnga qaytaradi (oxiridagi 0x00 padding olib tashlanadi). Iloji bo'lmasa null. */
export function bytesToAsciiText(bytes: Bytes): string | null {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  const body = bytes.slice(0, end);
  return body.every(isPrintable) ? String.fromCharCode(...body) : null;
}

/** Tasodifiy 16 ta bosiladigan ASCII belgi (0x21..0x7E) — ikkala formatda ham chiroyli ko'rinadi. */
export function randomPrintableBytes(): Bytes {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(raw, (b) => 0x21 + (b % 94));
}

/**
 * Bitta kirish maydoni (Plaintext yoki Key) holati.
 * Haqiqiy manba — `text` va `mode`; baytlar ulardan hisoblanadi.
 */
export class ByteField {
  readonly mode = signal<InputMode>('ascii');
  readonly text = signal('');
  /** Rejimni almashtirish imkonsiz bo'lganda chiqadigan ogohlantirish. */
  readonly warn = signal<string | null>(null);

  readonly parsed = computed(() =>
    this.mode() === 'ascii' ? parseAscii(this.text()) : parseHex(this.text()),
  );
  readonly bytes = computed(() => this.parsed().bytes);

  constructor(initialText: string, initialMode: InputMode = 'ascii') {
    this.text.set(initialText);
    this.mode.set(initialMode);
  }

  setText(text: string): void {
    this.warn.set(null);
    this.text.set(text);
  }

  /** ASCII <-> Hex rejimini almashtiradi va matnni yangi formatga o'giradi. */
  setMode(mode: InputMode): void {
    if (mode === this.mode()) return;
    this.warn.set(null);
    const bytes = this.bytes();
    if (bytes) {
      if (mode === 'hex') {
        this.text.set(bytesToHex(bytes));
      } else {
        const ascii = bytesToAsciiText(bytes);
        if (ascii === null) {
          this.warn.set(
            "Bu baytlar orasida bosib chiqarib bo'lmaydigan belgilar bor — ularni ASCII ko'rinishida yozib bo'lmaydi. Hex rejimida qoling.",
          );
          return;
        }
        this.text.set(ascii);
      }
    }
    this.mode.set(mode);
  }

  /** Baytlarni joriy rejimga mos formatda o'rnatadi. */
  setBytes(bytes: Bytes, mode?: InputMode): void {
    this.warn.set(null);
    const target = mode ?? this.mode();
    const ascii = bytesToAsciiText(bytes);
    if (target === 'ascii' && ascii !== null) {
      this.mode.set('ascii');
      this.text.set(ascii);
    } else {
      this.mode.set('hex');
      this.text.set(bytesToHex(bytes));
    }
  }
}
