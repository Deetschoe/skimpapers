import Foundation

struct PaperCollection: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var icon: String       // SF Symbol name
    var colorName: String  // Theme color key
    var paperIds: [String]
    let createdAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        icon: String = "folder.fill",
        colorName: String = "accent",
        paperIds: [String] = [],
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.icon = icon
        self.colorName = colorName
        self.paperIds = paperIds
        self.createdAt = createdAt
    }

    // Custom decoding to handle backend response shape:
    // Backend sends { id, userId, name, icon, colorName, paperCount, createdAt }
    // where createdAt is an ISO 8601 string and paperIds is absent.
    // Local cache sends { id, name, icon, colorName, paperIds, createdAt }.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        icon = try container.decodeIfPresent(String.self, forKey: .icon) ?? "folder.fill"
        colorName = try container.decodeIfPresent(String.self, forKey: .colorName) ?? "accent"
        paperIds = try container.decodeIfPresent([String].self, forKey: .paperIds) ?? []

        // createdAt may come as a Date (from local cache) or ISO 8601 string (from backend)
        if let date = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = date
        } else if let dateString = try? container.decode(String.self, forKey: .createdAt) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let parsed = formatter.date(from: dateString) {
                createdAt = parsed
            } else {
                // Try without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                createdAt = formatter.date(from: dateString) ?? Date()
            }
        } else {
            createdAt = Date()
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, icon, colorName, paperIds, createdAt
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: PaperCollection, rhs: PaperCollection) -> Bool {
        lhs.id == rhs.id
    }
}

// Predefined collection icons users can pick from
enum CollectionIcon: String, CaseIterable {
    case folder = "folder.fill"
    case star = "star.fill"
    case bookmark = "bookmark.fill"
    case heart = "heart.fill"
    case flame = "flame.fill"
    case bolt = "bolt.fill"
    case brain = "brain.head.profile"
    case graduationcap = "graduationcap.fill"
    case book = "book.fill"
    case flask = "flask.fill"
    case atom = "atom"
    case leaf = "leaf.fill"
}

// Predefined colors for collections
enum CollectionColor: String, CaseIterable {
    case accent
    case purple
    case green
    case orange
    case pink
    case blue
    case yellow
    case red

    var displayName: String {
        rawValue.capitalized
    }
}
