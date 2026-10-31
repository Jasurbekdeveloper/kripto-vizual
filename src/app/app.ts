import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { byTopic, TOPICS } from './algorithms/registry';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  topics = TOPICS.filter((t) => byTopic(t.n).length);
  algos = byTopic;
  menu = signal(false);
  dark = signal(this.initTheme());

  private initTheme(): boolean {
    let d = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    try { const s = localStorage.getItem('kv-theme'); if (s) d = s === 'dark'; } catch {}
    document.documentElement.dataset['theme'] = d ? 'dark' : 'light';
    return d;
  }
  toggleTheme(): void {
    const d = !this.dark();
    this.dark.set(d);
    document.documentElement.dataset['theme'] = d ? 'dark' : 'light';
    try { localStorage.setItem('kv-theme', d ? 'dark' : 'light'); } catch {}
  }
}
