using System.Text.Json.Nodes;

namespace GenUi.Api;

// GÜVENİLİR BİLEŞEN KATALOĞU
//
// Generative UI'nin güvenlik fikri burada: LLM serbestçe HTML/JS yazamaz,
// yalnızca bu katalogdaki 4 bileşenden seçim yapabilir. Angular tarafında da
// sadece bu 4 bileşenin çizicisi var. Katalog dışı bir şey gelirse reddedilir.
//
// Not: A2UI'nin hazır "Basic Catalog"unda Table ve Chart yok. A2UI özel katalog
// tanımlamaya izin verir; bu bizim özel kataloğumuz.
public static class Catalog
{
    // A2UI'de katalog bir id ile tanımlanır (URI biçiminde ama erişilebilir olması gerekmez).
    public const string Id = "https://aigenerativeui.local/catalogs/genui-v1.json";

    public static readonly string[] Components = ["Card", "Table", "Chart", "Form"];

    // Sunucunun anladığı form alanları ve aksiyonlar (Form'un submit'i buraya gelir).
    public static readonly string[] FormFields = ["category"];
    public const string FilterAction = "applyFilter";

    // LLM'e verilen talimat: katalog + veri setleri + çıktı biçimi.
    public static string SystemPrompt()
    {
        var datasets = string.Join("\n", SalesData.Datasets.Select(d => $"- {d.Key}: fields {string.Join(", ", d.Value)}"));
        return $$"""
            You design user interfaces. You do NOT write HTML or code.
            You decide two things: WHICH DATA is needed (months) and HOW it is shown (components).
            You describe a screen as JSON using ONLY these components (the catalog):

            Card  { "id", "component": "Card", "title", "children": [ids of other components] }
            Table { "id", "component": "Table", "title", "rows": { "path": "<dataset>" }, "columns": [ { "header", "field" } ] }
            Chart { "id", "component": "Chart", "title", "type": "bar", "data": { "path": "<dataset>" }, "labelField", "valueFields": [fields] }
            Form  { "id", "component": "Form", "title", "fields": [ { "name": "category", "label", "type": "select", "options": [...] } ],
                    "submitLabel", "action": { "event": { "name": "{{FilterAction}}" } } }

            When to use which component (choose ALL that fit the request):
            - Chart: comparing values over time or between groups (e.g. "compare months" -> Chart of /monthlyTotals).
            - Table: listing items with details (e.g. products, underperformers -> Table).
            - Form: letting the user filter (category).
            - Card: grouping related components under a heading. A request with several parts
              ("compare ... and also show ...") usually needs one component per part.

            Rules:
            - Components are a FLAT list. Containers point to children by id: "children": ["c1", "c2"].
              NEVER put a component object inside "children". Every component is a top-level item of "components".
            - Form "options" are plain strings: ["Elektronik", "Mobilya"].
            - Exactly one component has id "root" and it must be a Card.
            - Never put data values in components. Bind to a dataset with { "path": ... }.
            - Only use these datasets and fields (sales of the last 3 months, TL):
            {{datasets}}
              aug/sep/oct = monthly revenue, total = 3-month revenue, target = 3-month target,
              gap = total - target (negative means below target).
            - A Table or Chart may only use the fields of ITS OWN dataset.
              Per-product fields (product, aug, ...) are only in /products and /underperformers.
            - A Form may only have the field "category" with options: {{string.Join(", ", SalesData.Categories)}}.
              Add a Form only if the user would benefit from filtering.
            - All titles and labels in Turkish.
            - "months": the months the user asked about, from {{string.Join(", ", SalesData.Months)}} (in this order).
              "last 2 months" = ["Eylül", "Ekim"]; no period mentioned = all 3. total/target/gap then cover only these months.
              Month fields: aug = Ağustos, sep = Eylül, oct = Ekim. Only use month fields of the selected months.
            - Reply with JSON only: { "months": [ ... ], "components": [ ... ] }

            Example:
            { "months": ["Ağustos", "Eylül", "Ekim"], "components": [
              { "id": "root", "component": "Card", "title": "Aylık Satış", "children": ["c1"] },
              { "id": "c1", "component": "Chart", "title": "Ciro ve Hedef", "type": "bar",
                "data": { "path": "/monthlyTotals" }, "labelField": "month", "valueFields": ["revenue", "target"] }
            ] }
            """;
    }

    // LLM'in ürettiği listeyi kontrol eder. Hata listesi boşsa geçerli.
    // Hatalar LLM'e geri gönderilip düzeltmesi istenir (Program.cs).
    public static List<string> Validate(JsonArray components, string[] months)
    {
        var errors = new List<string>();
        var byId = new Dictionary<string, JsonObject>();

        foreach (var node in components)
        {
            if (node is not JsonObject c) { errors.Add("Every component must be a JSON object."); continue; }
            var id = Str(c["id"]);
            var type = Str(c["component"]);
            if (string.IsNullOrWhiteSpace(id)) { errors.Add("A component has no id."); continue; }
            if (!byId.TryAdd(id, c)) errors.Add($"Duplicate id '{id}'.");
            if (!Components.Contains(type)) errors.Add($"'{id}': component '{type}' is not in the catalog (allowed: {string.Join(", ", Components)}).");
        }

        if (!byId.TryGetValue("root", out var root)) errors.Add("There is no component with id 'root'.");
        else if (Str(root["component"]) != "Card") errors.Add("'root' must be a Card.");
        else if (((root["children"] as JsonArray)?.Count ?? 0) == 0)
            errors.Add($"'root' has no children, so nothing would be shown. Set \"children\": [{string.Join(", ", byId.Keys.Where(k => k != "root").Select(k => $"\"{k}\""))}].");

        foreach (var (id, c) in byId)
        {
            switch (Str(c["component"]))
            {
                case "Card":
                    foreach (var child in c["children"] as JsonArray ?? [])
                    {
                        // Küçük modeller sık sık ağaç yazar. A2UI'de liste DÜZdür: children sadece id içerir.
                        if (child is JsonObject nested)
                        {
                            errors.Add($"'{id}': children must contain only id strings, not objects. " +
                                       $"Move component '{Str(nested["id"])}' to the top-level \"components\" list (flat list) and write \"{Str(nested["id"])}\" in children.");
                            continue;
                        }
                        var childId = Str(child) ?? "";
                        if (!byId.ContainsKey(childId)) errors.Add($"'{id}': child '{childId}' does not exist.");
                        if (childId == id || childId == "root") errors.Add($"'{id}': a Card cannot contain '{childId}'.");
                    }
                    break;

                case "Table":
                    var tableFields = CheckDataset(id, c["rows"], errors);
                    var columns = c["columns"] as JsonArray ?? [];
                    if (columns.Count == 0) errors.Add($"'{id}': Table needs columns.");
                    foreach (var col in columns)
                        CheckField(id, Str(col?["field"]), tableFields, months, errors);
                    break;

                case "Chart":
                    var chartFields = CheckDataset(id, c["data"], errors);
                    CheckField(id, Str(c["labelField"]), chartFields, months, errors);
                    var values = c["valueFields"] as JsonArray ?? [];
                    if (values.Count == 0) errors.Add($"'{id}': Chart needs valueFields.");
                    foreach (var v in values) CheckField(id, Str(v), chartFields, months, errors);
                    break;

                case "Form":
                    foreach (var f in c["fields"] as JsonArray ?? [])
                    {
                        if (!FormFields.Contains(Str(f?["name"]))) errors.Add($"'{id}': form field '{f?["name"]}' is not allowed (only: category).");
                        if ((f?["options"] as JsonArray ?? []).Any(o => Str(o) is null))
                            errors.Add($"'{id}': options must be plain strings, e.g. [\"Elektronik\", \"Mobilya\"].");
                    }
                    if (Str((c["action"] as JsonObject)?["event"]?["name"]) != FilterAction) errors.Add($"'{id}': Form action must be {{ \"event\": {{ \"name\": \"{FilterAction}\" }} }}.");
                    break;
            }
        }
        return errors;
    }

    private static string[]? CheckDataset(string id, JsonNode? binding, List<string> errors)
    {
        var path = Str(binding?["path"]);
        if (path is not null && SalesData.Datasets.TryGetValue(path, out var fields)) return fields;
        errors.Add($"'{id}': data path '{path}' is unknown (allowed: {string.Join(", ", SalesData.Datasets.Keys)}).");
        return null;
    }

    private static void CheckField(string id, string? field, string[]? fields, string[] months, List<string> errors)
    {
        // İzin verilen alanları da yazıyoruz: küçük modeller "ne yapmalıyım"ı görünce daha kolay düzeltiyor.
        if (fields is not null && !fields.Contains(field))
            errors.Add($"'{id}': field '{field}' does not exist in that dataset. Use only: {string.Join(", ", fields)}.");
        // Seçilmeyen bir ayın sütunu istenirse (ör. months=[Eylül, Ekim] iken "aug") o veri gelmeyecek.
        int m = Array.IndexOf(SalesData.MonthKeys, field);
        if (m >= 0 && !months.Contains(SalesData.Months[m]))
            errors.Add($"'{id}': field '{field}' is {SalesData.Months[m]}, which is not in \"months\". Remove it or add the month.");
    }

    // JSON düğümünü güvenle string'e çevirir (değer string değilse null). Böylece model
    // beklenmedik bir tip yazdığında program patlamaz, anlaşılır bir hata mesajı üretilir.
    private static string? Str(JsonNode? node) =>
        node is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
}
