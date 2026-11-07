# AIGenerativeUI: Generative UI prototipi

Kullanıcı ne görmek istediğini doğal dille yazar. LLM ekranı kod olarak değil, **veri (JSON)** olarak tarif eder. Angular bu tarifi gerçek bileşenlere çevirir. LLM yalnızca güvenilir katalogdaki 4 bileşeni kullanabilir: **Card, Table, Chart, Form**. JSON biçimi Google'ın **A2UI v0.9.1** mesajlarını izler.

## Ne öğreniyoruz, kodda nerede?

| Kavram | Dosya |
|---|---|
| 1. Arayüz bir veridir: LLM HTML/JS yazmaz, JSON üretir | `GenUi.Api/Catalog.cs` → `SystemPrompt()` |
| 2. Güvenilir katalog: katalog dışı bileşen reddedilir | `Catalog.Validate()` (sunucu) ve `a2ui-node.ts` içindeki `@switch` (istemci) |
| 3. Düz liste + id referansları (`root`, `children`) | `a2ui-node.ts` (düz listeyi özyinelemeyle ağaca çevirir) |
| 4. Bileşen ile verinin ayrılması (`{"path": "/products"}`). LLM hangi veriyi istediğini söyler (`"months"`), veriyi API hazırlar | `SalesData.cs` → `Build()` ve `surface-store.ts` → `resolve()` |
| 5. Geri dönüş: Form'un butonu A2UI `action` mesajı gönderir, ekran yeniden tasarlanır | `form-view.ts` → `submit()`, `Program.cs` |
| 6. Renderer: JSON'u Angular bileşenine çeviren "tercüman" | `surface-store.ts` ve `a2ui-node.ts` |

Akış:

```
Kullanıcı metni ──► POST /api/ui ──► Ollama (katalog + veri setleri prompt'ta)
                                        │  { "months": [...], "components": [...] }
                                        ▼
                     Catalog.Validate ── hata varsa LLM'e geri gönder (en fazla 3 deneme)
                                        ▼
       A2UI mesajları: createSurface → updateComponents (LLM) → updateDataModel (API)
                                        ▼
            Angular: SurfaceStore.apply() → <a2ui-node nodeId="root"> → Card/Table/Chart/Form
                                        │
      Form "Uygula" ──► A2UI action { name, surfaceId, sourceComponentId, timestamp, context } ──► POST /api/ui
```

## İki frontend, aynı API

| Uygulama | Port | Ekranı kim çiziyor? |
|---|---|---|
| `src/genui-web` | 4200 | Bizim elle yazdığımız renderer (`surface-store.ts`, `a2ui-node.ts`): mekanizmayı görmek için |
| `src/genui-web-official` | 4300 | Google'ın resmi `@a2ui/angular` renderer'ı: formatı doğru uyguladığımızı test etmek için |

Resmi renderer'da A2UI işlerini (mesajları işleme, `root`'tan çizme, `{"path": ...}` bağlamalarını çözme, action mesajını üretme) kütüphane yapıyor. Bizim yazdığımız şey sadece özel kataloğumuz: `src/genui-web-official/src/app/catalog/` altındaki Card, Table, Chart, Form ve `genui-catalog.ts`. Bileşen şemaları A2UI'nin resmi tipleriyle (`ChildListSchema`, `DynamicValueSchema`, `ActionSchema`) zod ile tanımlı.

## Çalıştırma

1. Ollama'da model hazır olsun: `ollama pull qwen2.5:7b` (model `GenUi.Api/appsettings.json` içinde değiştirilebilir)
2. API: `cd src/GenUi.Api` ve `dotnet run` (http://localhost:5080)
3. Web: `cd src/genui-web`, `npm install`, ardından `npm start` (http://localhost:4200)
4. Resmi renderer ile: `cd src/genui-web-official`, `npm install`, ardından `npm start` (http://localhost:4300)

`GenUi.Api.http` dosyasıyla API'yi tarayıcı olmadan da deneyebilirsin.

## Bilinçli sadeleştirmeler

- Table ve Chart, A2UI'nin hazır Basic Catalog'unda yok. Bu yüzden kendi kataloğumuzu tanımladık (A2UI buna izin veriyor).
- `genui-web` hazır renderer kullanmıyor ki mekanizma görünsün; `genui-web-official` aynı mesajları resmi `@a2ui/angular` (0.14.0) ile çiziyor.
- Streaming yok: tüm mesajlar tek bir HTTP cevabında geliyor. Gerçek A2UI'de bunlar bir akış (stream) olarak gelir.
- Form yalnızca `category` alanını destekliyor, çünkü sunucunun anladığı filtre sadece bu.
