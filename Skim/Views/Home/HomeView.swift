import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState

    @State private var showingAddPaper = false
    @State private var showingSettings = false
    @State private var showingNewCollection = false
    @State private var newCollectionName = ""

    var body: some View {
        NavigationStack {
            ZStack {
                SkimTheme.background
                    .ignoresSafeArea()

                if appState.papers.isEmpty {
                    VStack(spacing: 0) {
                        topBar
                        emptyState
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            // MARK: - Top Bar
                            topBar

                            // MARK: - Search Bar
                            searchBar
                                .padding(.horizontal, SkimTheme.paddingMedium)
                                .padding(.top, SkimTheme.paddingSmall)

                            // MARK: - Continue Reading
                            if !appState.recentlyReadPapers.isEmpty {
                                continueReadingSection
                                    .padding(.top, SkimTheme.paddingLarge)
                            }

                            // MARK: - Recommended
                            if !appState.recommendedPapers.isEmpty {
                                recommendedSection
                                    .padding(.top, SkimTheme.paddingLarge)
                            }

                            // MARK: - Collections
                            collectionsSection
                                .padding(.top, SkimTheme.paddingLarge)

                            // MARK: - All Papers
                            allPapersSection
                                .padding(.top, SkimTheme.paddingLarge)
                                .padding(.bottom, 100)
                        }
                    }
                    .refreshable {
                        await appState.loadPapers()
                    }
                }

                // MARK: - Floating Add Button
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        addButton
                    }
                }
                .padding(SkimTheme.paddingLarge)
            }
            .navigationBarHidden(true)
            .navigationDestination(for: Paper.self) { paper in
                ReaderView(paper: paper)
            }
            .navigationDestination(for: PaperCollection.self) { collection in
                CollectionDetailView(collection: collection)
            }
            .sheet(isPresented: $showingAddPaper) {
                AddPaperView()
                    .environmentObject(appState)
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
            .alert("New Collection", isPresented: $showingNewCollection) {
                TextField("Collection name", text: $newCollectionName)
                Button("Cancel", role: .cancel) {
                    newCollectionName = ""
                }
                Button("Create") {
                    let name = newCollectionName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty {
                        appState.createCollection(name: name)
                    }
                    newCollectionName = ""
                }
            } message: {
                Text("Enter a name for your new collection.")
            }
            .alert("Rename Collection", isPresented: $showingRenameAlert) {
                TextField("Collection name", text: $newCollectionName)
                Button("Cancel", role: .cancel) {
                    newCollectionName = ""
                    collectionToRename = nil
                }
                Button("Rename") {
                    let name = newCollectionName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty, let collection = collectionToRename {
                        appState.renameCollection(collection, to: name)
                    }
                    newCollectionName = ""
                    collectionToRename = nil
                }
            } message: {
                Text("Enter a new name for this collection.")
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            Text("skim")
                .font(SkimTheme.logoFontSmall)
                .foregroundColor(SkimTheme.accent)

            Spacer()

            HStack(spacing: 10) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 18))
                        .foregroundColor(SkimTheme.textSecondary)
                        .frame(width: 38, height: 38)
                        .background(SkimTheme.surface)
                        .clipShape(Circle())
                }

                Button {
                    showingAddPaper = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 38, height: 38)
                        .background(SkimTheme.accent)
                        .clipShape(Circle())
                }
            }
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
        .padding(.top, SkimTheme.paddingSmall)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(SkimTheme.textTertiary)
                .font(.system(size: 16))

            TextField("Search papers...", text: $appState.searchText)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textPrimary)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            if !appState.searchText.isEmpty {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        appState.searchText = ""
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(SkimTheme.textTertiary)
                        .font(.system(size: 16))
                }
            }
        }
        .padding(12)
        .background(SkimTheme.surface)
        .cornerRadius(SkimTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .stroke(SkimTheme.border, lineWidth: 1)
        )
    }

    // MARK: - Continue Reading Section

    private var continueReadingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "Continue Reading", icon: "book.fill")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(appState.recentlyReadPapers) { paper in
                        NavigationLink(value: paper) {
                            ContinueReadingCard(paper: paper)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, SkimTheme.paddingMedium)
            }
        }
    }

    // MARK: - Recommended Section

    private var recommendedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "Recommended", icon: "sparkles")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(appState.recommendedPapers) { paper in
                        NavigationLink(value: paper) {
                            RecommendedCard(paper: paper)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, SkimTheme.paddingMedium)
            }
        }
    }

    // MARK: - Collections Section

    private var collectionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionHeader(title: "Collections", icon: "folder.fill")
                Spacer()
                Button {
                    showingNewCollection = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                        Text("New")
                            .font(SkimTheme.captionFont)
                    }
                    .foregroundColor(SkimTheme.accent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(SkimTheme.accent.opacity(0.12))
                    )
                }
                .padding(.trailing, SkimTheme.paddingMedium)
            }

            if appState.collections.isEmpty {
                emptyCollectionsPlaceholder
                    .padding(.horizontal, SkimTheme.paddingMedium)
            } else {
                let columns = [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ]
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(appState.collections) { collection in
                        NavigationLink(value: collection) {
                            CollectionCard(
                                collection: collection,
                                paperCount: appState.papers(in: collection).count
                            )
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button {
                                newCollectionName = collection.name
                                // Use a slight delay so the context menu dismisses first
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                    showingRenameFor(collection)
                                }
                            } label: {
                                Label("Rename", systemImage: "pencil")
                            }

                            Button(role: .destructive) {
                                appState.deleteCollection(collection)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(.horizontal, SkimTheme.paddingMedium)
            }
        }
    }

    private var emptyCollectionsPlaceholder: some View {
        Button {
            showingNewCollection = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "plus.rectangle.on.folder")
                    .font(.system(size: 22))
                    .foregroundColor(SkimTheme.textTertiary)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Create your first collection")
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.textSecondary)
                    Text("Organize papers into folders")
                        .font(.system(size: 11))
                        .foregroundColor(SkimTheme.textTertiary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(SkimTheme.textTertiary)
            }
            .padding(SkimTheme.paddingMedium)
            .background(SkimTheme.surface)
            .cornerRadius(SkimTheme.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .stroke(SkimTheme.border.opacity(0.5), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - All Papers Section

    private var allPapersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "All Papers", icon: "doc.text.fill")

            // Category filter chips
            categoryChips

            LazyVStack(spacing: 12) {
                ForEach(appState.filteredPapers) { paper in
                    NavigationLink(value: paper) {
                        PaperCardView(paper: paper)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            Task { await appState.deletePaper(paper) }
                        } label: {
                            Label("Delete Paper", systemImage: "trash")
                        }
                    }
                    .swipeToDelete {
                        Task { await appState.deletePaper(paper) }
                    }
                }
            }
            .padding(.horizontal, SkimTheme.paddingMedium)
        }
    }

    // MARK: - Category Filter Chips

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SkimTheme.paddingSmall) {
                HomeCategoryChip(
                    label: "All",
                    icon: "square.grid.2x2",
                    isSelected: appState.selectedCategory == nil
                ) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        appState.selectedCategory = nil
                    }
                }

                ForEach(PaperCategory.allCases) { category in
                    HomeCategoryChip(
                        label: category.rawValue,
                        icon: category.icon,
                        isSelected: appState.selectedCategory == category
                    ) {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            appState.selectedCategory = (appState.selectedCategory == category) ? nil : category
                        }
                    }
                }
            }
            .padding(.horizontal, SkimTheme.paddingMedium)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "text.document.fill")
                .font(.system(size: 56))
                .foregroundColor(SkimTheme.textTertiary)
                .symbolEffect(.pulse, options: .repeating.speed(0.5))

            Text("Add your first paper")
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textSecondary)

            Text("Tap the + button to import a research\npaper and start reading.")
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textTertiary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)

            Spacer()
            Spacer()
        }
        .padding(.horizontal, SkimTheme.paddingLarge)
    }

    // MARK: - Floating Add Button

    private var addButton: some View {
        Button {
            showingAddPaper = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 58, height: 58)
                .background(
                    Circle()
                        .fill(SkimTheme.accent)
                        .shadow(color: SkimTheme.accent.opacity(0.4), radius: 12, x: 0, y: 4)
                )
        }
    }

    // MARK: - Helpers

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(SkimTheme.accent)

            Text(title)
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
    }

    @State private var collectionToRename: PaperCollection?
    @State private var showingRenameAlert = false

    private func showingRenameFor(_ collection: PaperCollection) {
        collectionToRename = collection
        showingRenameAlert = true
    }
}

// MARK: - Continue Reading Card

private struct ContinueReadingCard: View {
    let paper: Paper

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(paper.title)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            Text(paper.formattedAuthors)
                .font(.system(size: 11, weight: .regular, design: .rounded))
                .foregroundColor(SkimTheme.textSecondary)
                .lineLimit(1)

            Spacer()

            // Reading progress indicator
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(SkimTheme.border)
                        .frame(height: 3)
                    Capsule()
                        .fill(SkimTheme.accent)
                        .frame(width: geo.size.width * 0.6, height: 3)
                }
            }
            .frame(height: 3)
        }
        .padding(12)
        .frame(width: 170, height: 110)
        .background(SkimTheme.surfaceElevated)
        .cornerRadius(SkimTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .stroke(SkimTheme.border.opacity(0.5), lineWidth: 0.5)
        )
    }
}

// MARK: - Recommended Card

private struct RecommendedCard: View {
    let paper: Paper

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Category icon row
            HStack {
                Image(systemName: paper.category.icon)
                    .font(.system(size: 14))
                    .foregroundColor(SkimTheme.accent)

                Spacer()

                // Rating badge
                if paper.rating != nil {
                    HStack(spacing: 3) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 10))
                        Text(paper.ratingLabel)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(SkimTheme.ratingColor(for: paper.rating))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(SkimTheme.ratingColor(for: paper.rating).opacity(0.15))
                    )
                }
            }

            Text(paper.title)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textPrimary)
                .lineLimit(3)
                .multilineTextAlignment(.leading)

            Spacer()

            Text(paper.formattedAuthors)
                .font(.system(size: 11, weight: .regular, design: .rounded))
                .foregroundColor(SkimTheme.textTertiary)
                .lineLimit(1)
        }
        .padding(14)
        .frame(width: 200, height: 150)
        .background(SkimTheme.surfaceElevated)
        .cornerRadius(SkimTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            SkimTheme.accent.opacity(0.4),
                            SkimTheme.accentSecondary.opacity(0.3),
                            SkimTheme.accent.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
    }
}

// MARK: - Collection Card

private struct CollectionCard: View {
    let collection: PaperCollection
    let paperCount: Int

    private var color: Color {
        SkimTheme.collectionColor(for: collection.colorName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: collection.icon)
                .font(.system(size: 22))
                .foregroundColor(color)

            Spacer()

            Text(collection.name)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textPrimary)
                .lineLimit(1)

            Text("\(paperCount) paper\(paperCount == 1 ? "" : "s")")
                .font(.system(size: 11, weight: .regular, design: .rounded))
                .foregroundColor(SkimTheme.textTertiary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 110)
        .background(SkimTheme.surfaceElevated)
        .cornerRadius(SkimTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .stroke(color.opacity(0.25), lineWidth: 1)
        )
    }
}

// MARK: - Collection Detail View

private struct CollectionDetailView: View {
    let collection: PaperCollection

    @EnvironmentObject private var appState: AppState

    private var papersInCollection: [Paper] {
        appState.papers(in: collection)
    }

    var body: some View {
        ZStack {
            SkimTheme.background
                .ignoresSafeArea()

            if papersInCollection.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: collection.icon)
                        .font(.system(size: 44))
                        .foregroundColor(SkimTheme.collectionColor(for: collection.colorName).opacity(0.5))

                    Text("No papers in this collection")
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textSecondary)

                    Text("Add papers from the reader view.")
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.textTertiary)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(papersInCollection) { paper in
                            NavigationLink(value: paper) {
                                PaperCardView(paper: paper)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(role: .destructive) {
                                    appState.removePaper(paper, from: collection)
                                } label: {
                                    Label("Remove from Collection", systemImage: "folder.badge.minus")
                                }
                            }
                            .swipeToRemove {
                                withAnimation {
                                    appState.removePaper(paper, from: collection)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, SkimTheme.paddingMedium)
                    .padding(.top, 12)
                    .padding(.bottom, 40)
                }
            }
        }
        .navigationTitle(collection.name)
        .navigationBarTitleDisplayMode(.large)
    }
}

// MARK: - Swipe to Delete Modifier

private struct SwipeToDeleteModifier: ViewModifier {
    let onDelete: () -> Void

    @State private var offset: CGFloat = 0
    @State private var showingDelete = false

    private let deleteThreshold: CGFloat = -80
    private let triggerThreshold: CGFloat = -140

    func body(content: Content) -> some View {
        ZStack(alignment: .trailing) {
            HStack {
                Spacer()
                Image(systemName: "trash.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                    .frame(width: 70)
            }
            .frame(maxHeight: .infinity)
            .background(SkimTheme.destructive.opacity(showingDelete ? 1.0 : 0.0))
            .cornerRadius(SkimTheme.cornerRadius)

            content
                .offset(x: offset)
                .gesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            let translation = value.translation.width
                            if translation < 0 {
                                offset = translation * 0.6
                                showingDelete = offset < deleteThreshold
                            }
                        }
                        .onEnded { _ in
                            if offset < triggerThreshold {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    offset = -UIScreen.main.bounds.width
                                }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    onDelete()
                                }
                            } else {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                    offset = 0
                                    showingDelete = false
                                }
                            }
                        }
                )
        }
    }
}

// MARK: - Swipe to Remove Modifier

private struct SwipeToRemoveModifier: ViewModifier {
    let onRemove: () -> Void

    @State private var offset: CGFloat = 0
    @State private var showingRemove = false

    private let threshold: CGFloat = -80
    private let triggerThreshold: CGFloat = -140

    func body(content: Content) -> some View {
        ZStack(alignment: .trailing) {
            HStack {
                Spacer()
                Image(systemName: "folder.badge.minus")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                    .frame(width: 70)
            }
            .frame(maxHeight: .infinity)
            .background(Color.orange.opacity(showingRemove ? 1.0 : 0.0))
            .cornerRadius(SkimTheme.cornerRadius)

            content
                .offset(x: offset)
                .gesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            let translation = value.translation.width
                            if translation < 0 {
                                offset = translation * 0.6
                                showingRemove = offset < threshold
                            }
                        }
                        .onEnded { _ in
                            if offset < triggerThreshold {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    offset = -UIScreen.main.bounds.width
                                }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    onRemove()
                                }
                            } else {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                    offset = 0
                                    showingRemove = false
                                }
                            }
                        }
                )
        }
    }
}

private extension View {
    func swipeToDelete(perform action: @escaping () -> Void) -> some View {
        modifier(SwipeToDeleteModifier(onDelete: action))
    }

    func swipeToRemove(perform action: @escaping () -> Void) -> some View {
        modifier(SwipeToRemoveModifier(onRemove: action))
    }
}

// MARK: - Category Chip (Home)

private struct HomeCategoryChip: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                Text(label)
                    .font(SkimTheme.captionFont)
            }
            .foregroundColor(isSelected ? .white : SkimTheme.textSecondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isSelected ? SkimTheme.accent : SkimTheme.surface)
            )
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : SkimTheme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    HomeView()
        .environmentObject(AppState())
}
