import SwiftUI

@main
struct SkimApp: App {
    @StateObject private var appState = AppState()

    init() {
        // Force UIKit-level tint for cursors, text selection handles, and all UIKit components
        let tintColor = UIColor(red: 0.80, green: 0.50, blue: 0.40, alpha: 1.0) // #CC8065
        UIView.appearance().tintColor = tintColor
        UITextField.appearance().tintColor = tintColor
        UITextView.appearance().tintColor = tintColor
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .tint(SkimTheme.inputTint)
        }
    }
}
