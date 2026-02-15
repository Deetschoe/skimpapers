import SwiftUI
import PDFKit

// MARK: - PDFReaderView

struct PDFReaderView: View {
    let paper: Paper
    let onAskAI: (String?) -> Void
    let onCaptureRegion: (UIImage) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var pdfDocument: PDFDocument?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var currentPage: Int = 1
    @State private var totalPages: Int = 0
    @State private var isScrubbing = false
    @State private var scrubPage: Int = 1
    @State private var showContextMenu = false
    @State private var contextMenuPosition: CGPoint = .zero
    @State private var isCapturingRegion = false
    @State private var captureStart: CGPoint?
    @State private var captureEnd: CGPoint?
    @State private var selectedText: String?
    @State private var viewOpacity: Double = 0
    @State private var pageIndicatorOpacity: Double = 1.0
    @State private var hidePageIndicatorTask: DispatchWorkItem?

    var body: some View {
        ZStack {
            SkimTheme.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                navigationBar
                pdfContent
            }

            // Right-edge scrub zone
            scrubOverlay

            // Context menu
            if showContextMenu {
                contextMenuOverlay
            }

            // Region capture overlay
            if isCapturingRegion {
                regionCaptureOverlay
            }

            // Page indicator pill
            pageIndicatorPill
        }
        .opacity(viewOpacity)
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) {
                viewOpacity = 1.0
            }
            loadPDF()
        }
        .navigationBarHidden(true)
    }

    // MARK: - Navigation Bar

    private var navigationBar: some View {
        HStack(spacing: SkimTheme.paddingMedium) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(SkimTheme.textPrimary)
                    .frame(width: 40, height: 40)
                    .background(SkimTheme.surfaceElevated)
                    .clipShape(Circle())
            }

            Text(paper.title)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textSecondary)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            if let urlString = paper.pdfURL ?? URL(string: paper.url).map({ $0.absoluteString }) {
                ShareLink(item: urlString) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(SkimTheme.textPrimary)
                        .frame(width: 40, height: 40)
                        .background(SkimTheme.surfaceElevated)
                        .clipShape(Circle())
                }
            }
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
        .padding(.vertical, SkimTheme.paddingSmall)
        .background(SkimTheme.background)
    }

    // MARK: - PDF Content

    @ViewBuilder
    private var pdfContent: some View {
        if isLoading {
            loadingView
        } else if let error = errorMessage {
            errorView(error)
        } else if let document = pdfDocument {
            PDFKitRepresentable(
                document: document,
                currentPage: $currentPage,
                totalPages: $totalPages,
                selectedText: $selectedText,
                onDoubleTap: { location in
                    showContextMenu(at: location)
                }
            )
            .ignoresSafeArea(edges: .bottom)
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: SkimTheme.paddingMedium) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: SkimTheme.accent))
                .scaleEffect(1.5)

            Text("Loading PDF...")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textSecondary)

            Text(paper.title)
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Error View

    private func errorView(_ error: String) -> some View {
        VStack(spacing: SkimTheme.paddingMedium) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundColor(SkimTheme.destructive)

            Text("Failed to load PDF")
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textPrimary)

            Text(error)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                loadPDF()
            } label: {
                Text("Retry")
            }
            .buttonStyle(SkimButtonStyle())
            .padding(.top, SkimTheme.paddingSmall)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Right-Edge Scrub Overlay

    private var scrubOverlay: some View {
        GeometryReader { geometry in
            // Invisible touch zone on right edge
            Color.clear
                .frame(width: 60)
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
                .position(x: geometry.size.width - 30, y: geometry.size.height / 2)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            guard totalPages > 0 else { return }
                            if !isScrubbing {
                                withAnimation(.easeOut(duration: 0.15)) {
                                    isScrubbing = true
                                }
                            }
                            // Map vertical position to page number
                            let safeAreaTop: CGFloat = 100
                            let safeAreaBottom: CGFloat = 60
                            let usableHeight = geometry.size.height - safeAreaTop - safeAreaBottom
                            let clampedY = min(max(value.location.y - safeAreaTop, 0), usableHeight)
                            let fraction = clampedY / usableHeight
                            let page = max(1, min(totalPages, Int(round(fraction * Double(totalPages - 1))) + 1))
                            scrubPage = page
                        }
                        .onEnded { _ in
                            // Navigate to the scrubbed page
                            currentPage = scrubPage
                            withAnimation(.easeOut(duration: 0.3)) {
                                isScrubbing = false
                            }
                        }
                )

            // Scrub indicator
            if isScrubbing && totalPages > 0 {
                let safeAreaTop: CGFloat = 100
                let safeAreaBottom: CGFloat = 60
                let usableHeight = geometry.size.height - safeAreaTop - safeAreaBottom
                let yPosition = safeAreaTop + usableHeight * (Double(scrubPage - 1) / max(Double(totalPages - 1), 1))

                HStack(spacing: 10) {
                    // Page label
                    Text("Page \(scrubPage)")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundColor(SkimTheme.textPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(SkimTheme.surfaceElevated)
                                .shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 2)
                        )

                    // Scrub thumb
                    RoundedRectangle(cornerRadius: 3)
                        .fill(SkimTheme.accent)
                        .frame(width: 6, height: 44)
                        .shadow(color: SkimTheme.accent.opacity(0.4), radius: 6, x: 0, y: 0)
                }
                .position(x: geometry.size.width - 65, y: yPosition)
                .transition(.opacity.combined(with: .scale(scale: 0.8)))
                .animation(.interactiveSpring(response: 0.2, dampingFraction: 0.8), value: scrubPage)
            }
        }
        .allowsHitTesting(pdfDocument != nil)
    }

    // MARK: - Context Menu Overlay

    private var contextMenuOverlay: some View {
        ZStack {
            // Dismiss backdrop
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showContextMenu = false
                    }
                }

            // Floating menu
            VStack(spacing: 0) {
                ContextMenuButton(
                    icon: "brain.head.profile",
                    title: "Ask AI about this",
                    iconColor: SkimTheme.accent
                ) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showContextMenu = false
                    }
                    onAskAI(selectedText)
                }

                Divider()
                    .overlay(SkimTheme.border)

                ContextMenuButton(
                    icon: "viewfinder",
                    title: "Capture region",
                    iconColor: SkimTheme.accentSecondary
                ) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showContextMenu = false
                    }
                    withAnimation(.easeInOut(duration: 0.25)) {
                        isCapturingRegion = true
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .fill(SkimTheme.surfaceElevated)
                    .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 8)
                    .overlay(
                        RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                            .stroke(SkimTheme.border, lineWidth: 1)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: SkimTheme.cornerRadius))
            .frame(width: 220)
            .position(contextMenuClampedPosition)
            .transition(.scale(scale: 0.85, anchor: .center).combined(with: .opacity))
        }
    }

    private var contextMenuClampedPosition: CGPoint {
        // Clamp the context menu position so it doesn't go off-screen
        let menuWidth: CGFloat = 220
        let menuHeight: CGFloat = 110
        let padding: CGFloat = 16

        let screenWidth = UIScreen.main.bounds.width
        let screenHeight = UIScreen.main.bounds.height

        let x = min(max(contextMenuPosition.x, padding + menuWidth / 2), screenWidth - padding - menuWidth / 2)
        let y = min(max(contextMenuPosition.y, padding + menuHeight / 2 + 60), screenHeight - padding - menuHeight / 2 - 40)

        return CGPoint(x: x, y: y)
    }

    // MARK: - Region Capture Overlay

    private var regionCaptureOverlay: some View {
        ZStack {
            // Semi-transparent backdrop
            Color.black.opacity(0.4)
                .ignoresSafeArea()

            // Instructions
            VStack {
                HStack {
                    Spacer()

                    Button {
                        withAnimation(.easeOut(duration: 0.2)) {
                            isCapturingRegion = false
                            captureStart = nil
                            captureEnd = nil
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(SkimTheme.textPrimary)
                            .frame(width: 36, height: 36)
                            .background(SkimTheme.surfaceElevated)
                            .clipShape(Circle())
                    }
                    .padding(.trailing, SkimTheme.paddingMedium)
                    .padding(.top, SkimTheme.paddingSmall)
                }

                if captureStart == nil {
                    Spacer()
                    Text("Drag to select a region")
                        .font(SkimTheme.subheadingFont)
                        .foregroundColor(SkimTheme.textPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(
                            Capsule()
                                .fill(SkimTheme.surfaceElevated)
                                .shadow(color: .black.opacity(0.3), radius: 10)
                        )
                    Spacer()
                }

                Spacer()
            }

            // Selection rectangle
            if let start = captureStart, let end = captureEnd {
                let rect = normalizedRect(from: start, to: end)
                Rectangle()
                    .stroke(SkimTheme.accent, lineWidth: 2.5)
                    .background(
                        Rectangle()
                            .fill(SkimTheme.accent.opacity(0.1))
                    )
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)

                // Corner handles
                ForEach(cornerPoints(of: rect), id: \.x) { point in
                    Circle()
                        .fill(SkimTheme.accent)
                        .frame(width: 10, height: 10)
                        .shadow(color: SkimTheme.accent.opacity(0.5), radius: 4)
                        .position(point)
                }
            }
        }
        .gesture(
            DragGesture(minimumDistance: 5)
                .onChanged { value in
                    if captureStart == nil {
                        captureStart = value.startLocation
                    }
                    captureEnd = value.location
                }
                .onEnded { _ in
                    performRegionCapture()
                }
        )
    }

    // MARK: - Page Indicator Pill

    private var pageIndicatorPill: some View {
        VStack {
            Spacer()

            if totalPages > 0 && !isScrubbing {
                HStack(spacing: 6) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(SkimTheme.accent)

                    Text("\(currentPage) / \(totalPages)")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(SkimTheme.textPrimary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(SkimTheme.surfaceElevated)
                        .shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 2)
                        .overlay(
                            Capsule()
                                .stroke(SkimTheme.border, lineWidth: 1)
                        )
                )
                .opacity(pageIndicatorOpacity)
                .padding(.bottom, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .onChange(of: currentPage) { _, _ in
                    showPageIndicatorBriefly()
                }
                .onAppear {
                    showPageIndicatorBriefly()
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: totalPages)
    }

    // MARK: - Helpers

    private func loadPDF() {
        guard let urlString = paper.pdfURL, let url = URL(string: urlString) else {
            isLoading = false
            errorMessage = "No PDF URL available for this paper."
            return
        }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                let (data, response) = try await URLSession.shared.data(from: url)

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    await MainActor.run {
                        isLoading = false
                        errorMessage = "Server returned an error. Please try again."
                    }
                    return
                }

                guard let document = PDFDocument(data: data) else {
                    await MainActor.run {
                        isLoading = false
                        errorMessage = "The downloaded file is not a valid PDF."
                    }
                    return
                }

                await MainActor.run {
                    pdfDocument = document
                    totalPages = document.pageCount
                    currentPage = 1
                    withAnimation(.easeOut(duration: 0.3)) {
                        isLoading = false
                    }
                }
            } catch is CancellationError {
                // Task was cancelled, do nothing
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func showContextMenu(at location: CGPoint) {
        contextMenuPosition = location
        withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
            showContextMenu = true
        }
    }

    private func showPageIndicatorBriefly() {
        hidePageIndicatorTask?.cancel()
        withAnimation(.easeOut(duration: 0.15)) {
            pageIndicatorOpacity = 1.0
        }
        let task = DispatchWorkItem {
            withAnimation(.easeOut(duration: 0.8)) {
                pageIndicatorOpacity = 0.0
            }
        }
        hidePageIndicatorTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0, execute: task)
    }

    private func normalizedRect(from start: CGPoint, to end: CGPoint) -> CGRect {
        let x = min(start.x, end.x)
        let y = min(start.y, end.y)
        let width = abs(end.x - start.x)
        let height = abs(end.y - start.y)
        return CGRect(x: x, y: y, width: width, height: height)
    }

    private func cornerPoints(of rect: CGRect) -> [CGPoint] {
        [
            CGPoint(x: rect.minX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.minX, y: rect.maxY),
            CGPoint(x: rect.maxX, y: rect.maxY)
        ]
    }

    private func performRegionCapture() {
        guard let start = captureStart, let end = captureEnd else { return }
        let rect = normalizedRect(from: start, to: end)
        guard rect.width > 20, rect.height > 20 else {
            // Selection too small, reset
            captureStart = nil
            captureEnd = nil
            return
        }

        // Capture the region from the screen
        let renderer = UIGraphicsImageRenderer(size: rect.size)
        let image = renderer.image { context in
            // Get the key window scene
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let window = windowScene.windows.first(where: { $0.isKeyWindow }) else {
                return
            }
            // Translate context to the capture region
            context.cgContext.translateBy(x: -rect.origin.x, y: -rect.origin.y)
            window.layer.render(in: context.cgContext)
        }

        withAnimation(.easeOut(duration: 0.2)) {
            isCapturingRegion = false
            captureStart = nil
            captureEnd = nil
        }

        onCaptureRegion(image)
    }
}

// MARK: - PDFKitRepresentable

private struct PDFKitRepresentable: UIViewRepresentable {
    let document: PDFDocument
    @Binding var currentPage: Int
    @Binding var totalPages: Int
    @Binding var selectedText: String?
    let onDoubleTap: (CGPoint) -> Void

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.document = document
        pdfView.displayMode = .singlePage
        pdfView.displayDirection = .horizontal
        pdfView.usePageViewController(true, withViewOptions: nil)
        pdfView.autoScales = true
        pdfView.backgroundColor = UIColor(SkimTheme.background)
        pdfView.pageShadowsEnabled = false

        // Set initial page count
        DispatchQueue.main.async {
            totalPages = document.pageCount
        }

        // Register for page change notifications
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.pageDidChange(_:)),
            name: .PDFViewPageChanged,
            object: pdfView
        )

        // Register for selection change notifications
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.selectionDidChange(_:)),
            name: .PDFViewSelectionChanged,
            object: pdfView
        )

        // Add double-tap gesture recognizer
        let doubleTap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleDoubleTap(_:))
        )
        doubleTap.numberOfTapsRequired = 2
        doubleTap.delegate = context.coordinator
        pdfView.addGestureRecognizer(doubleTap)

        // Prevent existing double-tap gestures from conflicting
        for gestureRecognizer in pdfView.gestureRecognizers ?? [] {
            if let tapGesture = gestureRecognizer as? UITapGestureRecognizer,
               tapGesture.numberOfTapsRequired == 2,
               tapGesture !== doubleTap {
                tapGesture.require(toFail: doubleTap)
            }
        }

        context.coordinator.pdfView = pdfView
        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        // Navigate to the requested page when currentPage changes externally (e.g., from scrub)
        if let targetPage = document.page(at: currentPage - 1),
           pdfView.currentPage != targetPage {
            pdfView.go(to: targetPage)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let parent: PDFKitRepresentable
        weak var pdfView: PDFView?

        init(parent: PDFKitRepresentable) {
            self.parent = parent
        }

        @objc func pageDidChange(_ notification: Notification) {
            guard let pdfView = notification.object as? PDFView,
                  let currentPage = pdfView.currentPage,
                  let document = pdfView.document else { return }

            let pageIndex = document.index(for: currentPage)
            DispatchQueue.main.async {
                self.parent.currentPage = pageIndex + 1
            }
        }

        @objc func selectionDidChange(_ notification: Notification) {
            guard let pdfView = notification.object as? PDFView else { return }
            let text = pdfView.currentSelection?.string
            DispatchQueue.main.async {
                self.parent.selectedText = text
            }
        }

        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard gesture.state == .recognized else { return }
            // Get the tap location in the window coordinate space
            let locationInView = gesture.location(in: gesture.view)
            guard let window = gesture.view?.window else { return }
            let locationInWindow = gesture.view?.convert(locationInView, to: window) ?? locationInView
            DispatchQueue.main.async {
                self.parent.onDoubleTap(locationInWindow)
            }
        }

        // Allow our double-tap to work alongside PDFView's internal gestures
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            return true
        }
    }
}

// MARK: - ContextMenuButton

private struct ContextMenuButton: View {
    let icon: String
    let title: String
    let iconColor: Color
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button {
            action()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(iconColor)
                    .frame(width: 24, height: 24)

                Text(title)
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(SkimTheme.textPrimary)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(isPressed ? SkimTheme.surface : .clear)
        }
        .buttonStyle(.plain)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PDFReaderView(
            paper: Paper(
                id: "preview-1",
                title: "Attention Is All You Need",
                authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
                abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.",
                url: "https://arxiv.org/abs/1706.03762",
                pdfURL: "https://arxiv.org/pdf/1706.03762",
                markdownContent: nil,
                summary: "Introduces the Transformer architecture.",
                rating: 10,
                category: .computerScience,
                tags: ["transformers", "attention"],
                source: .arxiv,
                publishedDate: "2017-06-12",
                addedDate: "2025-01-15T10:30:00Z",
                isRead: false
            ),
            onAskAI: { text in
                print("Ask AI: \(text ?? "no selection")")
            },
            onCaptureRegion: { image in
                print("Captured region: \(image.size)")
            }
        )
    }
}
