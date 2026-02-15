import Foundation

struct PaperInsight: Codable {
    let summary: String
    let rating: Int
    let categories: [String]
    let keyFindings: [String]
}

final class ClaudeService {

    static let shared = ClaudeService()

    private let apiKey = "YOUR_CLAUDE_API_KEY"
    private let endpoint = "https://api.anthropic.com/v1/messages"
    private let model = "claude-sonnet-4-5-20250929"
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 180
        session = URLSession(configuration: config)
    }

    // MARK: - Public API

    /// Ask a question about a paper given its content and optional selected text.
    func askAboutPaper(
        question: String,
        context: String,
        selectedText: String? = nil
    ) async throws -> String {
        let systemPrompt = """
            You are a research assistant helping a scientist understand academic papers. \
            Be concise, precise, and cite specific parts of the paper when relevant.
            """

        var userMessage = ""

        if let selectedText, !selectedText.isEmpty {
            userMessage += "Selected passage:\n\"\"\"\n\(selectedText)\n\"\"\"\n\n"
        }

        userMessage += "Paper content:\n\"\"\"\n\(context)\n\"\"\"\n\n"
        userMessage += "Question: \(question)"

        let answer = try await sendMessage(
            system: systemPrompt,
            userContent: userMessage,
            maxTokens: 2048
        )
        return answer
    }

    /// Summarize a paper and return structured insight.
    func summarizePaper(markdown: String) async throws -> PaperInsight {
        let systemPrompt = """
            You are a research assistant helping a scientist understand academic papers. \
            Be concise, precise, and cite specific parts of the paper when relevant.
            """

        let userMessage = """
            Analyze the following academic paper and respond with ONLY valid JSON (no markdown \
            fences, no extra text) matching this exact schema:
            {
              "summary": "A 2-3 sentence summary of the paper",
              "rating": <integer 1-10 rating of significance/quality>,
              "categories": ["list", "of", "relevant", "categories"],
              "keyFindings": ["finding 1", "finding 2", "finding 3"]
            }

            Paper:
            \"\"\"
            \(markdown)
            \"\"\"
            """

        let raw = try await sendMessage(
            system: systemPrompt,
            userContent: userMessage,
            maxTokens: 1024
        )

        guard let data = raw.data(using: .utf8) else {
            throw SkimError.serverError("Invalid response encoding from Claude")
        }

        do {
            let insight = try JSONDecoder().decode(PaperInsight.self, from: data)
            return insight
        } catch {
            throw SkimError.serverError("Failed to parse Claude insight response")
        }
    }

    // MARK: - Networking

    private func sendMessage(
        system: String,
        userContent: String,
        maxTokens: Int
    ) async throws -> String {
        guard let url = URL(string: endpoint) else {
            throw SkimError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let payload: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "system": system,
            "messages": [
                [
                    "role": "user",
                    "content": userContent
                ]
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SkimError.networkError
        }

        guard let http = response as? HTTPURLResponse else {
            throw SkimError.networkError
        }

        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 {
                throw SkimError.notAuthenticated
            }
            throw SkimError.serverError("Claude API returned status \(http.statusCode)")
        }

        let decoded = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        guard
            let content = decoded?["content"] as? [[String: Any]],
            let firstBlock = content.first,
            let text = firstBlock["text"] as? String
        else {
            throw SkimError.serverError("Unexpected response format from Claude")
        }

        return text
    }
}
