import { Component, computed, inject, input } from '@angular/core';
import { SurfaceStore } from './surface-store';
import { TableView } from '../catalog/table-view';
import { ChartView } from '../catalog/chart-view';
import { FormView } from '../catalog/form-view';

// RENDERER'IN KALBİ
//
// Bir id alır, düz listeden o bileşeni bulur ve türüne göre GERÇEK Angular
// bileşenini çizer. Card bir kapsayıcıdır: çocuklarının id'leri için kendini
// tekrar çağırır (özyineleme). Böylece düz liste ekranda bir ağaca dönüşür.
//
// Güvenlik: @switch içinde sadece katalogdaki 4 tür var. LLM başka bir şey
// isterse (ör. "Script", "Iframe") hiçbir şey çalıştırılmaz, uyarı kutusu çıkar.
@Component({
  selector: 'a2ui-node',
  imports: [TableView, ChartView, FormView],
  template: `
    @if (node(); as c) {
      @switch (c.component) {
        @case ('Card') {
          <section class="card">
            @if (c['title']) {
              <h2>{{ c['title'] }}</h2>
            }
            @for (childId of c['children'] ?? []; track childId) {
              <a2ui-node [nodeId]="childId" />
            }
          </section>
        }
        @case ('Table') {
          <table-view [def]="c" />
        }
        @case ('Chart') {
          <chart-view [def]="c" />
        }
        @case ('Form') {
          <form-view [def]="c" />
        }
        @default {
          <div class="unknown">Katalogda olmayan bileşen reddedildi: "{{ c.component }}"</div>
        }
      }
    } @else {
      <!-- A2UI: bileşen henüz gelmemiş olabilir (streaming). Yer tutucu göster. -->
      <div class="placeholder">"{{ nodeId() }}" bekleniyor…</div>
    }
  `,
  styles: `
    .card { border: 1px solid #d0d7de; border-radius: 10px; padding: 16px; margin: 12px 0; background: #fff; }
    .card .card { background: #f8fafc; }
    h2 { margin: 0 0 8px; font-size: 1.1rem; }
    .unknown { color: #b42318; border: 1px dashed #b42318; padding: 8px; border-radius: 6px; }
    .placeholder { color: #888; font-style: italic; }
  `,
})
export class A2uiNode {
  private readonly store = inject(SurfaceStore);
  readonly nodeId = input.required<string>();
  protected readonly node = computed(() => this.store.get(this.nodeId()));
}
