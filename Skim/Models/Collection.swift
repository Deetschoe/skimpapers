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
