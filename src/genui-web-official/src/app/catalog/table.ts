import { Component, computed } from '@angular/core';
import { CatalogComponent, createComponentImplementation } from '@a2ui/angular';
import { ComponentApi, DynamicStringSchema, DynamicValueSchema } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

const TableApi = {
  name: 'Table',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    rows: DynamicValueSchema, // { "path": "/products" } -> resmi renderer veriyi kendisi çözer
    columns: z.array(z.object({ header: z.string(), field: z.string() })),
  }),
} satisfies ComponentApi;

@Component({
  selector: 'genui-table',
  template: `
    @if (props()['title']?.value(); as title) {
      <h3>{{ title }}</h3>
    }
    <table>
      <thead>
        <tr>
          @for (col of columns(); track $index) {
            <th>{{ col.header }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index) {
          <tr>
            @for (col of columns(); track $index) {
              <td [class.num]="isNumber(row[col.field])" [class.neg]="row[col.field] < 0">{{ format(row[col.field]) }}</td>
            }
          </tr>
        } @empty {
          <tr><td [attr.colspan]="columns().length">Veri yok</td></tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host { display: block; }
    h3 { margin: 8px 0; font-size: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .neg { color: #b42318; }
  `,
})
export class GenUiTable extends CatalogComponent<typeof TableApi> {
  protected readonly columns = computed(() => (this.props()['columns']?.value() ?? []) as { header: string; field: string }[]);
  protected readonly rows = computed(() => (this.props()['rows']?.value() ?? []) as any[]);

  protected isNumber(v: unknown): boolean {
    return typeof v === 'number';
  }

  protected format(v: unknown): string {
    return typeof v === 'number' ? v.toLocaleString('tr-TR') : String(v ?? '');
  }
}

export const tableDeclaration = createComponentImplementation(TableApi, GenUiTable);
