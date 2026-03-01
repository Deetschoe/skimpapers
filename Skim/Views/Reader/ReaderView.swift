import SwiftUI
import UIKit

struct ReaderView: View {
    let paper: Paper

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab: ReaderTab = .pdf
    @State private var fullPaper: Paper?
    @State private var annotations: [Annotation] = []
    @State private var isLoadingPaper = false
    @State private var isLoadingAnnotations = false
    @State private var loadError: String?
    @State private var showAISheet = false
    @State private var selectedTextForAI: String?
    @State private var viewOpacity: Double = 0
    @State private var showTabBar = true

    private enum ReaderTab: String, CaseIterable {
        case pdf = "PDF"
        case summary = "Summary"
        case annotations = "Notes"
    }

    private var displayPaper: Paper {
        fullPaper ?? paper
    }

    private var markdownContent: String? {
        displayPaper.markdownContent
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            SkimTheme.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Minimal navigation bar
                navigationBar

                // Content area
                switch selectedTab {
                case .pdf:
                    pdfTabContent
                case .summary:
                    scrollContent
                case .annotations:
                    scrollContent
                }
            }

            // Floating tab selector overlay at the bottom
            VStack {
                Spacer()

                HStack(spacing: 0) {
                    // Floating tab bar
                    floatingTabBar
                        .padding(.leading, SkimTheme.paddingMedium)

                    Spacer()

                    // Floating AI button inline with tabs
                    if selectedTab != .pdf {
                        floatingAIButton
                            .padding(.trailing, SkimTheme.paddingMedium)
                    }
                }
                .padding(.bottom, 12)
            }
        }
        .opacity(viewOpacity)
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) {
                viewOpacity = 1.0
            }
            appState.markAsRead(paper)
            loadFullPaper()
            loadAnnotations()
        }
        .sheet(isPresented: $showAISheet) {
            AIAssistantSheet(
                paper: displayPaper,
                selectedText: selectedTextForAI,
                markdownContent: markdownContent
            )
            .environmentObject(appState)
        }
        .navigationBarHidden(true)
    }

    // MARK: - Navigation Bar

    private var navigationBar: some View {
        HStack(spacing: SkimTheme.paddingSmall) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(SkimTheme.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(SkimTheme.surfaceElevated.opacity(0.9))
                    .clipShape(Circle())
            }

            Text(paper.title)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            if let urlString = paper.pdfURL ?? URL(string: paper.url).map({ $0.absoluteString }) {
                ShareLink(item: urlString) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(SkimTheme.textPrimary)
                        .frame(width: 36, height: 36)
                        .background(SkimTheme.surfaceElevated.opacity(0.9))
                        .clipShape(Circle())
                }
            }
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
        .padding(.vertical, 6)
        .background(SkimTheme.background)
    }

    // MARK: - PDF Tab Content (full screen)

    private var pdfTabContent: some View {
        PDFReaderView(
            paper: displayPaper,
            onAskAI: { text in
                selectedTextForAI = text
                showAISheet = true
            },
            onCaptureRegion: { _ in },
            showNavigationBar: false
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: - Scroll Content (Summary / Notes)

    private var scrollContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 0) {
                paperMetadataHeader
                    .padding(.bottom, SkimTheme.paddingLarge)

                nonPdfTabContent
                    .padding(.bottom, 120) // space for floating tab bar
            }
            .padding(.horizontal, SkimTheme.paddingMedium)
        }
    }

    // MARK: - Metadata Header

    private var paperMetadataHeader: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
            // Category & Source row
            HStack(spacing: SkimTheme.paddingSmall) {
                Label(paper.category.rawValue, systemImage: paper.category.icon)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.accentSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(SkimTheme.accentSecondary.opacity(0.15))
                    )

                Text(paper.source.displayName)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(SkimTheme.accent.opacity(0.12))
                    )

                Spacer()

                if let rating = paper.rating {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 11))
                        Text("\(rating)/10")
                            .font(SkimTheme.captionFont)
                    }
                    .foregroundColor(SkimTheme.ratingColor(for: paper.rating))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(SkimTheme.ratingColor(for: paper.rating).opacity(0.12))
                    )
                }
            }

            // Title
            Text(paper.title)
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)

            // Authors
            Text(paper.formattedAuthors)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)

            // Published date
            if !paper.formattedDate.isEmpty {
                Text(paper.formattedDate)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textTertiary)
            }
        }
        .padding(.top, SkimTheme.paddingSmall)
    }

    // MARK: - Floating Tab Bar

    private var floatingTabBar: some View {
        HStack(spacing: 4) {
            ForEach(ReaderTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        selectedTab = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(SkimTheme.captionFont)
                        .foregroundColor(selectedTab == tab ? .white : SkimTheme.textSecondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(
                            Capsule()
                                .fill(selectedTab == tab ? SkimTheme.accent : Color.clear)
                        )
                }
            }
        }
        .padding(4)
        .background(
            Capsule()
                .fill(SkimTheme.surfaceElevated.opacity(0.95))
                .shadow(color: .black.opacity(0.25), radius: 12, x: 0, y: 4)
                .overlay(
                    Capsule()
                        .stroke(SkimTheme.border.opacity(0.5), lineWidth: 0.5)
                )
        )
    }

    // MARK: - Tab Content (non-PDF tabs, rendered inside ScrollView)

    @ViewBuilder
    private var nonPdfTabContent: some View {
        Group {
            switch selectedTab {
            case .pdf:
                EmptyView()
            case .summary:
                summaryTabContent
                    .transition(.opacity)
            case .annotations:
                annotationsTabContent
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: selectedTab)
    }

    // MARK: - Summary Tab

    private var summaryTabContent: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
            // AI Summary card
            if let summary = displayPaper.summary {
                VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(SkimTheme.accent)
                        Text("AI Summary")
                            .font(SkimTheme.subheadingFont)
                            .foregroundColor(SkimTheme.accent)
                    }

                    Text(summary)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textPrimary)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(SkimTheme.paddingMedium)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                        .fill(SkimTheme.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                                .stroke(SkimTheme.accent.opacity(0.2), lineWidth: 1)
                        )
                )
            } else {
                summaryPlaceholder
            }

            // Rating breakdown card
            if let rating = displayPaper.rating {
                ratingCard(rating: rating)
            }

            // Abstract card
            VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
                Text("Abstract")
                    .font(SkimTheme.subheadingFont)
                    .foregroundColor(SkimTheme.textPrimary)

                Text(paper.abstract)
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(SkimTheme.textSecondary)
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(SkimTheme.paddingMedium)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .fill(SkimTheme.surface)
            )

            // Tags
            if !paper.tags.isEmpty {
                tagsSection
            }
        }
    }

    private var summaryPlaceholder: some View {
        VStack(spacing: SkimTheme.paddingSmall) {
            Image(systemName: "sparkles")
                .font(.system(size: 28))
                .foregroundColor(SkimTheme.textTertiary)
            Text("Summary not yet available")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textSecondary)
            Text("Open the AI assistant to generate one")
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(SkimTheme.paddingLarge)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                        .foregroundColor(SkimTheme.border)
                )
        )
    }

    private func ratingCard(rating: Int) -> some View {
        HStack(spacing: SkimTheme.paddingMedium) {
            // Rating circle
            ZStack {
                Circle()
                    .stroke(SkimTheme.border, lineWidth: 4)
                    .frame(width: 56, height: 56)

                Circle()
                    .trim(from: 0, to: CGFloat(rating) / 10.0)
                    .stroke(
                        SkimTheme.ratingColor(for: rating),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .frame(width: 56, height: 56)
                    .rotationEffect(.degrees(-90))

                Text("\(rating)")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(SkimTheme.ratingColor(for: rating))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Quality Score")
                    .font(SkimTheme.subheadingFont)
                    .foregroundColor(SkimTheme.textPrimary)

                Text(ratingDescription(for: rating))
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textSecondary)
            }

            Spacer()
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    private func ratingDescription(for rating: Int) -> String {
        switch rating {
        case 9...10: return "Exceptional - groundbreaking work"
        case 7...8: return "Strong - well-executed research"
        case 5...6: return "Decent - some notable findings"
        case 3...4: return "Below average - limited impact"
        default: return "Weak - significant concerns"
        }
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
            Text("Topics")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)

            FlowLayout(spacing: 8) {
                ForEach(paper.tags, id: \.self) { tag in
                    Text(tag)
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.accentSecondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(SkimTheme.accentSecondary.opacity(0.12))
                        )
                }
            }
        }
        .padding(SkimTheme.paddingMedium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - Annotations Tab

    private var annotationsTabContent: some View {
        VStack(spacing: SkimTheme.paddingMedium) {
            if isLoadingAnnotations {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: SkimTheme.accent))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
            } else if annotations.isEmpty {
                emptyAnnotationsView
            } else {
                ForEach(annotations) { annotation in
                    annotationCard(annotation)
                }
            }
        }
    }

    private var emptyAnnotationsView: some View {
        VStack(spacing: SkimTheme.paddingMedium) {
            Image(systemName: "highlighter")
                .font(.system(size: 36))
                .foregroundColor(SkimTheme.textTertiary)

            Text("No annotations yet")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textSecondary)

            Text("Highlight text in the PDF and ask AI,\nor use the AI assistant to save insights")
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
                .multilineTextAlignment(.center)

            Button {
                showAISheet = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 14))
                    Text("Ask AI")
                }
            }
            .buttonStyle(SkimButtonStyle())
            .padding(.top, SkimTheme.paddingSmall)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
    }

    private func annotationCard(_ annotation: Annotation) -> some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
            // Selected text quote
            HStack(alignment: .top, spacing: 8) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(SkimTheme.accentSecondary)
                    .frame(width: 3)

                Text(annotation.selectedText ?? "")
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(SkimTheme.accentSecondary)
                    .italic()
                    .lineLimit(4)
            }

            // User note
            if let note = annotation.note, !note.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                        .font(.system(size: 11))
                        .foregroundColor(SkimTheme.textTertiary)
                    Text(note)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textSecondary)
                }
            }

            // AI response
            if let aiResponse = annotation.aiResponse, !aiResponse.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 11))
                        .foregroundColor(SkimTheme.accent)
                        .padding(.top, 2)
                    Text(aiResponse)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textPrimary)
                        .lineSpacing(4)
                }
                .padding(SkimTheme.paddingSmall)
                .background(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                        .fill(SkimTheme.accent.opacity(0.06))
                )
            }

            // Timestamp
            HStack {
                if let page = annotation.pageNumber {
                    Text("Page \(page)")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(SkimTheme.textTertiary)
                }
                Spacer()
                Text(annotation.createdAt.prefix(10))
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(SkimTheme.textTertiary)
            }
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                        .stroke(SkimTheme.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Floating AI Button

    private var floatingAIButton: some View {
        Button {
            selectedTextForAI = nil
            showAISheet = true
        } label: {
            ZStack {
                Circle()
                    .fill(SkimTheme.accent)
                    .frame(width: 48, height: 48)
                    .shadow(color: SkimTheme.accent.opacity(0.4), radius: 12, x: 0, y: 4)

                Image(systemName: "brain.head.profile")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
    }

    // MARK: - Data Loading

    private func loadFullPaper() {
        guard let token = appState.currentUser?.token else {
            loadError = "Not authenticated"
            return
        }
        isLoadingPaper = true
        loadError = nil

        Task {
            do {
                let loaded = try await APIService.shared.getPaper(id: paper.id, token: token)
                withAnimation(.easeInOut(duration: 0.3)) {
                    fullPaper = loaded
                    isLoadingPaper = false
                }
            } catch {
                print("loadFullPaper error for \(paper.id):", error)
                withAnimation {
                    loadError = error.localizedDescription
                    isLoadingPaper = false
                }
            }
        }
    }

    private func loadAnnotations() {
        guard let token = appState.currentUser?.token else { return }
        isLoadingAnnotations = true

        Task {
            do {
                let loaded = try await APIService.shared.getAnnotations(
                    paperId: paper.id,
                    token: token
                )
                withAnimation(.easeInOut(duration: 0.3)) {
                    annotations = loaded
                    isLoadingAnnotations = false
                }
            } catch {
                withAnimation {
                    isLoadingAnnotations = false
                }
            }
        }
    }
}

// MARK: - Flow Layout for Tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(in: proposal.width ?? 0, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(in: bounds.width, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func layout(in width: CGFloat, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > width, currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            maxWidth = max(maxWidth, currentX - spacing)
        }

        return (CGSize(width: maxWidth, height: currentY + lineHeight), positions)
    }
}

#Preview {
    NavigationStack {
        ReaderView(paper: Paper(
            id: "preview-1",
            title: "Attention Is All You Need",
            authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
            abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.",
            url: "https://arxiv.org/abs/1706.03762",
            pdfURL: nil,
            markdownContent: "# Attention Is All You Need\n\n## Abstract\n\nThe dominant sequence transduction models...\n\n## 1. Introduction\n\nRecurrent neural networks, long short-term memory and gated recurrent neural networks...",
            summary: "This paper introduces the Transformer, a novel architecture based entirely on attention mechanisms, dispensing with recurrence and convolutions. It achieves state-of-the-art results on machine translation tasks while being more parallelizable and requiring significantly less time to train.",
            rating: 10,
            category: .computerScience,
            tags: ["transformers", "attention", "NLP", "deep learning"],
            source: .arxiv,
            publishedDate: "2017-06-12",
            addedDate: "2025-01-15T10:30:00Z",
            isRead: false
        ))
        .environmentObject(AppState())
    }
}
