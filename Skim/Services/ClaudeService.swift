import Foundation

// MARK: - DEPRECATED
// ClaudeService is no longer used. All AI calls now route through the backend
// via APIService.chatWithPaper() -> POST /api/papers/:id/chat.
// This avoids shipping API keys in the app binary.
//
// Kept temporarily for reference. Safe to delete once confirmed unused.

struct PaperInsight: Codable {
    let summary: String
    let rating: Int
    let categories: [String]
    let keyFindings: [String]
}

@available(*, deprecated, message: "Use APIService.chatWithPaper() instead. AI calls route through the backend.")
final class ClaudeService {

    static let shared = ClaudeService()

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
        throw SkimError.serverError("ClaudeService is deprecated. Use APIService.chatWithPaper() instead.")
    }

    /// Summarize a paper and return structured insight.
    func summarizePaper(markdown: String) async throws -> PaperInsight {
        throw SkimError.serverError("ClaudeService is deprecated. Use APIService.chatWithPaper() instead.")
    }
}
