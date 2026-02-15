import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ZStack {
            SkimTheme.background.ignoresSafeArea()

            switch appState.currentScreen {
            case .splash:
                SplashView()
                    .transition(.opacity)
            case .auth:
                AuthView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            case .home:
                HomeView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            }
        }
        .animation(.easeInOut(duration: 0.4), value: appState.currentScreen)
    }
}

extension AppScreen: Equatable {}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
