import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AesStep, AesTrace, Bytes, MIX_MATRIX, StepOp, encryptTrace, mixColumnDetail } from './aes/aes';
import { ByteField, InputMode, asciiChar, bin, bytesToHex, hex, randomPrintableBytes } from './aes/format';
import { StateMatrix } from './components/state-matrix';
import { SboxTable } from './components/sbox-table';

/** Har bir operatsiya uchun sarlavha va o'zbekcha tushuntirish. */
interface OpInfo {
  title: string;
  short: string;
  what: string;
  why: string;
}

const OP_INFO: Record<StepOp, OpInfo> = {
  Input: {
    title: 'Matnni State matritsasiga joylash',
    short: 'Kirish',
    what:
      "16 baytli ochiq matn 4×4 o'lchamli State matritsasiga USTUN bo'yicha joylanadi: 0–3 baytlar 0-ustunga (yuqoridan pastga), 4–7 baytlar 1-ustunga va hokazo.",
    why: 'Barcha keyingi amallar aynan shu matritsa ustida bajariladi. Katakdagi kichik raqam — baytning matndagi tartib raqami.',
  },
  SubBytes: {
    title: 'SubBytes — baytlarni almashtirish',
    short: 'Sub',
    what:
      "Har bir bayt S-Box jadvali yordamida boshqa baytga almashtiriladi. Baytning birinchi hex raqami — jadval SATRI, ikkinchisi — USTUNI. Masalan: 53 → 5-satr, 3-ustun → ED.",
    why:
      "Bu AES'dagi yagona nochiziqli (non-linear) qadam. U shifrga \"chalkashlik\" (confusion) beradi — chiqish va kalit orasidagi bog'liqlikni murakkablashtiradi.",
  },
  ShiftRows: {
    title: 'ShiftRows — satrlarni siljitish',
    short: 'Shift',
    what:
      "Satrlar chapga siklik (aylanma) suriladi: 0-satr joyida qoladi, 1-satr 1 baytga, 2-satr 2 baytga, 3-satr 3 baytga. Chapdan chiqib ketgan bayt o'ng tomondan qaytib kiradi.",
    why:
      "Natijada bitta ustundagi baytlar 4 xil ustunga tarqaladi. MixColumns bilan birga bu \"tarqalish\" (diffusion)ni ta'minlaydi.",
  },
  MixColumns: {
    title: 'MixColumns — ustunlarni aralashtirish',
    short: 'Mix',
    what:
      "Har bir ustun (4 bayt) qat'iy koeffitsiyentlar matritsasiga GF(2⁸) maydonida ko'paytiriladi. Bu yerda qo'shish = XOR, 02 ga ko'paytirish = chapga surish (+ kerak bo'lsa 1B bilan XOR), 03•a = (02•a) ⊕ a.",
    why: "Natijada har bir chiqish bayti ustundagi barcha 4 ta baytga bog'liq bo'ladi: 1 bit o'zgarsa, butun ustun o'zgaradi.",
  },
  AddRoundKey: {
    title: "AddRoundKey — raund kalitini qo'shish",
    short: 'Key',
    what:
      "State'ning har bir bayti joriy raund kalitining mos bayti bilan XOR (⊕) qilinadi. XOR qoidasi: bitlar bir xil bo'lsa 0, har xil bo'lsa 1.",
    why: "Bu kalit shifrga qo'shiladigan yagona qadam. Kalitni bilmasdan natijani qaytarib bo'lmaydi. Natija keyingi raundga o'tadi.",
  },
};

const STEP_ORDER: StepOp[] = ['SubBytes', 'ShiftRows', 'MixColumns', 'AddRoundKey'];

@Component({
  selector: 'app-root',
  imports: [StateMatrix, SboxTable],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class App {
  // Shablonda ishlatiladigan yordamchilar
  protected readonly hex = hex;
  protected readonly bin = bin;
  protected readonly bytesToHex = bytesToHex;
  protected readonly asciiChar = asciiChar;
  protected readonly OP_INFO = OP_INFO;
  protected readonly MIX_MATRIX = MIX_MATRIX;
  protected readonly byteIdx = Array.from({ length: 16 }, (_, i) => i);
  protected readonly rounds = Array.from({ length: 11 }, (_, i) => i);

  // ---------------- 1. Kirish ma'lumotlari ----------------
  protected readonly pt = new ByteField('Two One Nine Two');
  protected readonly key = new ByteField('Thats my Kung Fu');
  protected readonly fields = [
    { id: 'pt', title: 'Ochiq matn (Plaintext)', icon: '📄', f: this.pt },
    { id: 'key', title: 'Maxfiy kalit (Key)', icon: '🔑', f: this.key },
  ];
  protected readonly inputsValid =computed(() => !!this.pt.bytes() && !!this.key.bytes());

  // ---------------- Shifrlash holati ----------------
  /** "Boshlash" bosilganda hisoblangan to'liq trace (snapshot). */
  protected readonly trace = signal<AesTrace | null>(null);
  protected readonly stepIndex = signal(0);
  protected readonly verify = signal<'pending' | 'ok' | 'fail' | 'unavailable'>('pending');

  /** Boshlangandan keyin kirish o'zgartirilgan bo'lsa — ogohlantirish. */
  protected readonly stale = computed(() => {
    const t = this.trace();
    const p = this.pt.bytes();
    const k = this.key.bytes();
    if (!t) return false;
    return !p || !k || bytesToHex(p) !== bytesToHex(t.plaintext) || bytesToHex(k) !== bytesToHex(t.key);
  });

  protected readonly step = computed<AesStep | null>(() => this.trace()?.steps[this.stepIndex()] ?? null);
  protected readonly lastIndex = computed(() => (this.trace()?.steps.length ?? 1) - 1);
  protected readonly isFinished = computed(() => !!this.trace() && this.stepIndex() === this.lastIndex());

  /** Vaqt chizig'i: har bir raund va uning qadamlari. */
  protected readonly timeline = computed(() => {
    const t = this.trace();
    if (!t) return [];
    return this.rounds.map((r) => ({ round: r, steps: t.steps.filter((s) => s.round === r) }));
  });

  // Interaktiv tanlovlar
  protected readonly selectedCell = signal(0);
  protected readonly selectedCol = signal(0);
  protected readonly selectedRoundKey = signal(0);
  protected readonly showFullKeyTable = signal(false);
  protected readonly replay = signal(0);
  protected readonly playing = signal(false);
  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPlay());
  }

  // ---------------- Kirish amallari ----------------

  protected onText(field: ByteField, ev: Event): void {
    field.setText((ev.target as HTMLInputElement).value);
  }

  protected setMode(field: ByteField, mode: InputMode): void {
    field.setMode(mode);
  }

  protected generateRandom(): void {
    this.pt.setBytes(randomPrintableBytes());
    this.key.setBytes(randomPrintableBytes());
  }

  protected loadExample(kind: 'fips' | 'kungfu'): void {
    if (kind === 'fips') {
      // FIPS-197, C.1-ilova: kutilgan natija 69C4E0D86A7B0430D8CDB78070B4C55A
      this.pt.setBytes(Array.from({ length: 16 }, (_, i) => i * 0x11), 'hex');
      this.key.setBytes(Array.from({ length: 16 }, (_, i) => i), 'hex');
    } else {
      this.pt.setText('Two One Nine Two');
      this.pt.mode.set('ascii');
      this.key.setText('Thats my Kung Fu');
      this.key.mode.set('ascii');
    }
  }

  /** "Boshlash": butun shifrlash jarayonini hisoblab, 0-qadamga o'tadi. */
  protected start(): void {
    const p = this.pt.bytes();
    const k = this.key.bytes();
    if (!p || !k) return;
    this.stopPlay();
    const t = encryptTrace(p, k);
    this.trace.set(t);
    this.stepIndex.set(0);
    this.selectedCell.set(0);
    this.selectedCol.set(0);
    this.selectedRoundKey.set(0);
    this.runWebCryptoCheck(t);
    setTimeout(() => document.getElementById('key-expansion')?.scrollIntoView({ behavior: 'smooth' }));
  }

  /**
   * Natijani brauzerning o'rnatilgan Web Crypto API'si bilan solishtiramiz.
   * AES-CBC + nol IV bilan birinchi blok = AES-ECB(P) — ya'ni bizning natijamiz bilan bir xil bo'lishi kerak.
   */
  private async runWebCryptoCheck(t: AesTrace): Promise<void> {
    this.verify.set('pending');
    try {
      const k = await crypto.subtle.importKey('raw', new Uint8Array(t.key), { name: 'AES-CBC' }, false, ['encrypt']);
      const out = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, new Uint8Array(t.plaintext)),
      );
      const ok = t.ciphertext.every((b, i) => b === out[i]);
      if (this.trace() === t) this.verify.set(ok ? 'ok' : 'fail');
    } catch {
      if (this.trace() === t) this.verify.set('unavailable');
    }
  }

  // ---------------- Navigatsiya ----------------

  protected go(index: number): void {
    const clamped = Math.max(0, Math.min(this.lastIndex(), index));
    this.stepIndex.set(clamped);
    this.replay.update((n) => n + 1);
    const s = this.trace()?.steps[clamped];
    if (s?.op === 'AddRoundKey') this.selectedRoundKey.set(s.round);
  }

  protected next(): void {
    if (this.stepIndex() >= this.lastIndex()) {
      this.stopPlay();
      return;
    }
    this.go(this.stepIndex() + 1);
  }

  protected prev(): void {
    this.go(this.stepIndex() - 1);
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.stopPlay();
      return;
    }
    if (this.isFinished()) this.go(0);
    this.playing.set(true);
    this.timer = setInterval(() => this.next(), 2200);
  }

  private stopPlay(): void {
    this.playing.set(false);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Klaviatura: ← / → qadamlar, Space — avto-ijro (matn maydonida yozayotganda ishlamaydi). */
  protected onKey(ev: KeyboardEvent): void {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (!this.trace() || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.next();
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.prev();
    }
  }

  protected scrollToKey(round: number): void {
    this.selectedRoundKey.set(round);
    document.getElementById('key-expansion')?.scrollIntoView({ behavior: 'smooth' });
  }

  protected scrollToOutput(): void {
    this.go(this.lastIndex());
    setTimeout(() => document.getElementById('output')?.scrollIntoView({ behavior: 'smooth' }));
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard ruxsat berilmagan — jim o'tamiz */
    }
  }

  // ---------------- Vizualizatsiya uchun hisoblangan qiymatlar ----------------

  /** Qiymati o'zgargan kataklar: oldin — qizil ("bad"), keyin — yashil ("good"). */
  protected readonly beforeClasses = computed(() => this.cellClasses('before'));
  protected readonly afterClasses = computed(() => this.cellClasses('after'));
  protected readonly keyClasses = new Array<string>(16).fill('key');

  private cellClasses(side: 'before' | 'after'): string[] {
    const s = this.step();
    if (!s) return [];
    return this.byteIdx.map((i) => {
      const r = i % 4;
      const c = Math.floor(i / 4);
      if (s.op === 'Input') return `col-${c}`;
      // ShiftRows: bayt qaysi ustundan kelganini rang bilan ko'rsatamiz
      if (s.op === 'ShiftRows') return side === 'before' ? `col-${c}` : `col-${(c + r) % 4}`;
      if (s.before[i] === s.after[i]) return 'same';
      return side === 'before' ? 'bad' : 'good';
    });
  }

  protected readonly changedCount = computed(() => {
    const s = this.step();
    return s ? s.before.filter((b, i) => b !== s.after[i]).length : 0;
  });

  /** SubBytes: tanlangan katak uchun S-Box'dan qidiruv. */
  protected readonly subLookup = computed(() => {
    const s = this.step();
    if (!s || s.op !== 'SubBytes') return null;
    const v = s.before[this.selectedCell()];
    return { input: v, row: v >> 4, col: v & 0x0f, output: s.after[this.selectedCell()] };
  });

  /** MixColumns: tanlangan ustun uchun batafsil GF(2^8) hisob-kitobi. */
  protected readonly mixDetail = computed(() => {
    const s = this.step();
    if (!s || s.op !== 'MixColumns' || s.skipped) return null;
    const c = this.selectedCol();
    const col = s.before.slice(4 * c, 4 * c + 4);
    return { col, out: s.after.slice(4 * c, 4 * c + 4), rows: mixColumnDetail(col) };
  });

  /** AddRoundKey: tanlangan katakdagi XOR bit darajasida. */
  protected readonly xorDetail = computed(() => {
    const s = this.step();
    if (!s || s.op !== 'AddRoundKey' || !s.roundKey) return null;
    const i = this.selectedCell();
    const a = s.before[i];
    const k = s.roundKey[i];
    const r = s.after[i];
    const bits = (x: number) => bin(x).split('');
    return { i, row: i % 4, col: Math.floor(i / 4), a, k, r, aBits: bits(a), kBits: bits(k), rBits: bits(r) };
  });

  /** Tanlangan raund kalitining so'zlari (Key Expansion bo'limi uchun). */
  protected readonly roundKeyWords = computed(() => {
    const t = this.trace();
    if (!t) return [];
    const r = this.selectedRoundKey();
    return t.schedule.words.slice(4 * r, 4 * r + 4);
  });

  protected readonly cipherAscii = computed(() => this.trace()?.ciphertext.map(asciiChar).join('') ?? '');
  protected readonly cipherBase64 = computed(() => {
    const t = this.trace();
    return t ? btoa(String.fromCharCode(...t.ciphertext)) : '';
  });

  protected stepLabel(s: AesStep): string {
    return s.op === 'Input' ? 'Kirish' : s.op;
  }

  protected opShort(op: StepOp): string {
    return OP_INFO[op].short;
  }

  /** Bitta raund ichidagi qadam tartib raqami (1..4). */
  protected stepInRound(s: AesStep): number {
    return STEP_ORDER.indexOf(s.op) + 1;
  }

  /** Bayt indeksidan ustun raqami (column-major: indeks = satr + 4 * ustun). */
  protected colOf(i: number): number {
    return Math.floor(i / 4);
  }

  protected shiftOf(r: number): string {
    return r === 0 ? 'siljimaydi' : `← ${r} bayt`;
  }

  protected wordHex(w: Bytes | undefined): string {
    return w ? bytesToHex(w, ' ') : '';
  }
}
