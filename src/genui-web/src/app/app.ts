import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { A2uiAction, SurfaceStore } from './a2ui/surface-store';
import { A2uiNode } from './a2ui/a2ui-node';

const API = 'http://localhost:5080/api/ui';

// Tek sayfa: kullanıcı ne istediğini yazar, API'den A2UI mesajları gelir,
// SurfaceStore bunları işler, <a2ui-node nodeId="root"> ekranı çizer.
@Component({
  selector: 'app-root',
  imports: [A2uiNode, JsonPipe],
  template: `
    <main>
      <h1>Generative UI denemesi</h1>
      <p class="hint">Ne görmek istediğini yaz. Ekranı LLM tasarlar, ama sadece Card, Table, Chart ve Form kullanabilir.</p>

      <div class="ask">
        <textarea [value]="prompt()" (input)="prompt.set($any($event.target).value)" rows="3"></textarea>
        <button (click)="ask()" [disabled]="loading()">{{ loading() ? 'LLM düşünüyor…' : 'Ekranı oluştur' }}</button>
      </div>

      @if (error()) {
        <pre class="error">{{ error() }}</pre>
      }

      @if (store.surfaceId()) {
        <a2ui-node nodeId="root" />
      }

      @if (lastResponse()) {
        <details>
          <summary>LLM'in ürettiği ham çıktı ({{ lastResponse().llmOutputs.length }} deneme)</summary>
          @for (o of lastResponse().llmOutputs; track $index) {
            <pre>{{ o }}</pre>
          }
        </details>
        <details>
          <summary>Angular'a gelen A2UI mesajları</summary>
          <pre>{{ lastResponse().messages | json }}</pre>
        </details>
      }
      @if (lastAction()) {
        <details>
          <summary>Sunucuya giden son A2UI action mesajı</summary>
          <pre>{{ lastAction() | json }}</pre>
        </details>
      }
    </main>
  `,
  styles: `
    main { max-width: 960px; margin: 0 auto; padding: 24px 16px; font-family: system-ui, sans-serif; color: #111827; }
    h1 { margin: 0 0 4px; }
    .hint { color: #6b7280; margin: 0 0 16px; }
    .ask { display: flex; gap: 8px; align-items: stretch; }
    textarea { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #d0d7de; font: inherit; }
    button { padding: 0 16px; border: 0; border-radius: 8px; background: #111827; color: #fff; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: wait; }
    .error { color: #b42318; background: #fef3f2; padding: 12px; border-radius: 8px; white-space: pre-wrap; }
    details { margin-top: 12px; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 8px; overflow: auto; font-size: 0.8rem; max-height: 400px; }
  `,
})
export class App {
  protected readonly store = inject(SurfaceStore);
  protected readonly prompt = signal(
    'Son üç ayın satışlarını karşılaştır. Beklenenden düşük performans gösteren ürünleri ayrıca göster.',
  );
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly lastResponse = signal<any>(null);
  protected readonly lastAction = signal<A2uiAction | null>(null);

  constructor() {
    // Form'daki butona basılınca A2UI action mesajı buraya gelir ve API'ye gönderilir.
    this.store.actionHandler = (action) => {
      this.lastAction.set(action);
      this.ask(action);
    };
  }

  protected async ask(action?: A2uiAction): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.prompt(), action }),
      });
      const body = await res.json();
      this.lastResponse.set(body.messages ? body : { messages: [], llmOutputs: body.llmOutputs ?? [] });
      if (!res.ok) {
        this.error.set('LLM geçerli bir ekran üretemedi:\n- ' + (body.errors ?? [res.statusText]).join('\n- '));
        return;
      }
      this.store.apply(body.messages);
    } catch (e) {
      this.error.set(`API'ye ulaşılamadı (${API}). GenUi.Api çalışıyor mu?\n${e}`);
    } finally {
      this.loading.set(false);
    }
  }
}
