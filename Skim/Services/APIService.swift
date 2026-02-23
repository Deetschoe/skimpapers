import Foundation

final class APIService {

    static let shared = APIService()
    static var baseURL = "https://api.skimpapers.org/api"

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

    func searchPapers(query: String, token: String) async throws -> [Paper] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let request = try authorizedRequest(path: "/papers/search?q=\(encoded)", method: "GET", token: token)
        let papers: [Paper] = try await perform(request)
        return papers
    }

    func uploadPDF(data: Data, filename: String, token: String) async throws -> Paper {
        let boundary = UUID().uuidString
        guard let url = URL(string: Self.baseURL + "/papers/upload") else {
            throw SkimError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/pdf\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        // PDF processing can take a while
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 300
        let uploadSession = URLSession(configuration: config)

        let (responseData, response) = try await uploadSession.data(for: request)
        try validateResponse(response)
        return try decoder.decode(Paper.self, from: responseData)
    }

    // MARK: - AI Chat

    func chatWithPaper(paperId: String, messages: [[String: String]], token: String) async throws -> [String: Any] {
        let body: [String: Any] = ["messages": messages]
        let jsonData = try JSONSerialization.data(withJSONObject: body)
        let request = try authorizedRequest(
            path: "/papers/\(paperId)/chat",
            method: "POST",
            token: token,
            rawBody: jsonData
        )
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SkimError.serverError("Failed to decode chat response")
        }
        return json
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

    // MARK: - Collections

    func getCollections(token: String) async throws -> [PaperCollection] {
        let request = try authorizedRequest(path: "/collections", method: "GET", token: token)
        let collections: [PaperCollection] = try await perform(request)
        return collections
    }

    func createCollection(name: String, icon: String?, colorName: String?, token: String) async throws -> PaperCollection {
        var body: [String: String] = ["name": name]
        if let icon { body["icon"] = icon }
        if let colorName { body["colorName"] = colorName }
        let request = try authorizedRequest(path: "/collections", method: "POST", token: token, body: body)
        let collection: PaperCollection = try await perform(request)
        return collection
    }

    func updateCollection(id: String, name: String?, icon: String?, colorName: String?, token: String) async throws -> PaperCollection {
        var body: [String: String] = [:]
        if let name { body["name"] = name }
        if let icon { body["icon"] = icon }
        if let colorName { body["colorName"] = colorName }
        let request = try authorizedRequest(path: "/collections/\(id)", method: "PUT", token: token, body: body)
        let collection: PaperCollection = try await perform(request)
        return collection
    }

    func deleteCollection(id: String, token: String) async throws {
        let request = try authorizedRequest(path: "/collections/\(id)", method: "DELETE", token: token)
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func getCollectionPapers(collectionId: String, token: String) async throws -> [Paper] {
        let request = try authorizedRequest(
            path: "/collections/\(collectionId)/papers",
            method: "GET",
            token: token
        )
        let papers: [Paper] = try await perform(request)
        return papers
    }

    func addPaperToCollection(collectionId: String, paperId: String, token: String) async throws {
        let body: [String: String] = ["paperId": paperId]
        let request = try authorizedRequest(
            path: "/collections/\(collectionId)/papers",
            method: "POST",
            token: token,
            body: body
        )
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func removePaperFromCollection(collectionId: String, paperId: String, token: String) async throws {
        let request = try authorizedRequest(
            path: "/collections/\(collectionId)/papers/\(paperId)",
            method: "DELETE",
            token: token
        )
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    // MARK: - Usage

    func getUsage(token: String) async throws -> UsageInfo {
        let request = try authorizedRequest(path: "/usage", method: "GET", token: token)
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
            print("Decode error:", error)
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
