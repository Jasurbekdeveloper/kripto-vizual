import { Component, computed, input } from '@angular/core';
import { SBOX } from '../aes/aes';
import { hex } from '../aes/format';

/**
 * 16x16 S-Box jadvali. Tanlangan bayt uchun: satr = yuqori 4 bit, ustun = quyi 4 bit.
 * Kesishgan katak — almashtirish natijasi.
 */
@Component({
  selector: 'app-sbox-table',
  template: `
    <div class="sbox-scroll">
      <table class="sbox" aria-label="AES S-Box jadvali">
        <thead>
          <tr>
            <th class="corner">x\\y</th>
            @for (c of idx; track c) {
              <th [class.hl]="hi() !== null && c === lo()">{{ hexDigit(c) }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of idx; track r) {
            <tr>
              <th [class.hl]="r === hi()">{{ hexDigit(r) }}</th>
              @for (c of idx; track c) {
                @let v = r * 16 + c;
                <td
                  [class.cross]="hi() !== null && (r === hi() || c === lo())"
                  [class.used]="usedSet().has(v)"
                  [class.hit]="v === highlight()"
                >{{ table[v] }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .sbox-scroll { overflow-x: auto; max-width: 100%; }
    .sbox { border-collapse: collapse; font: 11px var(--mono); margin: 0 auto; }
    .sbox th, .sbox td { width: 24px; height: 20px; text-align: center; padding: 0 1px; }
    .sbox th { color: var(--muted); font-weight: 700; }
    .sbox th.hl { color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); border-radius: 4px; }
    .sbox td { color: color-mix(in srgb, var(--text) 55%, transparent); border-radius: 3px; transition: background .2s; }
    .sbox td.used { color: var(--text); background: color-mix(in srgb, var(--green) 14%, transparent); }
    .sbox td.cross { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text); }
    .sbox td.hit { background: var(--green); color: #04130c; font-weight: 800; box-shadow: 0 0 10px var(--green); }
    .corner { font-size: 9px; }
  `,
})
export class SboxTable {
  /** Ko'rsatilayotgan kirish bayti (S-Box'dan qidirilayotgan qiymat). */
  readonly highlight = input<number | null>(null);
  /** Shu raundda S-Box'dan foydalanilgan barcha kirish baytlari. */
  readonly used = input<number[]>([]);

  protected readonly idx = Array.from({ length: 16 }, (_, i) => i);
  protected readonly table = SBOX.map(hex);
  protected readonly hi = computed(() => (this.highlight() === null ? null : this.highlight()! >> 4));
  protected readonly lo = computed(() => (this.highlight() === null ? null : this.highlight()! & 0x0f));
  protected readonly usedSet = computed(() => new Set(this.used()));

  protected hexDigit(n: number): string {
    return n.toString(16).toUpperCase();
  }
}
