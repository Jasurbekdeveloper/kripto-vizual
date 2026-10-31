import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ALGORITHMS, byTopic, TOPICS } from '../algorithms/registry';

@Component({
  selector: 'kv-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <h1>Zamonaviy kriptografiya — interaktiv vizualizator</h1>
      <p>Har bir algoritmni o‘z ma’lumotlaringiz bilan ishga tushiring va har bir qadamni — formula, jadval, matritsa va bitlar darajasida kuzating.
        Natijalar rasmiy test vektorlari (FIPS-197, GOST R 34.12-2015, FIPS 180-4, DES) bilan tekshirilgan.</p>
      <div class="stats"><div><b>{{ topicsWithAlgos }}</b><span>mavzu</span></div><div><b>{{ total }}</b><span>algoritm</span></div><div><b>←→</b><span>qadamma-qadam</span></div></div>
    </section>
    <div class="topic-grid">
      @for (t of topics; track t.n) {
        @let list = algos(t.n);
        <section class="card topic" [class.muted]="!list.length">
          <div class="topic-head"><span class="badge">{{ t.n }}</span><h2>{{ t.title }}</h2></div>
          @if (list.length) {
            <ul>
              @for (a of list; track a.id) {
                <li><a [routerLink]="['/algo', a.id]"><b>{{ a.name }}</b><small>{{ a.short }}</small></a></li>
              }
            </ul>
          } @else {
            <p class="soon">Bu mavzu uchun algoritm hali qo‘shilmagan — <code>registry.ts</code> ga qo‘shing.</p>
          }
        </section>
      }
    </div>
  `,
})
export class HomePage {
  topics = TOPICS;
  total = ALGORITHMS.length;
  topicsWithAlgos = TOPICS.filter((t) => byTopic(t.n).length).length;
  algos = byTopic;
}
