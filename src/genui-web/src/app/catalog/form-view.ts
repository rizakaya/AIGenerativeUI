import { Component, computed, inject, input } from '@angular/core';
import { A2uiComponent, SurfaceStore } from '../a2ui/surface-store';

interface FieldDef {
  name: string;
  label: string;
  type: string;
  options?: string[];
}

// Katalog bileşeni: Form
// LLM'in verdiği tanım: { title, fields: [...], submitLabel, action: { event: { name } } }
//
// İki yönlü bağlama: her alan data model'de /form/<alanAdı> yoluna bağlı.
// Kullanıcı seçim yaptığında değer sadece YEREL modele yazılır. Sunucuya ancak
// butona basınca, A2UI "action" mesajının "context"i olarak gider.
@Component({
  selector: 'form-view',
  template: `
    <form (submit)="submit($event)">
      @if (def()['title']) {
        <h3>{{ def()['title'] }}</h3>
      }
      @for (f of fields(); track f.name) {
        <label>
          {{ f.label }}
          @if (f.type === 'select') {
            <select [value]="value(f.name)" (change)="onInput(f.name, $event)">
              <option value="">Tümü</option>
              @for (o of f.options ?? []; track o) {
                <option [value]="o" [selected]="o === value(f.name)">{{ o }}</option>
              }
            </select>
          } @else {
            <input [value]="value(f.name)" (input)="onInput(f.name, $event)" />
          }
        </label>
      }
      <button type="submit">{{ def()['submitLabel'] || 'Gönder' }}</button>
    </form>
  `,
  styles: `
    form { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 8px 0; }
    h3 { width: 100%; margin: 0; font-size: 1rem; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
    select, input { padding: 6px 8px; border-radius: 6px; border: 1px solid #d0d7de; }
    button { padding: 7px 14px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
  `,
})
export class FormView {
  private readonly store = inject(SurfaceStore);
  readonly def = input.required<A2uiComponent>();

  protected readonly fields = computed(() => (this.def()['fields'] ?? []) as FieldDef[]);

  protected value(name: string): string {
    return this.store.resolve({ path: `/form/${name}` }) ?? '';
  }

  protected onInput(name: string, event: Event): void {
    this.store.write(`/form/${name}`, (event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    // context = formdaki değerler (gönderim anındaki data model'den okunur)
    const context: Record<string, unknown> = {};
    for (const f of this.fields()) context[f.name] = this.value(f.name);
    this.store.sendAction(this.def()['action']?.event?.name, this.def().id, context);
  }
}
