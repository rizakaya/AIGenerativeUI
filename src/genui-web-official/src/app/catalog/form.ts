import { Component, computed, inject, signal } from '@angular/core';
import { A2uiRendererService, CatalogComponent, createComponentImplementation } from '@a2ui/angular';
import { ActionSchema, ComponentApi, DataContext, DynamicStringSchema } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

const FormApi = {
  name: 'Form',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    fields: z.array(
      z.object({ name: z.string(), label: z.string(), type: z.string(), options: z.array(z.string()).optional() }),
    ),
    submitLabel: z.string().optional(),
    action: ActionSchema, // A2UI'nin resmi action tipi: { "event": { "name", "context" } }
  }),
} satisfies ComponentApi;

// Form alanları resmi data model'de /form/<alanAdı> yoluna yazılır.
// Gönderimde action'ı RESMİ yoldan iletiyoruz: DataContext.resolveAction context'teki
// { "path": "/form/category" } bağlamalarını çözer, surface.dispatchAction da
// A2UI action mesajını (name, surfaceId, sourceComponentId, timestamp, context) üretir.
@Component({
  selector: 'genui-form',
  template: `
    <form (submit)="submit($event)">
      @if (props()['title']?.value(); as title) {
        <h3>{{ title }}</h3>
      }
      @for (f of fields(); track f.name) {
        <label>
          {{ f.label }}
          <select (change)="onInput(f.name, $event)">
            <option value="" [selected]="!values()[f.name]">Tümü</option>
            @for (o of f.options ?? []; track o) {
              <option [value]="o" [selected]="o === values()[f.name]">{{ o }}</option>
            }
          </select>
        </label>
      }
      <button type="submit">{{ props()['submitLabel']?.value() || 'Gönder' }}</button>
    </form>
  `,
  styles: `
    form { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 8px 0; }
    h3 { width: 100%; margin: 0; font-size: 1rem; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
    select { padding: 6px 8px; border-radius: 6px; border: 1px solid #d0d7de; }
    button { padding: 7px 14px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
  `,
})
export class GenUiForm extends CatalogComponent<typeof FormApi> {
  private readonly renderer = inject(A2uiRendererService);
  private readonly surface = computed(() => this.renderer.surfaceGroup.getSurface(this.surfaceId()));

  protected readonly fields = computed(() => (this.props()['fields']?.value() ?? []) as any[]);
  // Seçili değerler (başlangıçta data model'deki /form/... değerleri)
  protected readonly values = computed(() => {
    const out: Record<string, string> = {};
    for (const f of this.fields()) out[f.name] = this.edited()[f.name] ?? this.surface()?.dataModel.get<string>(`/form/${f.name}`) ?? '';
    return out;
  });
  private readonly edited = signal<Record<string, string>>({});

  protected onInput(name: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.edited.update((e) => ({ ...e, [name]: value }));
    this.surface()?.dataModel.set(`/form/${name}`, value); // yerel data model'e yaz
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const surface = this.surface();
    const action: unknown = this.props()['action']?.value();
    if (!surface || !action) return;
    // Resmi renderer bazen action'ı hazır bir fonksiyon olarak verir (resmi Button ile aynı mantık).
    if (typeof action === 'function') {
      void (action as () => unknown)();
      return;
    }
    const resolved = new DataContext(surface, this.dataContextPath()).resolveAction(action as any);
    surface.dispatchAction(resolved, this.componentId());
  }
}

export const formDeclaration = createComponentImplementation(FormApi, GenUiForm);
