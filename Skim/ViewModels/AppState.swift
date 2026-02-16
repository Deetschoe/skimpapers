import SwiftUI

enum AppScreen {
    case splash
    case auth
    case home
}

@MainActor
class AppState: ObservableObject {
    @Published var currentScreen: AppScreen = .splash
    @Published var currentUser: SkimUser?
    @Published var papers: [Paper] = []
    @Published var collections: [PaperCollection] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var selectedCategory: PaperCategory?
    @Published var usage: UsageInfo?
    @Published var aiEnabled = true
    @Published var autoSummarize = true
    @Published var textSizeMultiplier: Double = 1.0

    // Reading history: paper ID -> last read date
    @Published var readingHistory: [String: Date] = [:]

    var filteredPapers: [Paper] {
        var result = papers
        if !searchText.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.authors.joined(separator: " ").localizedCaseInsensitiveContains(searchText) ||
                $0.tags.joined(separator: " ").localizedCaseInsensitiveContains(searchText)
            }
        }
        if let cat = selectedCategory {
            result = result.filter { $0.category == cat }
        }
        return result
    }

    /// Recently read papers, sorted by most recent
    var recentlyReadPapers: [Paper] {
        let readPaperIds = readingHistory.sorted { $0.value > $1.value }.map(\.key)
        return readPaperIds.compactMap { id in papers.first { $0.id == id } }.prefix(6).map { $0 }
    }

    /// Recommended papers: unread, sorted by rating descending
    var recommendedPapers: [Paper] {
        papers
            .filter { !$0.isRead }
            .sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
            .prefix(8)
            .map { $0 }
    }

    /// Papers in a specific collection
    func papers(in collection: PaperCollection) -> [Paper] {
        collection.paperIds.compactMap { id in papers.first { $0.id == id } }
    }

    private let api = APIService.shared
    private let collectionsKey = "skim_collections"
    private let readingHistoryKey = "skim_reading_history"
    private let settingsPrefix = "skim_setting_"

    // MARK: - Boot

    func boot() {
        loadLocalData()
        Task {
            try? await Task.sleep(for: .seconds(1.8))
            if let token = KeychainService.getToken() {
                do {
                    let user = try await api.validateToken(token)
                    self.currentUser = user
                    await loadPapers()
                    withAnimation(.easeInOut(duration: 0.5)) {
                        self.currentScreen = .home
                    }
                } catch {
                    KeychainService.deleteToken()
                    withAnimation(.easeInOut(duration: 0.5)) {
                        self.currentScreen = .auth
                    }
                }
            } else {
                withAnimation(.easeInOut(duration: 0.5)) {
                    self.currentScreen = .auth
                }
            }
        }
    }

    // MARK: - Auth

    func authenticate(email: String, code: String) async throws {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let user = try await api.verifyCode(email: email, code: code)
        KeychainService.saveToken(user.token)
        currentUser = user
        await loadPapers()
        withAnimation(.easeInOut(duration: 0.4)) {
            currentScreen = .home
        }
    }

    // MARK: - Papers

    func addPaper(url: String) async throws {
        guard let token = currentUser?.token else { throw SkimError.notAuthenticated }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let paper = try await api.addPaper(url: url, token: token)
        withAnimation {
            papers.insert(paper, at: 0)
        }
    }

    func loadPapers() async {
        guard let token = currentUser?.token else { return }
        do {
            papers = try await api.getPapers(token: token)
        } catch {
            errorMessage = "Failed to load papers"
        }
    }

    func deletePaper(_ paper: Paper) async {
        guard let token = currentUser?.token else { return }
        do {
            try await api.deletePaper(id: paper.id, token: token)
            withAnimation {
                papers.removeAll { $0.id == paper.id }
                // Also remove from collections
                for i in collections.indices {
                    collections[i].paperIds.removeAll { $0 == paper.id }
                }
                readingHistory.removeValue(forKey: paper.id)
                saveCollections()
                saveReadingHistory()
            }
        } catch {
            errorMessage = "Failed to delete paper"
        }
    }

    func markAsRead(_ paper: Paper) {
        if let index = papers.firstIndex(where: { $0.id == paper.id }) {
            papers[index].isRead = true
        }
        readingHistory[paper.id] = Date()
        saveReadingHistory()
    }

    // MARK: - Collections

    func createCollection(name: String, icon: String = "folder.fill", colorName: String = "accent") {
        let collection = PaperCollection(name: name, icon: icon, colorName: colorName)
        withAnimation {
            collections.append(collection)
        }
        saveCollections()
    }

    func deleteCollection(_ collection: PaperCollection) {
        withAnimation {
            collections.removeAll { $0.id == collection.id }
        }
        saveCollections()
    }

    func renameCollection(_ collection: PaperCollection, to name: String) {
        if let index = collections.firstIndex(where: { $0.id == collection.id }) {
            collections[index].name = name
            saveCollections()
        }
    }

    func updateCollectionAppearance(_ collection: PaperCollection, icon: String, colorName: String) {
        if let index = collections.firstIndex(where: { $0.id == collection.id }) {
            collections[index].icon = icon
            collections[index].colorName = colorName
            saveCollections()
        }
    }

    func addPaper(_ paper: Paper, to collection: PaperCollection) {
        if let index = collections.firstIndex(where: { $0.id == collection.id }) {
            if !collections[index].paperIds.contains(paper.id) {
                collections[index].paperIds.append(paper.id)
                saveCollections()
            }
        }
    }

    func removePaper(_ paper: Paper, from collection: PaperCollection) {
        if let index = collections.firstIndex(where: { $0.id == collection.id }) {
            collections[index].paperIds.removeAll { $0 == paper.id }
            saveCollections()
        }
    }

    // MARK: - Usage

    func loadUsage() async {
        guard let token = currentUser?.token else { return }
        usage = try? await api.getUsage(token: token)
    }

    // MARK: - Sign Out

    func signOut() {
        KeychainService.deleteToken()
        currentUser = nil
        papers = []
        usage = nil
        withAnimation(.easeInOut(duration: 0.4)) {
            currentScreen = .auth
        }
    }

    // MARK: - Local Persistence

    private func loadLocalData() {
        // Collections
        if let data = UserDefaults.standard.data(forKey: collectionsKey),
           let decoded = try? JSONDecoder().decode([PaperCollection].self, from: data) {
            collections = decoded
        }

        // Reading history
        if let data = UserDefaults.standard.data(forKey: readingHistoryKey),
           let decoded = try? JSONDecoder().decode([String: Date].self, from: data) {
            readingHistory = decoded
        }

        // Settings
        aiEnabled = UserDefaults.standard.object(forKey: settingsPrefix + "aiEnabled") as? Bool ?? true
        autoSummarize = UserDefaults.standard.object(forKey: settingsPrefix + "autoSummarize") as? Bool ?? true
        textSizeMultiplier = UserDefaults.standard.object(forKey: settingsPrefix + "textSize") as? Double ?? 1.0
    }

    private func saveCollections() {
        if let data = try? JSONEncoder().encode(collections) {
            UserDefaults.standard.set(data, forKey: collectionsKey)
        }
    }

    private func saveReadingHistory() {
        if let data = try? JSONEncoder().encode(readingHistory) {
            UserDefaults.standard.set(data, forKey: readingHistoryKey)
        }
    }

    func saveSetting(_ key: String, value: Bool) {
        UserDefaults.standard.set(value, forKey: settingsPrefix + key)
    }

    func saveSetting(_ key: String, value: Double) {
        UserDefaults.standard.set(value, forKey: settingsPrefix + key)
    }
}

enum SkimError: LocalizedError {
    case notAuthenticated
    case serverError(String)
    case networkError
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Please sign in"
        case .serverError(let msg): return msg
        case .networkError: return "Network error. Check your connection."
        case .invalidURL: return "Invalid paper URL"
        }
    }
}
