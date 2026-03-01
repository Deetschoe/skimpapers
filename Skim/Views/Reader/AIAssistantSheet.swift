import SwiftUI

struct AIAssistantSheet: View {
    let paper: Paper
    let selectedText: String?
    let markdownContent: String?

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [ChatMessage] = []
    @State private var currentQuestion = ""
    @State private var isLoading = false
    @State private var showSuggestions = true
    @FocusState private var isTextFieldFocused: Bool

    private let suggestions = [
        "Summarize key findings",
        "Explain the methodology",
        "What are the limitations?",
        "How does this relate to prior work?"
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                SkimTheme.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    sheetHeader
                    Divider()
                        .overlay(SkimTheme.border)

                    scrollableContent

                    Divider()
                        .overlay(SkimTheme.border)
                    inputBar
                }
            }
            .navigationBarHidden(true)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(SkimTheme.background)
    }

    // MARK: - Header

    private var sheetHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(SkimTheme.accent)
                    Text("AI Assistant")
                        .font(SkimTheme.subheadingFont)
                        .foregroundColor(SkimTheme.textPrimary)
                }
                Text(paper.title)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textTertiary)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(SkimTheme.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(SkimTheme.surfaceElevated)
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
        .padding(.vertical, SkimTheme.paddingSmall)
    }

    // MARK: - Scrollable Content

    private var scrollableContent: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
                    // Selected text context
                    if let text = selectedText, !text.isEmpty {
                        selectedTextBlock(text)
                    }

                    // Suggestions (show when no messages yet)
                    if showSuggestions && messages.isEmpty {
                        suggestionsSection
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Conversation
                    ForEach(messages) { message in
                        chatBubble(message)
                            .id(message.id)
                    }

                    // Loading indicator
                    if isLoading {
                        loadingBubble
                            .id("loading")
                    }
                }
                .padding(.horizontal, SkimTheme.paddingMedium)
                .padding(.vertical, SkimTheme.paddingMedium)
                .animation(.easeInOut(duration: 0.3), value: showSuggestions)
            }
            .onChange(of: messages.count) {
                withAnimation(.easeOut(duration: 0.3)) {
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
            .onChange(of: isLoading) {
                if isLoading {
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("loading", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Selected Text Block

    private func selectedTextBlock(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "text.quote")
                    .font(.system(size: 11))
                Text("Selected Text")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
            }
            .foregroundColor(SkimTheme.accentSecondary)

            HStack(alignment: .top, spacing: 8) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(SkimTheme.accentSecondary)
                    .frame(width: 3)

                Text(text)
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(SkimTheme.textSecondary)
                    .italic()
                    .lineLimit(6)
            }
        }
        .padding(SkimTheme.paddingSmall + 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                .fill(SkimTheme.accentSecondary.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                        .stroke(SkimTheme.accentSecondary.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
            Text("Try asking...")
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)

            ForEach(suggestions, id: \.self) { suggestion in
                Button {
                    currentQuestion = suggestion
                    isTextFieldFocused = true
                } label: {
                    HStack(spacing: SkimTheme.paddingSmall) {
                        Image(systemName: iconForSuggestion(suggestion))
                            .font(.system(size: 13))
                            .foregroundColor(SkimTheme.accent)
                            .frame(width: 20)

                        Text(suggestion)
                            .font(SkimTheme.bodyFont)
                            .foregroundColor(SkimTheme.textPrimary)

                        Spacer()

                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11))
                            .foregroundColor(SkimTheme.textTertiary)
                    }
                    .padding(.horizontal, SkimTheme.paddingSmall + 4)
                    .padding(.vertical, SkimTheme.paddingSmall + 2)
                    .background(
                        RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                            .fill(SkimTheme.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                                    .stroke(SkimTheme.border, lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(SuggestionButtonStyle())
            }
        }
    }

    private func iconForSuggestion(_ suggestion: String) -> String {
        if suggestion.contains("Summarize") { return "sparkles" }
        if suggestion.contains("methodology") { return "list.bullet.clipboard" }
        if suggestion.contains("limitations") { return "exclamationmark.triangle" }
        return "link"
    }

    // MARK: - Chat Bubble

    private func chatBubble(_ message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingSmall) {
            // Question
            HStack(alignment: .top, spacing: 8) {
                Spacer(minLength: 40)

                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.question)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textPrimary)
                        .padding(.horizontal, SkimTheme.paddingSmall + 4)
                        .padding(.vertical, SkimTheme.paddingSmall)
                        .background(
                            RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                                .fill(SkimTheme.accentSecondary.opacity(0.2))
                        )

                    Text(message.timestamp, style: .time)
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(SkimTheme.textTertiary)
                }
            }

            // Answer
            HStack(alignment: .top, spacing: 8) {
                ZStack {
                    Circle()
                        .fill(SkimTheme.accent.opacity(0.15))
                        .frame(width: 28, height: 28)
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(SkimTheme.accent)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(message.answer)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textPrimary)
                        .lineSpacing(5)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, SkimTheme.paddingSmall + 4)
                .padding(.vertical, SkimTheme.paddingSmall)
                .background(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                        .fill(SkimTheme.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                                .stroke(SkimTheme.border, lineWidth: 1)
                        )
                )

                Spacer(minLength: 20)
            }
        }
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom)),
            removal: .opacity
        ))
    }

    // MARK: - Loading Bubble

    private var loadingBubble: some View {
        HStack(alignment: .top, spacing: 8) {
            ZStack {
                Circle()
                    .fill(SkimTheme.accent.opacity(0.15))
                    .frame(width: 28, height: 28)
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SkimTheme.accent)
            }

            HStack(spacing: 6) {
                TypingIndicatorDot(delay: 0)
                TypingIndicatorDot(delay: 0.2)
                TypingIndicatorDot(delay: 0.4)
            }
            .padding(.horizontal, SkimTheme.paddingSmall + 4)
            .padding(.vertical, SkimTheme.paddingMedium)
            .background(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                    .fill(SkimTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                            .stroke(SkimTheme.border, lineWidth: 1)
                    )
            )

            Spacer()
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: SkimTheme.paddingSmall) {
            ZStack(alignment: .leading) {
                if currentQuestion.isEmpty {
                    Text("Ask about this paper...")
                        .font(SkimTheme.bodyFont)
                        .foregroundStyle(SkimTheme.inputTint)
                        .allowsHitTesting(false)
                }
                TextField("", text: $currentQuestion, axis: .vertical)
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(.white)
                    .tint(SkimTheme.inputTint)
                    .lineLimit(1...4)
                    .focused($isTextFieldFocused)
                    .onSubmit {
                        sendQuestion()
                    }
            }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(SkimTheme.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(
                                    isTextFieldFocused ? SkimTheme.accent.opacity(0.4) : SkimTheme.border,
                                    lineWidth: 1
                                )
                        )
                )

            Button {
                sendQuestion()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(
                        canSend ? SkimTheme.accent : SkimTheme.textTertiary
                    )
            }
            .disabled(!canSend)
            .animation(.easeInOut(duration: 0.15), value: canSend)
        }
        .padding(.horizontal, SkimTheme.paddingMedium)
        .padding(.vertical, SkimTheme.paddingSmall)
        .background(SkimTheme.background)
    }

    // MARK: - Logic

    private var canSend: Bool {
        !currentQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    private func sendQuestion() {
        let trimmed = currentQuestion.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isLoading else { return }

        let question = trimmed
        currentQuestion = ""
        isTextFieldFocused = false

        withAnimation(.easeInOut(duration: 0.2)) {
            showSuggestions = false
            isLoading = true
        }

        Task {
            do {
                guard let token = appState.currentUser?.token else {
                    throw SkimError.notAuthenticated
                }

                // Build the user message with optional selected text context
                var userContent = ""
                if let sel = selectedText, !sel.isEmpty {
                    userContent += "Selected passage:\n\"\"\"\n\(sel)\n\"\"\"\n\n"
                }
                userContent += question

                let chatMessages: [[String: String]] = [
                    ["role": "user", "content": userContent]
                ]

                let response = try await APIService.shared.chatWithPaper(
                    paperId: paper.id,
                    messages: chatMessages,
                    token: token
                )

                let answer = response["response"] as? String
                    ?? "No response received."

                let message = ChatMessage(
                    question: question,
                    answer: answer,
                    timestamp: Date()
                )

                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    messages.append(message)
                    isLoading = false
                }
            } catch {
                let errorMessage = ChatMessage(
                    question: question,
                    answer: "Sorry, I couldn't process that request. \(error.localizedDescription)",
                    timestamp: Date()
                )

                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    messages.append(errorMessage)
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Suggestion Button Style

private struct SuggestionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Chat Message Model

private struct ChatMessage: Identifiable {
    let id = UUID()
    let question: String
    let answer: String
    let timestamp: Date
}

// MARK: - Typing Indicator Dot

private struct TypingIndicatorDot: View {
    let delay: Double
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .fill(SkimTheme.accent.opacity(isAnimating ? 0.9 : 0.3))
            .frame(width: 7, height: 7)
            .scaleEffect(isAnimating ? 1.15 : 0.85)
            .animation(
                .easeInOut(duration: 0.5)
                .repeatForever(autoreverses: true)
                .delay(delay),
                value: isAnimating
            )
            .onAppear {
                isAnimating = true
            }
    }
}

// MARK: - Preview

#Preview {
    AIAssistantSheet(
        paper: Paper(
            id: "preview-1",
            title: "Attention Is All You Need",
            authors: ["Ashish Vaswani", "Noam Shazeer"],
            abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
            url: "https://arxiv.org/abs/1706.03762",
            pdfURL: nil,
            markdownContent: "# Attention Is All You Need\n\nThis paper introduces the Transformer architecture...",
            summary: "Introduces the Transformer architecture based on self-attention.",
            rating: 10,
            category: .computerScience,
            tags: ["transformers", "attention"],
            source: .arxiv,
            publishedDate: "2017-06-12",
            addedDate: "2025-01-15T10:30:00Z",
            isRead: false
        ),
        selectedText: "The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality.",
        markdownContent: "# Attention Is All You Need\n\nThis paper introduces the Transformer..."
    )
    .environmentObject(AppState())
}
