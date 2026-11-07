import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular';
import { A2uiClientAction } from '@a2ui/web_core/v0_9';
import { ActionBus } from './action-bus';

const API = 'http://localhost:5080/api/ui';

// İlk uygulamayla (genui-web) aynı sayfa. Fark: ekranı bizim renderer'ımız değil,
// Google'ın resmi @a2ui/angular renderer'ı çiziyor. API hiç değişmeden aynı mesajları gönderiyor.
@Component({
  selector: 'app-root',
  imports: [SurfaceComponent, JsonPipe],
  template: `
    <main>
      <h1>Generative UI · resmi A2UI renderer</h1>
      <p class="hint">Aynı API, aynı mesajlar. Ekranı bu sefer <code>&#64;a2ui/angular</code> çiziyor.</p>

      <div class="ask">
        <textarea [value]="prompt()" (input)="prompt.set($any($event.target).value)" rows="3"></textarea>
        <button (click)="ask()" [disabled]="loading()">{{ loading() ? 'LLM düşünüyor…' : 'Ekranı oluştur' }}</button>
      </div>

      @if (error()) {
        <pre class="error">{{ error() }}</pre>
      }

      @if (hasSurface()) {
        <!-- Resmi renderer: surfaceId verilir, gerisini kütüphane yapar (root'tan başlayıp çizer). -->
        <a2ui-v09-surface surfaceId="main" />
      }

      @if (lastResponse()) {
        <details>
          <summary>LLM'in ürettiği ham çıktı ({{ lastResponse().llmOutputs.length }} deneme)</summary>
          @for (o of lastResponse().llmOutputs; track $index) {
            <pre>{{ o }}</pre>
          }
        </details>
        <details>
          <summary>Renderer'a verilen A2UI mesajları</summary>
          <pre>{{ lastResponse().messages | json }}</pre>
        </details>
      }
      @if (lastAction()) {
        <details>
          <summary>Resmi renderer'ın ürettiği A2UI action mesajı</summary>
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
  private readonly renderer = inject(A2uiRendererService);
  protected readonly prompt = signal(
    'Son üç ayın satışlarını karşılaştır. Beklenenden düşük performans gösteren ürünleri ayrıca göster.',
  );
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly hasSurface = signal(false);
  protected readonly lastResponse = signal<any>(null);
  protected readonly lastAction = signal<A2uiClientAction | null>(null);

  constructor() {
    inject(ActionBus).handler = (action) => {
      this.lastAction.set(action);
      this.ask(action);
    };
  }

  protected async ask(action?: A2uiClientAction): Promise<void> {
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
      // Aynı surfaceId ile yeniden createSurface göndermeden önce eskisini sil (A2UI kuralı).
      if (this.hasSurface()) {
        this.renderer.processMessages([{ version: 'v0.9.1', deleteSurface: { surfaceId: 'main' } }]);
        this.hasSurface.set(false);
      }
      this.renderer.processMessages(body.messages); // <-- işin tamamı burada resmi kütüphanede
      this.hasSurface.set(true);
    } catch (e) {
      this.error.set(`Hata: ${e}`);
    } finally {
      this.loading.set(false);
    }
  }
}
