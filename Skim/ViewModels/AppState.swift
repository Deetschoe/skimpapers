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
                print("[Boot] Found saved token, validating...")
                do {
                    let user = try await api.validateToken(token)
                    print("[Boot] Token valid, user:", user.email)
                    self.currentUser = user
                    await loadPapers()
                    await loadCollections()
                    withAnimation(.easeInOut(duration: 0.5)) {
                        self.currentScreen = .home
                    }
                } catch {
                    print("[Boot] Token validation failed:", error)
                    KeychainService.deleteToken()
                    withAnimation(.easeInOut(duration: 0.5)) {
                        self.currentScreen = .auth
                    }
                }
            } else {
                print("[Boot] No saved token, showing auth")
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
        await loadCollections()
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

    func addPaperFromPDF(data: Data, filename: String) async throws {
        guard let token = currentUser?.token else { throw SkimError.notAuthenticated }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let paper = try await api.uploadPDF(data: data, filename: filename, token: token)
        withAnimation {
            papers.insert(paper, at: 0)
        }
    }

    func loadPapers() async {
        guard let token = currentUser?.token else { return }
        do {
            papers = try await api.getPapers(token: token)
        } catch {
            print("loadPapers error:", error)
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

    /// Fetch all collections from the backend and populate each with its paper IDs.
    /// Falls back to the locally cached collections if the network request fails.
    func loadCollections() async {
        guard let token = currentUser?.token else { return }
        do {
            var fetched = try await api.getCollections(token: token)
            // The backend GET /collections does not return paperIds, only paperCount.
            // Fetch the paper list for each collection to populate paperIds.
            for i in fetched.indices {
                do {
                    let papers = try await api.getCollectionPapers(
                        collectionId: fetched[i].id, token: token
                    )
                    fetched[i].paperIds = papers.map(\.id)
                } catch {
                    // If fetching papers for one collection fails, keep paperIds empty
                    print("Failed to load papers for collection \(fetched[i].id): \(error)")
                }
            }
            collections = fetched
            saveCollections() // cache locally
        } catch {
            // Network failure — keep whatever was loaded from UserDefaults
            print("Failed to load collections from backend: \(error)")
        }
    }

    /// Create a collection on the backend. Updates the local list optimistically,
    /// then replaces the placeholder with the server-assigned collection.
    func createCollection(name: String, icon: String = "folder.fill", colorName: String = "accent") {
        // Optimistic local insert with a temporary ID
        let placeholder = PaperCollection(name: name, icon: icon, colorName: colorName)
        withAnimation {
            collections.append(placeholder)
        }
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                let created = try await api.createCollection(
                    name: name, icon: icon, colorName: colorName, token: token
                )
                // Replace the placeholder with the server-assigned collection
                if let index = collections.firstIndex(where: { $0.id == placeholder.id }) {
                    collections[index] = created
                }
                saveCollections()
            } catch {
                print("Failed to create collection on backend: \(error)")
                // Roll back the optimistic insert
                withAnimation {
                    collections.removeAll { $0.id == placeholder.id }
                }
                saveCollections()
            }
        }
    }

    /// Delete a collection on the backend. Removes locally first (optimistic).
    func deleteCollection(_ collection: PaperCollection) {
        withAnimation {
            collections.removeAll { $0.id == collection.id }
        }
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                try await api.deleteCollection(id: collection.id, token: token)
            } catch {
                print("Failed to delete collection on backend: \(error)")
                // Re-insert the collection on failure
                withAnimation {
                    collections.append(collection)
                }
                saveCollections()
            }
        }
    }

    /// Rename a collection locally and persist to the backend.
    func renameCollection(_ collection: PaperCollection, to name: String) {
        guard let index = collections.firstIndex(where: { $0.id == collection.id }) else { return }
        let oldName = collections[index].name
        collections[index].name = name
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                _ = try await api.updateCollection(
                    id: collection.id, name: name, icon: nil, colorName: nil, token: token
                )
            } catch {
                print("Failed to rename collection on backend: \(error)")
                // Roll back
                if let idx = collections.firstIndex(where: { $0.id == collection.id }) {
                    collections[idx].name = oldName
                    saveCollections()
                }
            }
        }
    }

    /// Update a collection's icon and color locally and persist to the backend.
    func updateCollectionAppearance(_ collection: PaperCollection, icon: String, colorName: String) {
        guard let index = collections.firstIndex(where: { $0.id == collection.id }) else { return }
        let oldIcon = collections[index].icon
        let oldColor = collections[index].colorName
        collections[index].icon = icon
        collections[index].colorName = colorName
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                _ = try await api.updateCollection(
                    id: collection.id, name: nil, icon: icon, colorName: colorName, token: token
                )
            } catch {
                print("Failed to update collection appearance on backend: \(error)")
                // Roll back
                if let idx = collections.firstIndex(where: { $0.id == collection.id }) {
                    collections[idx].icon = oldIcon
                    collections[idx].colorName = oldColor
                    saveCollections()
                }
            }
        }
    }

    /// Add a paper to a collection locally and persist to the backend.
    func addPaper(_ paper: Paper, to collection: PaperCollection) {
        guard let index = collections.firstIndex(where: { $0.id == collection.id }) else { return }
        guard !collections[index].paperIds.contains(paper.id) else { return }
        collections[index].paperIds.append(paper.id)
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                try await api.addPaperToCollection(
                    collectionId: collection.id, paperId: paper.id, token: token
                )
            } catch {
                print("Failed to add paper to collection on backend: \(error)")
                // Roll back
                if let idx = collections.firstIndex(where: { $0.id == collection.id }) {
                    collections[idx].paperIds.removeAll { $0 == paper.id }
                    saveCollections()
                }
            }
        }
    }

    /// Remove a paper from a collection locally and persist to the backend.
    func removePaper(_ paper: Paper, from collection: PaperCollection) {
        guard let index = collections.firstIndex(where: { $0.id == collection.id }) else { return }
        collections[index].paperIds.removeAll { $0 == paper.id }
        saveCollections()

        Task {
            guard let token = currentUser?.token else { return }
            do {
                try await api.removePaperFromCollection(
                    collectionId: collection.id, paperId: paper.id, token: token
                )
            } catch {
                print("Failed to remove paper from collection on backend: \(error)")
                // Roll back — re-add the paper ID
                if let idx = collections.firstIndex(where: { $0.id == collection.id }) {
                    if !collections[idx].paperIds.contains(paper.id) {
                        collections[idx].paperIds.append(paper.id)
                    }
                    saveCollections()
                }
            }
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
        collections = []
        usage = nil
        saveCollections()
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
