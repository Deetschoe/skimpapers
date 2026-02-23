import Foundation

struct SkimUser: Codable {
    let id: String
    let email: String
    let token: String
    let createdAt: String
}

// Matches the backend auth response shape: { user: {...}, token: "..." }
struct AuthResponse: Codable {
    let user: AuthUser
    let token: String

    struct AuthUser: Codable {
        let id: String
        let email: String
        let createdAt: String
    }

    var skimUser: SkimUser {
        SkimUser(id: user.id, email: user.email, token: token, createdAt: user.createdAt)
    }
}

// Matches the backend validate response: { user: {...} }
struct ValidateResponse: Codable {
    let user: AuthResponse.AuthUser
}

struct UsageInfo: Codable {
    let totalPapers: Int
    let totalQueries: Int
    let apiCostEstimate: Double
    let monthlyCost: Double
    let periodStart: String
    let periodEnd: String
}
