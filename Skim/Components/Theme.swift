import SwiftUI

enum SkimTheme {
    // Adaptive colors — auto-switch between light and dark based on iOS system setting
    static let background = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.10, green: 0.09, blue: 0.08, alpha: 1)
            : UIColor(red: 0.98, green: 0.975, blue: 0.96, alpha: 1)
    })

    static let surface = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.16, green: 0.15, blue: 0.14, alpha: 1)
            : UIColor.white
    })

    static let surfaceElevated = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.20, green: 0.19, blue: 0.18, alpha: 1)
            : UIColor(red: 0.96, green: 0.95, blue: 0.93, alpha: 1)
    })

    // Accent colors stay the same in both modes
    static let accent = Color(red: 0.78, green: 0.36, blue: 0.22)         // Terracotta
    static let accentSecondary = Color(red: 0.30, green: 0.52, blue: 0.44) // Sage green

    static let textPrimary = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.93, green: 0.92, blue: 0.90, alpha: 1)
            : UIColor(red: 0.10, green: 0.10, blue: 0.10, alpha: 1)
    })

    static let textSecondary = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.70, green: 0.69, blue: 0.67, alpha: 1)
            : UIColor(red: 0.40, green: 0.40, blue: 0.40, alpha: 1)
    })

    static let textTertiary = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.50, green: 0.49, blue: 0.47, alpha: 1)
            : UIColor(red: 0.62, green: 0.62, blue: 0.60, alpha: 1)
    })

    static let destructive = Color(red: 0.85, green: 0.25, blue: 0.20)

    static let border = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.28, green: 0.27, blue: 0.25, alpha: 1)
            : UIColor(red: 0.88, green: 0.87, blue: 0.84, alpha: 1)
    })

    static let ratingGreen = Color(red: 0.22, green: 0.65, blue: 0.40)
    static let ratingYellow = Color(red: 0.82, green: 0.65, blue: 0.15)
    static let ratingRed = Color(red: 0.85, green: 0.25, blue: 0.20)

    // Custom font name (registered via Info.plist)
    static let customFontName = "LinndaleSquareNFW01-Regular"

    // Fonts - Linndale Square for logo/headings, system for body
    static let logoFont = Font.custom(customFontName, size: 38)
    static let logoFontSmall = Font.custom(customFontName, size: 24)
    static let headingFont = Font.custom(customFontName, size: 22)
    static let subheadingFont = Font.system(size: 16, weight: .semibold, design: .rounded)
    static let bodyFont = Font.system(size: 14, weight: .regular, design: .default)
    static let captionFont = Font.system(size: 12, weight: .medium, design: .rounded)
    static let monoFont = Font.system(size: 13, weight: .regular, design: .monospaced)

    // Spacing
    static let paddingSmall: CGFloat = 8
    static let paddingMedium: CGFloat = 16
    static let paddingLarge: CGFloat = 24
    static let cornerRadius: CGFloat = 14
    static let cornerRadiusSmall: CGFloat = 8

    static func ratingColor(for rating: Int?) -> Color {
        guard let r = rating else { return .gray }
        switch r {
        case 8...10: return ratingGreen
        case 5...7: return ratingYellow
        default: return ratingRed
        }
    }

    static func collectionColor(for name: String) -> Color {
        switch name {
        case "accent": return accent
        case "purple": return Color(red: 0.55, green: 0.40, blue: 0.70)
        case "green": return accentSecondary
        case "orange": return Color(red: 0.90, green: 0.55, blue: 0.20)
        case "pink": return Color(red: 0.82, green: 0.38, blue: 0.48)
        case "blue": return Color(red: 0.30, green: 0.50, blue: 0.68)
        case "yellow": return ratingYellow
        case "red": return destructive
        default: return accent
        }
    }
}

struct SkimButtonStyle: ButtonStyle {
    var isProminent: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(SkimTheme.subheadingFont)
            .foregroundColor(isProminent ? .white : SkimTheme.accent)
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .fill(isProminent ? SkimTheme.accent : SkimTheme.surfaceElevated)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct SkimTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(16)
            .background(SkimTheme.surface)
            .cornerRadius(SkimTheme.cornerRadius)
            .foregroundColor(SkimTheme.textPrimary)
            .overlay(
                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                    .stroke(SkimTheme.border, lineWidth: 1)
            )
    }
}
