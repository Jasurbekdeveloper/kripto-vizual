import { Component, computed, input, output } from '@angular/core';
import { Bytes } from '../aes/aes';
import { hex } from '../aes/format';

/**
 * 4x4 State (yoki raund kaliti) matritsasini chizadigan qayta ishlatiladigan komponent.
 * Baytlar column-major tartibda keladi: indeks = satr + 4 * ustun.
 */
@Component({
  selector: 'app-state-matrix',
  template: `
    <figure class="matrix-wrap">
      @if (label()) {
        <figcaption class="m-label">
          {{ label() }}
          @if (sublabel()) {
            <small>{{ sublabel() }}</small>
          }
        </figcaption>
      }
      <div class="matrix" [class.clickable]="clickable()" [class.key]="variant() === 'key'">
        @for (r of idx; track r) {
          @for (c of idx; track c) {
            @let i = r + 4 * c;
            <button
              type="button"
              class="cell"
              [class]="classes()[i] ?? ''"
              [class.selected]="selected() === i"
              [class.in-col]="selectedCol() === c"
              [class.slide]="animateShift() && r > 0"
              [style.--shift]="r"
              [style.grid-row]="r + 1"
              [style.grid-column]="c + 1"
              [attr.tabindex]="clickable() ? 0 : -1"
              [attr.aria-label]="'satr ' + r + ', ustun ' + c + ': ' + cells()[i]"
              (click)="clickable() && pick.emit(i)"
            >
              {{ cells()[i] }}
              @if (showIndex()) {
                <sub>{{ i }}</sub>
              }
            </button>
          }
        }
      </div>
    </figure>
  `,
  styles: `
    .matrix-wrap { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .m-label { font-size: 13px; font-weight: 600; color: var(--muted); text-align: center; line-height: 1.3; }
    .m-label small { display: block; font-weight: 400; font-size: 11px; opacity: .8; }
    .matrix {
      display: grid; grid-template-columns: repeat(4, var(--cell)); grid-template-rows: repeat(4, var(--cell));
      gap: var(--gap); padding: 8px; border-radius: 12px;
      background: var(--panel-2); border: 1px solid var(--border);
    }
    .matrix.key { border-color: color-mix(in srgb, var(--key) 50%, transparent); }
    .cell {
      position: relative; width: var(--cell); height: var(--cell);
      display: grid; place-items: center; padding: 0;
      font: 600 15px var(--mono); color: var(--text);
      background: var(--cell-bg); border: 1px solid var(--border); border-radius: 8px;
      cursor: default; transition: background .25s, border-color .25s, transform .15s, box-shadow .2s;
    }
    .clickable .cell { cursor: pointer; }
    .clickable .cell:hover { transform: translateY(-2px); border-color: var(--accent); }
    .cell sub { position: absolute; bottom: 2px; right: 4px; font-size: 9px; color: var(--muted); font-weight: 400; }

    /* O'zgarish ranglari: oldin — qizil, keyin — yashil */
    .cell.bad { background: var(--red-bg); border-color: var(--red); color: var(--red-text); }
    .cell.good { background: var(--green-bg); border-color: var(--green); color: var(--green-text); }
    .cell.key { background: var(--key-bg); border-color: var(--key); color: var(--key-text); }
    .cell.same { opacity: .75; }
    /* ShiftRows: bayt qaysi ustundan kelganini ko'rsatuvchi ranglar */
    .cell.col-0 { background: var(--c0-bg); border-color: var(--c0); }
    .cell.col-1 { background: var(--c1-bg); border-color: var(--c1); }
    .cell.col-2 { background: var(--c2-bg); border-color: var(--c2); }
    .cell.col-3 { background: var(--c3-bg); border-color: var(--c3); }

    .cell.in-col { box-shadow: 0 0 0 2px var(--accent2); }
    .cell.selected { box-shadow: 0 0 0 3px var(--accent), 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent); z-index: 1; }

    /* ShiftRows animatsiyasi: r-satrdagi baytlar r katak o'ngdan chapga "sirpanib" keladi */
    .cell.slide { animation: slide-in .9s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--shift) * .15s); }
    @keyframes slide-in {
      from { transform: translateX(calc(var(--shift) * (var(--cell) + var(--gap)))); opacity: .2; }
      to { transform: translateX(0); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) { .cell.slide { animation: none; } }
  `,
})
export class StateMatrix {
  readonly bytes = input.required<Bytes>();
  /** Har bir katak uchun qo'shimcha CSS klass (16 ta). */
  readonly classes = input<string[]>([]);
  readonly label = input<string>('');
  readonly sublabel = input<string>('');
  readonly selected = input<number | null>(null);
  readonly selectedCol = input<number | null>(null);
  readonly clickable = input(false);
  readonly showIndex = input(false);
  readonly animateShift = input(false);
  readonly variant = input<'state' | 'key'>('state');

  readonly pick = output<number>();

  protected readonly idx = [0, 1, 2, 3];
  protected readonly cells = computed(() => this.bytes().map(hex));
}
