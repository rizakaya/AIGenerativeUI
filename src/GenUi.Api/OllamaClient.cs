using System.Text.Json.Nodes;

namespace GenUi.Api;

// Ollama'nın /api/chat uç noktasına düz HTTP çağrısı.
// Kütüphane kullanmıyoruz ki LLM'e tam olarak ne gittiği görünsün.
public class OllamaClient(HttpClient http, IConfiguration config)
{
    public async Task<string> ChatAsync(JsonArray messages, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = config["Ollama:Model"],
            ["messages"] = messages.DeepClone(),
            ["stream"] = false,
            ["format"] = "json",                         // Ollama'ya "sadece geçerli JSON üret" der
            ["options"] = new JsonObject { ["temperature"] = 0.2 },
        };

        using var response = await http.PostAsJsonAsync("/api/chat", body, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            throw new InvalidOperationException(
                $"Ollama '{config["Ollama:Model"]}' modelini bulamadı. 'ollama list' ile adı kontrol et ve appsettings.json'daki Ollama:Model'i düzelt.");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonObject>(ct);
        return (string?)json?["message"]?["content"] ?? "";
    }
}
