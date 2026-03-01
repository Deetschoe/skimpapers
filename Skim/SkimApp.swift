import SwiftUI

@main
struct SkimApp: App {
    @StateObject private var appState = AppState()

    init() {
        // Force UIKit-level tint for cursors, text selection handles, and all UIKit components
        let tintColor = UIColor(red: 0.616, green: 0.388, blue: 0.306, alpha: 1.0) // #9D634E
        UIView.appearance().tintColor = tintColor
        UITextField.appearance().tintColor = tintColor
        UITextView.appearance().tintColor = tintColor
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .tint(SkimTheme.inputTint)
                .accentColor(SkimTheme.inputTint)
        }
    }
}
