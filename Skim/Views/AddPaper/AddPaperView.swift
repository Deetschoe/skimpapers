import SwiftUI
import UniformTypeIdentifiers

struct AddPaperView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var url = ""
    @State private var isProcessing = false
    @State private var showSuccess = false
    @State private var errorMessage: String?
    @State private var checkmarkScale: CGFloat = 0
    @State private var showFilePicker = false

    private var detectedSource: DetectedSource? {
        let lowered = url.lowercased()
        if lowered.contains("arxiv.org") {
            return DetectedSource(name: "arXiv", icon: "doc.text.fill", color: SkimTheme.accent)
        } else if lowered.contains("pubmed") || lowered.contains("ncbi.nlm.nih.gov") {
            return DetectedSource(name: "PubMed", icon: "cross.case.fill", color: SkimTheme.ratingGreen)
        } else if lowered.contains("biorxiv.org") {
            return DetectedSource(name: "bioRxiv", icon: "leaf.fill", color: SkimTheme.accentSecondary)
        } else if lowered.contains("scholar.google") {
            return DetectedSource(name: "Google Scholar", icon: "graduationcap.fill", color: SkimTheme.ratingYellow)
        } else if isValidURL {
            return DetectedSource(name: "Web", icon: "globe", color: SkimTheme.textSecondary)
        }
        return nil
    }

    private var isValidURL: Bool {
        guard !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SkimTheme.background.ignoresSafeArea()

                if showSuccess {
                    successView
                } else {
                    formContent
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(SkimTheme.textSecondary)
                    .disabled(isProcessing)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(isProcessing)
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [UTType.pdf],
            allowsMultipleSelection: false
        ) { result in
            handleFileImport(result)
        }
    }

    // MARK: - Form Content

    private var formContent: some View {
        VStack(spacing: 0) {
            VStack(spacing: SkimTheme.paddingLarge) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "doc.badge.plus")
                        .font(.system(size: 32))
                        .foregroundColor(SkimTheme.accent)

                    Text("Add Paper")
                        .font(SkimTheme.headingFont)
                        .foregroundColor(SkimTheme.textPrimary)

                    Text("Paste a link or upload a PDF")
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textSecondary)
                }
                .padding(.top, SkimTheme.paddingLarge)

                // URL input field + paste button
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Image(systemName: "link")
                            .foregroundColor(SkimTheme.textTertiary)
                            .font(.system(size: 16))

                        ZStack(alignment: .leading) {
                            if url.isEmpty {
                                Text("https://arxiv.org/abs/...")
                                    .font(SkimTheme.bodyFont)
                                    .foregroundStyle(SkimTheme.inputTint)
                                    .allowsHitTesting(false)
                            }
                            TextField("", text: $url)
                                .font(SkimTheme.bodyFont)
                                .foregroundColor(.white)
                                .tint(SkimTheme.inputTint)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                        }

                        Button {
                            if let clipboard = UIPasteboard.general.string {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    url = clipboard
                                }
                            }
                        } label: {
                            Image(systemName: "doc.on.clipboard")
                                .font(.system(size: 15))
                                .foregroundColor(SkimTheme.accent)
                                .frame(width: 36, height: 36)
                                .background(SkimTheme.accent.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall))
                        }
                    }
                    .padding(14)
                    .background(SkimTheme.surface)
                    .cornerRadius(SkimTheme.cornerRadius)
                    .overlay(
                        RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                            .stroke(
                                detectedSource != nil ? detectedSource!.color.opacity(0.4) : SkimTheme.border,
                                lineWidth: 1
                            )
                    )

                    // Detected source indicator
                    if let source = detectedSource {
                        HStack(spacing: 6) {
                            Image(systemName: source.icon)
                                .font(.system(size: 12))
                            Text("Detected: \(source.name)")
                                .font(SkimTheme.captionFont)
                        }
                        .foregroundColor(source.color)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .opacity
                        ))
                    }
                }
                .animation(.easeOut(duration: 0.25), value: detectedSource?.name)

                // Error message
                if let error = errorMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 13))
                        Text(error)
                            .font(SkimTheme.captionFont)
                    }
                    .foregroundColor(SkimTheme.destructive)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                            .fill(SkimTheme.destructive.opacity(0.1))
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Add by URL button
                Button {
                    addPaper()
                } label: {
                    HStack(spacing: 10) {
                        if isProcessing {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.85)
                            Text("Processing...")
                        } else {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Paper")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(SkimButtonStyle())
                .disabled(!isValidURL || isProcessing)
                .opacity(isValidURL ? 1.0 : 0.5)

                // Divider with "or"
                HStack {
                    Rectangle()
                        .fill(SkimTheme.border)
                        .frame(height: 1)
                    Text("or")
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.textTertiary)
                    Rectangle()
                        .fill(SkimTheme.border)
                        .frame(height: 1)
                }

                // Upload PDF button
                Button {
                    showFilePicker = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "doc.fill")
                        Text("Upload PDF from Files")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(SkimButtonStyle(isProminent: false))
                .disabled(isProcessing)
            }
            .padding(.horizontal, SkimTheme.paddingLarge)

            Spacer()
        }
    }

    // MARK: - Success View

    private var successView: some View {
        VStack(spacing: 20) {
            Spacer()

            ZStack {
                Circle()
                    .fill(SkimTheme.ratingGreen.opacity(0.12))
                    .frame(width: 100, height: 100)
                    .scaleEffect(checkmarkScale)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 56))
                    .foregroundColor(SkimTheme.ratingGreen)
                    .scaleEffect(checkmarkScale)
            }

            Text("Paper Added")
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .opacity(checkmarkScale)

            Text("Your paper is being processed")
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)
                .opacity(checkmarkScale)

            Spacer()
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6, blendDuration: 0)) {
                checkmarkScale = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                dismiss()
            }
        }
    }

    // MARK: - Actions

    private func addPaper() {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        withAnimation { errorMessage = nil }
        isProcessing = true

        Task {
            do {
                try await appState.addPaper(url: trimmed)
                withAnimation(.easeInOut(duration: 0.3)) {
                    isProcessing = false
                    showSuccess = true
                }
            } catch {
                withAnimation(.easeOut(duration: 0.3)) {
                    isProcessing = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let fileURL = urls.first else { return }

            // Must start security-scoped access for files from Files app
            guard fileURL.startAccessingSecurityScopedResource() else {
                withAnimation { errorMessage = "Unable to access file" }
                return
            }
            defer { fileURL.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: fileURL)
                let filename = fileURL.lastPathComponent

                withAnimation { errorMessage = nil }
                isProcessing = true

                Task {
                    do {
                        try await appState.addPaperFromPDF(data: data, filename: filename)
                        withAnimation(.easeInOut(duration: 0.3)) {
                            isProcessing = false
                            showSuccess = true
                        }
                    } catch {
                        withAnimation(.easeOut(duration: 0.3)) {
                            isProcessing = false
                            errorMessage = error.localizedDescription
                        }
                    }
                }
            } catch {
                withAnimation { errorMessage = "Failed to read PDF file" }
            }

        case .failure(let error):
            withAnimation { errorMessage = error.localizedDescription }
        }
    }
}

// MARK: - Detected Source Model

private struct DetectedSource {
    let name: String
    let icon: String
    let color: Color
}

#Preview {
    AddPaperView()
        .environmentObject(AppState())
}
