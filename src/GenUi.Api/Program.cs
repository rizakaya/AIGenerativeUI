using System.Text.Json;
using System.Text.Json.Nodes;
using GenUi.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddHttpClient<OllamaClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Ollama:Url"]!);
    c.Timeout = TimeSpan.FromMinutes(5); // yerel modeller yavaş olabilir
});

var app = builder.Build();
app.UseCors();

// Tek endpoint. Gövde iki şekilde gelir:
//  1) İlk istek:      { "prompt": "Son üç ayın satışlarını karşılaştır..." }
//  2) Form gönderimi: { "prompt": "...", "action": { A2UI action mesajı } }
app.MapPost("/api/ui", async (UiRequest req, OllamaClient llm, ILogger<Program> log, CancellationToken ct) =>
{
    const string surfaceId = "main";

    // 1) Kullanıcının isteğini LLM için yaz. Action varsa onu da ekle.
    var userText = req.Prompt;
    string? category = null;
    if (req.Action is { } action)
    {
        category = (string?)action["context"]?["category"];
        if (string.IsNullOrEmpty(category)) category = null;
        userText += $"\n\nThe user submitted the form (action '{action["name"]}') with values {action["context"]?.ToJsonString()}. " +
                    "The data is now filtered accordingly. Design the screen again for this situation.";
    }

    var messages = new JsonArray
    {
        new JsonObject { ["role"] = "system", ["content"] = Catalog.SystemPrompt() },
        new JsonObject { ["role"] = "user", ["content"] = userText },
    };

    // 2) LLM'den bileşen listesini al. Geçersizse hataları gösterip düzeltmesini iste (en fazla 3 deneme).
    JsonArray? components = null;
    string[] months = SalesData.Months;
    List<string> errors = [];
    var rawOutputs = new List<string>();

    for (int attempt = 1; attempt <= 3; attempt++)
    {
        var raw = await llm.ChatAsync(messages, ct);
        rawOutputs.Add(raw);
        (components, months, errors) = Parse(raw);
        log.LogInformation("Deneme {Attempt}: {Count} hata", attempt, errors.Count);
        if (errors.Count == 0) break;

        messages.Add(new JsonObject { ["role"] = "assistant", ["content"] = raw });
        messages.Add(new JsonObject { ["role"] = "user", ["content"] =
            "Your JSON is invalid:\n- " + string.Join("\n- ", errors) + "\nReturn the corrected full JSON." });
    }

    if (errors.Count > 0)
        return Results.UnprocessableEntity(new { errors, llmOutputs = rawOutputs });

    // 3) A2UI mesajlarını oluştur. Bileşenler LLM'den, veri API'den gelir.
    var a2ui = new JsonArray
    {
        new JsonObject { ["version"] = "v0.9.1", ["createSurface"] = new JsonObject
            { ["surfaceId"] = surfaceId, ["catalogId"] = Catalog.Id } },
        new JsonObject { ["version"] = "v0.9.1", ["updateComponents"] = new JsonObject
            { ["surfaceId"] = surfaceId, ["components"] = components!.DeepClone() } },
        new JsonObject { ["version"] = "v0.9.1", ["updateDataModel"] = new JsonObject
            { ["surfaceId"] = surfaceId, ["path"] = "/", ["value"] = SalesData.Build(category, months) } },
    };

    return Results.Ok(new { messages = a2ui, llmOutputs = rawOutputs });
});

app.Run();

// LLM çıktısını { "months": [...], "components": [...] } olarak çözüp katalog kurallarıyla doğrular.
static (JsonArray?, string[], List<string>) Parse(string raw)
{
    var all = SalesData.Months;
    try
    {
        var root = JsonNode.Parse(raw);
        var components = root?["components"]?.AsArray();
        if (components is null) return (null, all, ["Top level must be { \"months\": [...], \"components\": [ ... ] }."]);

        // months: LLM'in veri kararı. Yoksa/boşsa 3 ayın hepsi.
        var months = root?["months"]?.AsArray().Select(m => (string?)m ?? "").ToArray() ?? [];
        var unknown = months.Where(m => !all.Contains(m)).ToList();
        if (unknown.Count > 0) return (components, all, [$"Unknown months: {string.Join(", ", unknown)}. Use only: {string.Join(", ", all)}."]);
        if (months.Length == 0) months = all;

        return (components, months, Catalog.Validate(components, months));
    }
    catch (Exception ex) when (ex is JsonException or InvalidOperationException)
    {
        return (null, all, [$"Not valid JSON for this format: {ex.Message}"]);
    }
}

record UiRequest(string Prompt, JsonObject? Action);
