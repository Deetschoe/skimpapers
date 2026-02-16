import Foundation

final class APIService {

    static let shared = APIService()
    static var baseURL = "https://skim-api.example.com/api"

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    // MARK: - Auth

    func checkEmail(email: String) async throws -> Bool {
        let body: [String: String] = ["email": email]
        let request = try buildRequest(path: "/auth/check-email", method: "POST", body: body)
        let response: CheckEmailExistsResponse = try await perform(request)
        return response.exists
    }

    func requestCode(email: String, accessCode: String? = nil) async throws {
        var body: [String: String] = ["email": email]
        if let code = accessCode {
            body["accessCode"] = code
        }
        let request = try buildRequest(path: "/auth/request-code", method: "POST", body: body)
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func verifyCode(email: String, code: String) async throws -> SkimUser {
        let body: [String: String] = ["email": email, "code": code]
        let request = try buildRequest(path: "/auth/verify-code", method: "POST", body: body)
        let authResponse: AuthResponse = try await perform(request)
        return authResponse.skimUser
    }

    func validateToken(_ token: String) async throws -> SkimUser {
        let request = try authorizedRequest(path: "/auth/validate", method: "GET", token: token)
        let validateResponse: ValidateResponse = try await perform(request)
        return SkimUser(
            id: validateResponse.user.id,
            email: validateResponse.user.email,
            token: token,
            createdAt: validateResponse.user.createdAt
        )
    }

    // MARK: - Papers

    func addPaper(url: String, token: String) async throws -> Paper {
        let body: [String: String] = ["url": url]
        let request = try authorizedRequest(path: "/papers", method: "POST", token: token, body: body)
        let paper: Paper = try await perform(request)
        return paper
    }

    func getPapers(token: String) async throws -> [Paper] {
        let request = try authorizedRequest(path: "/papers", method: "GET", token: token)
        let papers: [Paper] = try await perform(request)
        return papers
    }

    func getPaper(id: String, token: String) async throws -> Paper {
        let request = try authorizedRequest(path: "/papers/\(id)", method: "GET", token: token)
        let paper: Paper = try await perform(request)
        return paper
    }

    func deletePaper(id: String, token: String) async throws {
        let request = try authorizedRequest(path: "/papers/\(id)", method: "DELETE", token: token)
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    // MARK: - Annotations

    func getAnnotations(paperId: String, token: String) async throws -> [Annotation] {
        let request = try authorizedRequest(
            path: "/papers/\(paperId)/annotations",
            method: "GET",
            token: token
        )
        let annotations: [Annotation] = try await perform(request)
        return annotations
    }

    func saveAnnotation(_ annotation: Annotation, token: String) async throws -> Annotation {
        let body = try encoder.encode(annotation)
        let request = try authorizedRequest(
            path: "/papers/\(annotation.paperId)/annotations",
            method: "POST",
            token: token,
            rawBody: body
        )
        let saved: Annotation = try await perform(request)
        return saved
    }

    // MARK: - Usage

    func getUsage(token: String) async throws -> UsageInfo {
        let request = try authorizedRequest(path: "/papers/usage", method: "GET", token: token)
        let usage: UsageInfo = try await perform(request)
        return usage
    }

    // MARK: - Request Helpers

    private func buildRequest(
        path: String,
        method: String,
        body: Encodable? = nil
    ) throws -> URLRequest {
        guard let url = URL(string: Self.baseURL + path) else {
            throw SkimError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return request
    }

    private func authorizedRequest(
        path: String,
        method: String,
        token: String,
        body: Encodable? = nil,
        rawBody: Data? = nil
    ) throws -> URLRequest {
        var request = try buildRequest(path: path, method: method, body: body)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let rawBody {
            request.httpBody = rawBody
        }
        return request
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SkimError.networkError
        }
        try validateResponse(response)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw SkimError.serverError("Failed to decode response")
        }
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw SkimError.networkError
        }
        switch http.statusCode {
        case 200...299:
            return
        case 401:
            throw SkimError.notAuthenticated
        default:
            throw SkimError.serverError("Server returned status \(http.statusCode)")
        }
    }
}

// MARK: - Auth Response Types

struct CheckEmailExistsResponse: Codable {
    let exists: Bool
}

// MARK: - Type-erased Encodable wrapper

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeClosure = { encoder in
            try wrapped.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
