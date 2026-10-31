import { Component, HostListener, computed, effect, inject, input, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { byId, byTopic, TOPICS } from '../algorithms/registry';
import { RunResult } from '../core/models';
import { VisualComponent } from '../components/visual.component';

@Component({
  selector: 'kv-algorithm-page',
  imports: [FormsModule, VisualComponent, RouterLink],
  templateUrl: './algorithm.page.html',
})
export class AlgorithmPage implements OnDestroy {
  id = input.required<string>();
  algo = computed(() => byId(this.id()));
  topic = computed(() => TOPICS.find((t) => t.n === this.algo()?.topic));
  siblings = computed(() => (this.algo() ? byTopic(this.algo()!.topic) : []));

  values: Record<string, string> = {};
  result = signal<RunResult | null>(null);
  error = signal<string>('');
  idx = signal(0);
  showAll = signal(false);
  playing = signal(false);
  speed = signal(1800);
  private timer: ReturnType<typeof setInterval> | null = null;

  step = computed(() => this.result()?.steps[this.idx()]);
  total = computed(() => this.result()?.steps.length ?? 0);
  progress = computed(() => (this.total() ? ((this.idx() + 1) / this.total()) * 100 : 0));

  constructor() {
    effect(() => {
      const a = this.algo();
      this.stop();
      this.result.set(null);
      this.error.set('');
      this.values = {};
      a?.fields.forEach((f) => (this.values[f.key] = f.default));
      if (a) queueMicrotask(() => this.run());
    });
  }

  example(v: Record<string, string>): void {
    this.values = { ...this.values, ...v };
    this.run();
  }

  run(): void {
    const a = this.algo();
    if (!a) return;
    this.stop();
    try {
      this.result.set(a.run({ ...this.values }));
      this.error.set('');
      this.idx.set(0);
    } catch (e) {
      this.result.set(null);
      this.error.set((e as Error).message);
    }
  }

  go(i: number): void { this.idx.set(Math.max(0, Math.min(this.total() - 1, i))); }
  next(): void { if (this.idx() < this.total() - 1) this.idx.update((x) => x + 1); else this.stop(); }
  prev(): void { this.go(this.idx() - 1); }

  toggle(): void {
    if (this.playing()) return this.stop();
    if (this.idx() >= this.total() - 1) this.idx.set(0);
    this.playing.set(true);
    this.timer = setInterval(() => this.next(), this.speed());
  }
  stop(): void {
    this.playing.set(false);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  setSpeed(ms: number): void { this.speed.set(ms); if (this.playing()) { this.stop(); this.toggle(); } }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if (e.key === 'ArrowRight') { this.next(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { this.prev(); e.preventDefault(); }
    if (e.key === ' ') { this.toggle(); e.preventDefault(); }
  }

  ngOnDestroy(): void { this.stop(); }
}
