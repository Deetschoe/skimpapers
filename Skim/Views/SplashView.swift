import SwiftUI

struct SplashView: View {
    @EnvironmentObject private var appState: AppState

    @State private var logoOpacity: Double = 0
    @State private var taglineOpacity: Double = 0
    @State private var logoScale: CGFloat = 0.9

    var body: some View {
        ZStack {
            SkimTheme.background
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Spacer()

                // Logo text
                Text("skim")
                    .font(SkimTheme.logoFont)
                    .foregroundColor(SkimTheme.accent)
                    .opacity(logoOpacity)
                    .scaleEffect(logoScale)

                Text("Research, distilled.")
                    .font(SkimTheme.bodyFont)
                    .foregroundColor(SkimTheme.textSecondary)
                    .opacity(taglineOpacity)

                Spacer()
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                logoOpacity = 1.0
                logoScale = 1.0
            }

            withAnimation(.easeOut(duration: 0.6).delay(0.4)) {
                taglineOpacity = 1.0
            }

            appState.boot()
        }
    }
}

#Preview {
    SplashView()
        .environmentObject(AppState())
}
