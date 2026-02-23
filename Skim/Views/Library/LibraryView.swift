import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var appState: AppState

    @State private var showingAddPaper = false
    @State private var showingSettings = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Full-bleed background
                SkimTheme.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // MARK: - Top Bar
                    topBar

                    // MARK: - Search
                    searchBar
                        .padding(.horizontal, SkimTheme.paddingMedium)
                        .padding(.top, SkimTheme.paddingSmall)

                    // MARK: - Category Filters
                    categoryChips
                        .padding(.top, 12)

                    // MARK: - Paper List
                    if appState.filteredPapers.isEmpty {
                        emptyState
                    } else {
                        paperList
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
            .sheet(isPresented: $showingAddPaper) {
                AddPaperView()
                    .environmentObject(appState)
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
                    .environmentObject(appState)
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

            Button {
                showingSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 20))
                    .foregroundColor(SkimTheme.textSecondary)
                    .frame(width: 40, height: 40)
                    .background(SkimTheme.surface)
                    .clipShape(Circle())
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

            TextField("Search papers, authors, tags...", text: $appState.searchText)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textPrimary)
                .tint(SkimTheme.inputTint)
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

    // MARK: - Category Filter Chips

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SkimTheme.paddingSmall) {
                // "All" chip
                CategoryChipView(
                    label: "All",
                    icon: "square.grid.2x2",
                    isSelected: appState.selectedCategory == nil
                ) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        appState.selectedCategory = nil
                    }
                }

                ForEach(PaperCategory.allCases) { category in
                    CategoryChipView(
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

    // MARK: - Paper List

    private var paperList: some View {
        ScrollView {
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
            .padding(.top, 12)
            .padding(.bottom, 100) // Room for floating button
        }
        .refreshable {
            await appState.loadPapers()
        }
        .navigationDestination(for: Paper.self) { paper in
            ReaderView(paper: paper)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "books.vertical")
                .font(.system(size: 56))
                .foregroundColor(SkimTheme.textTertiary)
                .symbolEffect(.pulse, options: .repeating.speed(0.5))

            Text("No papers yet")
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textSecondary)

            Text("Tap the + button to add your first\nresearch paper.")
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
            // Delete background
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
                        .onEnded { value in
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

private extension View {
    func swipeToDelete(perform action: @escaping () -> Void) -> some View {
        modifier(SwipeToDeleteModifier(onDelete: action))
    }
}

// MARK: - Category Chip

private struct CategoryChipView: View {
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

#Preview {
    LibraryView()
        .environmentObject(AppState())
}
