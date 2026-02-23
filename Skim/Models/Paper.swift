import Foundation

enum PaperSource: String, Codable {
    case arxiv = "arxiv"
    case pubmed = "pubmed"
    case biorxiv = "biorxiv"
    case medrxiv = "medrxiv"
    case scholar = "scholar"
    case archive = "archive"
    case upload = "upload"
    case other = "other"

    var displayName: String {
        switch self {
        case .arxiv: return "arXiv"
        case .pubmed: return "PubMed"
        case .biorxiv: return "bioRxiv"
        case .medrxiv: return "medRxiv"
        case .scholar: return "Google Scholar"
        case .archive: return "Archive.org"
        case .upload: return "Uploaded"
        case .other: return "Other"
        }
    }

    // Fallback for any unknown source string from the backend
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = PaperSource(rawValue: rawValue) ?? .other
    }
}

enum PaperCategory: String, Codable, CaseIterable, Identifiable {
    case neuroscience = "Neuroscience"
    case computerScience = "Computer Science"
    case biology = "Biology"
    case physics = "Physics"
    case mathematics = "Mathematics"
    case medicine = "Medicine"
    case chemistry = "Chemistry"
    case engineering = "Engineering"
    case psychology = "Psychology"
    case economics = "Economics"
    case other = "Other"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .neuroscience: return "brain.head.profile"
        case .computerScience: return "cpu"
        case .biology: return "leaf"
        case .physics: return "atom"
        case .mathematics: return "function"
        case .medicine: return "cross.case"
        case .chemistry: return "flask"
        case .engineering: return "gearshape.2"
        case .psychology: return "person.and.background.dotted"
        case .economics: return "chart.line.uptrend.xyaxis"
        case .other: return "doc.text"
        }
    }

    // Fallback for any unknown category string from the backend
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = PaperCategory(rawValue: rawValue) ?? .other
    }
}

struct Paper: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let authors: [String]
    let abstract: String
    let url: String
    let pdfURL: String?
    let markdownContent: String?
    let summary: String?
    let rating: Int?
    let category: PaperCategory
    let tags: [String]
    let source: PaperSource
    let publishedDate: String?
    let addedDate: String
    var isRead: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, authors, abstract, url
        case pdfURL = "pdfUrl"
        case markdownContent, summary, rating, category, tags, source
        case publishedDate, addedDate, isRead
    }

    init(
        id: String,
        title: String,
        authors: [String],
        abstract: String,
        url: String,
        pdfURL: String?,
        markdownContent: String?,
        summary: String?,
        rating: Int?,
        category: PaperCategory,
        tags: [String],
        source: PaperSource,
        publishedDate: String?,
        addedDate: String,
        isRead: Bool
    ) {
        self.id = id
        self.title = title
        self.authors = authors
        self.abstract = abstract
        self.url = url
        self.pdfURL = pdfURL
        self.markdownContent = markdownContent
        self.summary = summary
        self.rating = rating
        self.category = category
        self.tags = tags
        self.source = source
        self.publishedDate = publishedDate
        self.addedDate = addedDate
        self.isRead = isRead
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        authors = try container.decodeIfPresent([String].self, forKey: .authors) ?? []
        abstract = try container.decodeIfPresent(String.self, forKey: .abstract) ?? ""
        url = try container.decodeIfPresent(String.self, forKey: .url) ?? ""
        pdfURL = try container.decodeIfPresent(String.self, forKey: .pdfURL)
        markdownContent = try container.decodeIfPresent(String.self, forKey: .markdownContent)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        rating = try container.decodeIfPresent(Int.self, forKey: .rating)
        category = try container.decodeIfPresent(PaperCategory.self, forKey: .category) ?? .other
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        source = try container.decodeIfPresent(PaperSource.self, forKey: .source) ?? .other
        publishedDate = try container.decodeIfPresent(String.self, forKey: .publishedDate)
        addedDate = try container.decodeIfPresent(String.self, forKey: .addedDate) ?? ""
        isRead = try container.decodeIfPresent(Bool.self, forKey: .isRead) ?? false
    }

    var formattedAuthors: String {
        if authors.isEmpty { return "Unknown" }
        if authors.count <= 2 {
            return authors.joined(separator: " & ")
        }
        return "\(authors[0]) et al."
    }

    var ratingLabel: String {
        guard let r = rating else { return "—" }
        return "\(r)/10"
    }

    var formattedDate: String {
        guard let dateStr = publishedDate else { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withFullDate]
        if let date = iso.date(from: dateStr) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return dateStr
    }

    var relativeAddedDate: String {
        let iso = ISO8601DateFormatter()
        if let date = iso.date(from: addedDate) {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return formatter.localizedString(for: date, relativeTo: Date())
        }
        return addedDate
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Paper, rhs: Paper) -> Bool {
        lhs.id == rhs.id
    }
}

struct Annotation: Identifiable, Codable {
    let id: String
    let paperId: String
    let selectedText: String?
    let note: String?
    let aiResponse: String?
    let pageNumber: Int?
    let createdAt: String
}
