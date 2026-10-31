import { Component, computed, input } from '@angular/core';
import { Visual } from '../core/models';

/** Bitta vizual blokni chizuvchi komponent. Yangi Visual turi qo'shilsa — shu yerga @case qo'shing. */
@Component({
  selector: 'kv-visual',
  template: `
    @let v = visual();
    @switch (v.kind) {
      @case ('kv') {
        <div class="kv">
          @for (it of v.items; track $index) {
            <div class="kv-item" [class.hl]="it.hl"><span>{{ it.label }}</span><b>{{ it.value }}</b></div>
          }
        </div>
      }
      @case ('formula') { <div class="formula">{{ v.text }}</div> }
      @case ('note') { <div class="note" [class]="'note ' + (v.tone ?? 'info')">{{ v.text }}</div> }
      @case ('table') {
        <div class="table-wrap">
          @if (v.caption) { <div class="cap">{{ v.caption }}</div> }
          <table>
            <thead><tr>@for (h of v.headers; track $index) { <th>{{ h }}</th> }</tr></thead>
            <tbody>
              @for (r of v.rows; track $index; let ri = $index) {
                <tr [class.hl]="v.hlRows?.includes(ri)">
                  @for (c of r; track $index; let ci = $index) { <td [class.hlc]="isHlCell(v.hlCells, ri, ci)">{{ c }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @case ('grids') {
        <div class="grids">
          @for (g of v.items; track $index; let gi = $index) {
            <div class="grid-box" [class]="'grid-box tone-' + (g.tone ?? 'gray')">
              <div class="grid-title">{{ g.title }}</div>
              <div class="grid" [style.grid-template-columns]="'repeat(' + (g.cells[0]?.length ?? 1) + ', auto)'">
                @for (row of g.cells; track $index; let r = $index) {
                  @for (cell of row; track $index; let c = $index) {
                    <div class="cell" [class.hl]="isHlCell(g.hl, r, c)">{{ cell }}</div>
                  }
                }
              </div>
            </div>
            @if (v.ops && gi < v.items.length - 1) { <div class="op">{{ v.ops[gi] }}</div> }
          }
        </div>
      }
      @case ('bytes') {
        <div class="bytes-box">
          @if (v.title) { <div class="cap">{{ v.title }}</div> }
          <div class="bytes">
            @for (b of v.bytes; track $index; let i = $index) {
              <div class="byte" [class.hl]="v.hl?.includes(i)">
                <span>{{ b }}</span>
                @if (v.labels) { <small>{{ v.labels[i] }}</small> }
              </div>
            }
          </div>
        </div>
      }
      @case ('bits') {
        <div class="bits">
          @for (r of v.rows; track $index) {
            <div class="bits-row" [class.sep]="r.sep">
              <span class="lbl">{{ r.label }}</span>
              <span class="b">
                @for (ch of split(r.bits); track $index; let i = $index) {
                  <i [class.on]="ch === '1'" [class.hl]="r.hl?.includes(bitIndex(r.bits, i))" [class.sp]="ch === ' '">{{ ch }}</i>
                }
              </span>
            </div>
          }
        </div>
      }
      @case ('chars') {
        <div class="chars">
          @for (r of v.rows; track $index) {
            <div class="chars-row">
              <span class="lbl">{{ r.label }}</span>
              @for (c of r.chars; track $index; let i = $index) { <span class="ch" [class.hl]="r.hl?.includes(i)">{{ c }}</span> }
            </div>
          }
        </div>
      }
      @case ('flow') {
        <div class="flow">
          @for (n of v.nodes; track $index; let i = $index) {
            <div class="flow-node" [class.active]="v.active === i">{{ n }}</div>
            @if (i < v.nodes.length - 1) { <div class="flow-arrow">→</div> }
          }
        </div>
      }
      @case ('plot') {
        <div class="plot">
          <svg [attr.viewBox]="'-30 -10 ' + (W + 40) + ' ' + (W + 40)">
            @for (t of ticks(v.p); track t) {
              <line [attr.x1]="sx(v.p, t)" [attr.x2]="sx(v.p, t)" y1="0" [attr.y2]="W" class="gl" />
              <line x1="0" [attr.x2]="W" [attr.y1]="sy(v.p, t)" [attr.y2]="sy(v.p, t)" class="gl" />
              <text [attr.x]="sx(v.p, t)" [attr.y]="W + 16" class="tk">{{ t }}</text>
              <text x="-8" [attr.y]="sy(v.p, t) + 4" class="tk" text-anchor="end">{{ t }}</text>
            }
            @for (pt of v.points; track $index) { <circle [attr.cx]="sx(v.p, pt[0])" [attr.cy]="sy(v.p, pt[1])" r="3.2" class="pt" /> }
            @for (pt of v.hl ?? []; track $index; let i = $index) {
              <circle [attr.cx]="sx(v.p, pt[0])" [attr.cy]="sy(v.p, pt[1])" r="7" class="pt-hl" [attr.data-i]="i" />
              <text [attr.x]="sx(v.p, pt[0]) + 9" [attr.y]="sy(v.p, pt[1]) - 8" class="pt-lbl">({{ pt[0] }},{{ pt[1] }})</text>
            }
          </svg>
          @if (v.title) { <div class="cap">{{ v.title }}</div> }
        </div>
      }
    }
  `,
})
export class VisualComponent {
  visual = input.required<Visual>();
  readonly W = 360;
  split = (s: string) => s.split('');
  /** probellarni hisobga olmagan holda bit indeksi */
  bitIndex = (s: string, i: number) => s.slice(0, i).replace(/ /g, '').length;
  isHlCell = (hl: [number, number][] | undefined, r: number, c: number) => !!hl?.some(([a, b]) => a === r && b === c);
  sx = (p: number, x: number) => (x / (p - 1 || 1)) * this.W;
  sy = (p: number, y: number) => this.W - (y / (p - 1 || 1)) * this.W;
  ticks = (p: number) => { const step = Math.max(1, Math.ceil(p / 10)); const t: number[] = []; for (let i = 0; i < p; i += step) t.push(i); return t; };
}
