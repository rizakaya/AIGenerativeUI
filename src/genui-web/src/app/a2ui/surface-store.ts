import { Injectable, signal } from '@angular/core';

// Sunucudan gelen A2UI mesajlarını işleyen küçük "durum deposu".
//
// A2UI v0.9'da sunucu 4 tür mesaj gönderir. Bu prototipte 4'ünü de işliyoruz:
//   createSurface    -> yeni ekran aç, hangi katalog kullanılacak
//   updateComponents -> bileşenleri id'li DÜZ liste olarak ekle/güncelle
//   updateDataModel  -> veriyi bir yola (JSON Pointer) yaz
//   deleteSurface    -> ekranı sil

export interface A2uiComponent {
  id: string;
  component: string; // 'Card' | 'Table' | 'Chart' | 'Form' (katalog)
  [prop: string]: any; // bileşene özel özellikler
}

// Veri bağlama: { "path": "/products" }
export interface Binding {
  path: string;
}

// Kullanıcı bir aksiyon tetiklediğinde istemciden sunucuya giden mesaj.
export interface A2uiAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

// Angular'ın tanıdığı katalog. Sunucunun gönderdiği catalogId bununla eşleşmeli.
export const CATALOG_ID = 'https://aigenerativeui.local/catalogs/genui-v1.json';

@Injectable({ providedIn: 'root' })
export class SurfaceStore {
  readonly surfaceId = signal<string | null>(null);
  readonly components = signal(new Map<string, A2uiComponent>());
  readonly dataModel = signal<any>({});

  // Form bir aksiyon gönderdiğinde ne yapılacağını App belirler (API'ye POST).
  actionHandler?: (action: A2uiAction) => void;

  apply(messages: any[]): void {
    for (const msg of messages) {
      if (msg.createSurface) {
        if (msg.createSurface.catalogId !== CATALOG_ID) {
          throw new Error(`Bilinmeyen katalog: ${msg.createSurface.catalogId}`);
        }
        this.surfaceId.set(msg.createSurface.surfaceId);
        this.components.set(new Map());
        this.dataModel.set({});
      } else if (msg.updateComponents) {
        const next = new Map(this.components());
        for (const c of msg.updateComponents.components as A2uiComponent[]) next.set(c.id, c);
        this.components.set(next);
      } else if (msg.updateDataModel) {
        const { path = '/', value } = msg.updateDataModel;
        this.dataModel.set(setByPointer(this.dataModel(), path, value));
      } else if (msg.deleteSurface) {
        this.surfaceId.set(null);
        this.components.set(new Map());
        this.dataModel.set({});
      }
    }
  }

  get(id: string): A2uiComponent | undefined {
    return this.components().get(id);
  }

  // { "path": "/products" } -> data model'deki değer
  resolve(binding: Binding | undefined): any {
    return binding?.path ? getByPointer(this.dataModel(), binding.path) : undefined;
  }

  // Form alanları gibi girişler data model'e geri yazar (iki yönlü bağlama).
  write(path: string, value: unknown): void {
    this.dataModel.set(setByPointer(this.dataModel(), path, value));
  }

  sendAction(name: string, sourceComponentId: string, context: Record<string, unknown>): void {
    this.actionHandler?.({
      name,
      surfaceId: this.surfaceId() ?? '',
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context,
    });
  }
}

// --- JSON Pointer (RFC 6901) yardımcıları: "/a/b" -> obj.a.b ---

function parts(pointer: string): string[] {
  return pointer
    .split('/')
    .slice(1)
    .filter((p) => p !== '')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getByPointer(obj: any, pointer: string): any {
  return parts(pointer).reduce((cur, key) => cur?.[key], obj);
}

// Değiştirilemez (immutable) yazım: signal'in değiştiğini Angular anlasın diye kopya üretir.
function setByPointer(obj: any, pointer: string, value: unknown): any {
  const keys = parts(pointer);
  if (keys.length === 0) return value;
  const [head, ...rest] = keys;
  const copy = { ...(obj ?? {}) };
  copy[head] = setByPointer(copy[head], '/' + rest.join('/'), value);
  return copy;
}
