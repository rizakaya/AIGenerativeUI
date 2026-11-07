import { Component, computed } from '@angular/core';
import { CatalogComponent, ComponentHostComponent, createComponentImplementation } from '@a2ui/angular';
import { ChildListSchema, ComponentApi, DynamicStringSchema } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

// Bizim Card'ımızın şeması (zod). Resmi renderer, LLM'in gönderdiği özellikleri
// bu şemaya göre doğrular ve "props()" olarak bileşene verir.
const CardApi = {
  name: 'Card',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    children: ChildListSchema.optional(), // A2UI'nin resmi "çocuk listesi" tipi
  }),
} satisfies ComponentApi;

@Component({
  selector: 'genui-card',
  imports: [ComponentHostComponent],
  template: `
    <section class="card">
      @if (props()['title']?.value(); as title) {
        <h2>{{ title }}</h2>
      }
      <!-- Çocukları RESMİ renderer çiziyor: id'yi verip "bunu çiz" diyoruz. -->
      @for (child of children(); track $index) {
        <a2ui-v09-component-host [surfaceId]="surfaceId()" [componentKey]="child" />
      }
    </section>
  `,
  styles: `
    .card { border: 1px solid #d0d7de; border-radius: 10px; padding: 16px; margin: 12px 0; background: #fff; display: block; }
    h2 { margin: 0 0 8px; font-size: 1.1rem; }
  `,
})
export class GenUiCard extends CatalogComponent<typeof CardApi> {
  protected readonly children = computed(() => (this.props()['children']?.value() ?? []) as any[]);
}

export const cardDeclaration = createComponentImplementation(CardApi, GenUiCard);
