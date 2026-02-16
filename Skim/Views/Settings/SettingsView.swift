import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                SkimTheme.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: SkimTheme.paddingLarge) {

                        // Profile
                        profileSection

                        // Reading
                        readingSection

                        // AI Features
                        aiFeaturesSection

                        // Usage stats
                        usageSection

                        // About
                        aboutSection

                        // Sign out
                        signOutSection

                        // App version footer
                        appVersionLabel
                    }
                    .padding(.horizontal, SkimTheme.paddingMedium)
                    .padding(.top, SkimTheme.paddingMedium)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(SkimTheme.textSecondary)
                    }
                }
            }
        }
        .task {
            await appState.loadUsage()
        }
    }

    // MARK: - Profile Section

    private var profileSection: some View {
        VStack(spacing: SkimTheme.paddingSmall) {
            // Avatar circle with initial
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [SkimTheme.accent, SkimTheme.accentSecondary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)

                Text(userInitial)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
            }
            .padding(.bottom, 4)

            Text(appState.currentUser?.email ?? "Unknown")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)

            if let user = appState.currentUser {
                Text("Member since \(user.createdAt.prefix(10))")
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, SkimTheme.paddingLarge)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - Reading Section

    private var readingSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
            Label("Reading", systemImage: "textformat.size")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .padding(.bottom, 4)

            // Text size slider
            VStack(spacing: 10) {
                HStack {
                    Image(systemName: "textformat.size.smaller")
                        .font(.system(size: 14))
                        .foregroundColor(SkimTheme.textTertiary)

                    Slider(
                        value: Binding(
                            get: { appState.textSizeMultiplier },
                            set: { newValue in
                                appState.textSizeMultiplier = newValue
                                appState.saveSetting("textSize", value: newValue)
                            }
                        ),
                        in: 0.8...1.4,
                        step: 0.1
                    )
                    .tint(SkimTheme.accent)

                    Image(systemName: "textformat.size.larger")
                        .font(.system(size: 18))
                        .foregroundColor(SkimTheme.textTertiary)
                }

                Text("Text Size: \(Int(appState.textSizeMultiplier * 100))%")
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textTertiary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - AI Features Section

    private var aiFeaturesSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
            Label("AI Features", systemImage: "cpu.fill")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .padding(.bottom, 4)

            toggleRow(
                icon: "sparkles",
                label: "AI Assistant",
                isOn: Binding(
                    get: { appState.aiEnabled },
                    set: { newValue in
                        appState.aiEnabled = newValue
                        appState.saveSetting("aiEnabled", value: newValue)
                    }
                )
            )

            Divider()
                .background(SkimTheme.border)

            toggleRow(
                icon: "doc.text.magnifyingglass",
                label: "Auto-summarize new papers",
                isOn: Binding(
                    get: { appState.autoSummarize },
                    set: { newValue in
                        appState.autoSummarize = newValue
                        appState.saveSetting("autoSummarize", value: newValue)
                    }
                )
            )
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - Usage Section

    private var usageSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
            Label("Usage", systemImage: "chart.bar.fill")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .padding(.bottom, 4)

            if let usage = appState.usage {
                usageRow(
                    icon: "doc.text.fill",
                    label: "Papers Analyzed",
                    value: "\(usage.totalPapers)",
                    color: SkimTheme.accent
                )

                Divider()
                    .background(SkimTheme.border)

                usageRow(
                    icon: "bubble.left.and.bubble.right.fill",
                    label: "AI Queries",
                    value: "\(usage.totalQueries)",
                    color: SkimTheme.accentSecondary
                )

                Divider()
                    .background(SkimTheme.border)

                usageRow(
                    icon: "dollarsign.circle.fill",
                    label: "Est. API Cost",
                    value: String(format: "$%.2f", usage.apiCostEstimate),
                    color: SkimTheme.ratingYellow
                )

                if let period = formattedPeriod(usage) {
                    Text(period)
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.textTertiary)
                        .padding(.top, 4)
                }
            } else {
                HStack {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: SkimTheme.accent))
                    Spacer()
                }
                .padding(.vertical, SkimTheme.paddingMedium)
            }
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - About Section

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: SkimTheme.paddingMedium) {
            Label("About", systemImage: "info.circle.fill")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .padding(.bottom, 4)

            linkRow(icon: "app.badge.fill", label: "Version", detail: appVersion)

            Divider()
                .background(SkimTheme.border)

            linkRow(icon: "envelope.fill", label: "Send Feedback")

            Divider()
                .background(SkimTheme.border)

            linkRow(icon: "hand.raised.fill", label: "Privacy Policy")
        }
        .padding(SkimTheme.paddingMedium)
        .background(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .fill(SkimTheme.surface)
        )
    }

    // MARK: - Sign Out Section

    private var signOutSection: some View {
        Button {
            appState.signOut()
            dismiss()
        } label: {
            HStack {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Sign Out")
            }
            .font(SkimTheme.subheadingFont)
            .foregroundColor(SkimTheme.destructive)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .fill(SkimTheme.destructive.opacity(0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .stroke(SkimTheme.destructive.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - App Version

    private var appVersionLabel: some View {
        VStack(spacing: 4) {
            Text("skim")
                .font(SkimTheme.logoFontSmall)
                .foregroundColor(SkimTheme.textTertiary)
            Text("Version \(appVersion)")
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, SkimTheme.paddingSmall)
    }

    // MARK: - Reusable Row Components

    private func toggleRow(icon: String, label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(SkimTheme.accent)
                .frame(width: 28)

            Text(label)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(SkimTheme.accent)
        }
    }

    private func linkRow(icon: String, label: String, detail: String? = nil) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(SkimTheme.accent)
                .frame(width: 28)

            Text(label)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)

            Spacer()

            if let detail {
                Text(detail)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textTertiary)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SkimTheme.textTertiary)
            }
        }
    }

    private func usageRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(color)
                .frame(width: 28)

            Text(label)
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)

            Spacer()

            Text(value)
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textPrimary)
        }
    }

    // MARK: - Helpers

    private var userInitial: String {
        guard let email = appState.currentUser?.email,
              let first = email.first else { return "?" }
        return String(first).uppercased()
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    private func formattedPeriod(_ usage: UsageInfo) -> String? {
        let iso = ISO8601DateFormatter()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM d"

        guard let startDate = iso.date(from: usage.periodStart),
              let endDate = iso.date(from: usage.periodEnd) else {
            return "Period: \(usage.periodStart.prefix(10)) - \(usage.periodEnd.prefix(10))"
        }
        return "Period: \(dateFormatter.string(from: startDate)) - \(dateFormatter.string(from: endDate))"
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
