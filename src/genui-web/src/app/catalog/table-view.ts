import { Component, computed, inject, input } from '@angular/core';
import { A2uiComponent, SurfaceStore } from '../a2ui/surface-store';

// Katalog bileşeni: Table
// LLM'in verdiği tanım: { title, rows: { path }, columns: [ { header, field } ] }
// Satırlar tanımın içinde değil; data model'den "rows.path" ile okunur.
@Component({
  selector: 'table-view',
  template: `
    @if (def()['title']) {
      <h3>{{ def()['title'] }}</h3>
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
              <td [class.num]="isNumber(row[col.field])" [class.neg]="row[col.field] < 0">
                {{ format(row[col.field]) }}
              </td>
            }
          </tr>
        } @empty {
          <tr><td [attr.colspan]="columns().length">Veri yok</td></tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    h3 { margin: 8px 0; font-size: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .neg { color: #b42318; }
  `,
})
export class TableView {
  private readonly store = inject(SurfaceStore);
  readonly def = input.required<A2uiComponent>();

  protected readonly columns = computed(() => (this.def()['columns'] ?? []) as { header: string; field: string }[]);
  protected readonly rows = computed(() => (this.store.resolve(this.def()['rows']) ?? []) as any[]);

  protected isNumber(v: unknown): boolean {
    return typeof v === 'number';
  }

  protected format(v: unknown): string {
    return typeof v === 'number' ? v.toLocaleString('tr-TR') : String(v ?? '');
  }
}
