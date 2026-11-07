import { Component, computed } from '@angular/core';
import { CatalogComponent, createComponentImplementation } from '@a2ui/angular';
import { ComponentApi, DynamicStringSchema, DynamicValueSchema } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

const ChartApi = {
  name: 'Chart',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    type: z.literal('bar').optional(),
    data: DynamicValueSchema, // { "path": "/monthlyTotals" }
    labelField: z.string(),
    valueFields: z.array(z.string()),
  }),
} satisfies ComponentApi;

// Gruplu çubuk grafik, düz SVG (ilk uygulamadaki chart-view.ts ile aynı çizim).
@Component({
  selector: 'genui-chart',
  template: `
    @if (props()['title']?.value(); as title) {
      <h3>{{ title }}</h3>
    }
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img">
      <line [attr.x1]="PAD" [attr.x2]="W - 10" [attr.y1]="H - BOTTOM" [attr.y2]="H - BOTTOM" stroke="#9ca3af" />
      @for (bar of bars(); track $index) {
        <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h" [attr.fill]="bar.color">
          <title>{{ bar.label }} · {{ bar.series }}: {{ bar.value.toLocaleString('tr-TR') }}</title>
        </rect>
      }
      @for (g of groups(); track $index) {
        <text [attr.x]="g.x" [attr.y]="H - BOTTOM + 16" text-anchor="middle" font-size="12">{{ g.label }}</text>
      }
      <text [attr.x]="PAD - 6" y="18" text-anchor="end" font-size="11" fill="#6b7280">{{ max().toLocaleString('tr-TR') }}</text>
    </svg>
    <div class="legend">
      @for (s of series(); track s; let i = $index) {
        <span><i [style.background]="COLORS[i % COLORS.length]"></i>{{ s }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    h3 { margin: 8px 0; font-size: 1rem; }
    svg { width: 100%; max-width: 720px; height: auto; display: block; }
    .legend { display: flex; gap: 16px; font-size: 0.85rem; margin-top: 4px; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
  `,
})
export class GenUiChart extends CatalogComponent<typeof ChartApi> {
  protected readonly W = 600;
  protected readonly H = 260;
  protected readonly PAD = 60;
  protected readonly BOTTOM = 30;
  protected readonly COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6'];

  protected readonly rows = computed(() => (this.props()['data']?.value() ?? []) as any[]);
  protected readonly series = computed(() => (this.props()['valueFields']?.value() ?? []) as string[]);
  private readonly labelField = computed(() => (this.props()['labelField']?.value() ?? '') as string);
  protected readonly max = computed(() =>
    Math.max(1, ...this.rows().flatMap((r) => this.series().map((s) => Number(r[s]) || 0))),
  );

  protected readonly groups = computed(() => {
    const n = this.rows().length || 1;
    const groupW = (this.W - this.PAD - 10) / n;
    return this.rows().map((r, i) => ({
      label: String(r[this.labelField()] ?? ''),
      x: this.PAD + groupW * i + groupW / 2,
      left: this.PAD + groupW * i,
      groupW,
    }));
  });

  protected readonly bars = computed(() => {
    const plotH = this.H - this.BOTTOM - 20;
    const s = this.series();
    return this.groups().flatMap((g, i) => {
      const barW = (g.groupW * 0.7) / Math.max(1, s.length);
      return s.map((field, j) => {
        const value = Number(this.rows()[i][field]) || 0;
        const h = (Math.max(0, value) / this.max()) * plotH;
        return {
          x: g.left + g.groupW * 0.15 + barW * j,
          y: this.H - this.BOTTOM - h,
          w: barW - 2,
          h,
          color: this.COLORS[j % this.COLORS.length],
          label: g.label,
          series: field,
          value,
        };
      });
    });
  });
}

export const chartDeclaration = createComponentImplementation(ChartApi, GenUiChart);
