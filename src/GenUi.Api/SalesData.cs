using System.Text.Json.Nodes;

namespace GenUi.Api;

// Sahte satış verisi. Gerçek hayatta bu bir veritabanından gelir.
//
// Önemli fikir: LLM bu veriyi KOPYALAMAZ. LLM sadece "hangi tablo, hangi grafik,
// hangi veri yoluna bağlı" kararını verir. Veriyi API kendisi updateDataModel
// mesajıyla gönderir. Yapı (bileşenler) ile veri ayrı yolculuk eder.
public static class SalesData
{
    public static readonly string[] Months = ["Ağustos", "Eylül", "Ekim"];
    public static readonly string[] MonthKeys = ["aug", "sep", "oct"]; // /products içindeki aylık alanlar
    public static readonly string[] Categories = ["Elektronik", "Mobilya", "Kırtasiye"];

    // Ürün, kategori, 3 aylık ciro ve aylık hedef (TL)
    private static readonly (string Product, string Category, int[] Revenue, int MonthlyTarget)[] Rows =
    [
        ("Dizüstü Bilgisayar", "Elektronik", [420_000, 450_000, 470_000], 440_000),
        ("Kulaklık",           "Elektronik", [ 60_000,  48_000,  41_000],  55_000),
        ("Monitör",            "Elektronik", [150_000, 162_000, 158_000], 150_000),
        ("Ofis Sandalyesi",    "Mobilya",    [ 90_000,  85_000,  70_000],  85_000),
        ("Çalışma Masası",     "Mobilya",    [120_000, 131_000, 140_000], 120_000),
        ("Kitaplık",           "Mobilya",    [ 30_000,  26_000,  22_000],  30_000),
        ("Defter",             "Kırtasiye",  [ 18_000,  25_000,  31_000],  20_000),
        ("Kalem Seti",         "Kırtasiye",  [ 12_000,   9_000,   8_000],  11_000),
    ];

    // LLM'e anlatacağımız veri setleri: yol -> alanlar.
    // Hem prompt'ta hem de doğrulamada (Catalog.Validate) bu liste kullanılır.
    public static readonly Dictionary<string, string[]> Datasets = new()
    {
        ["/monthlyTotals"]   = ["month", "revenue", "target"],
        ["/products"]        = ["product", "category", "aug", "sep", "oct", "total", "target", "gap"],
        ["/underperformers"] = ["product", "category", "aug", "sep", "oct", "total", "target", "gap"],
    };

    // Data model'i (JSON) üretir.
    //  category: doluysa sadece o kategori (Form'dan gelir)
    //  months:   LLM'in seçtiği aylar (ör. "son 2 ay" -> Eylül, Ekim). Toplam/hedef/fark bu aylara göre hesaplanır.
    public static JsonObject Build(string? category, string[] months)
    {
        var idx = Enumerable.Range(0, Months.Length).Where(i => months.Contains(Months[i])).ToArray();
        var rows = Rows.Where(r => string.IsNullOrEmpty(category) || r.Category == category).ToList();

        var products = new JsonArray();
        var underperformers = new JsonArray();
        foreach (var r in rows)
        {
            int total = idx.Sum(i => r.Revenue[i]);
            int target = r.MonthlyTarget * idx.Length;
            var item = new JsonObject { ["product"] = r.Product, ["category"] = r.Category };
            foreach (var i in idx) item[MonthKeys[i]] = r.Revenue[i]; // sadece seçilen aylar
            item["total"] = total;
            item["target"] = target;
            item["gap"] = total - target; // eksi ise hedefin altında
            products.Add(item);
            if (total < target) underperformers.Add(item.DeepClone());
        }

        var monthlyTotals = new JsonArray();
        foreach (var m in idx)
        {
            monthlyTotals.Add(new JsonObject
            {
                ["month"] = Months[m],
                ["revenue"] = rows.Sum(r => r.Revenue[m]),
                ["target"] = rows.Sum(r => r.MonthlyTarget),
            });
        }

        return new JsonObject
        {
            ["monthlyTotals"] = monthlyTotals,
            ["products"] = products,
            ["underperformers"] = underperformers,
            // Form alanları /form/<alanAdı> yoluna bağlanır; başlangıç değerleri burada.
            ["form"] = new JsonObject { ["category"] = category ?? "" },
        };
    }
}
