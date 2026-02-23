import SwiftUI

// MARK: - Auth Step Enum

enum AuthStep {
    case accessCode    // first-time gate
    case emailEntry
    case pinVerify     // 6-digit OTP
}

// MARK: - AuthView

struct AuthView: View {
    @EnvironmentObject private var appState: AppState

    @State private var currentStep: AuthStep = .accessCode
    @State private var email = ""
    @State private var accessCodeText = ""
    @State private var pinDigits = ""
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var viewOpacity: Double = 0
    @State private var userExists = false
    @State private var codeSentConfirmation = false

    @FocusState private var focusedField: AuthField?

    private enum AuthField: Hashable {
        case accessCode
        case email
        case pin
    }

    private static let accessCodeKey = "skim_access_code_entered"

    var body: some View {
        ZStack {
            SkimTheme.background
                .ignoresSafeArea()
                .onTapGesture {
                    focusedField = nil
                }

            ScrollView {
                VStack(spacing: 0) {
                    Spacer()
                        .frame(height: 80)

                    // Logo
                    Text("skim")
                        .font(SkimTheme.logoFont)
                        .foregroundColor(SkimTheme.accent)
                        .padding(.bottom, 12)

                    // Step content
                    Group {
                        switch currentStep {
                        case .accessCode:
                            accessCodeView
                        case .emailEntry:
                            emailEntryView
                        case .pinVerify:
                            pinVerifyView
                        }
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                }
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .opacity(viewOpacity)
        .onAppear {
            // Skip access code if already entered before
            if UserDefaults.standard.bool(forKey: Self.accessCodeKey) {
                currentStep = .emailEntry
            }
            withAnimation(.easeOut(duration: 0.5)) {
                viewOpacity = 1.0
            }
        }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
    }

    // MARK: - Step 1: Access Code (one-time gate)

    private var accessCodeView: some View {
        VStack(spacing: 0) {
            Text("Welcome to skim")
                .font(SkimTheme.headingFont)
                .foregroundColor(SkimTheme.textPrimary)
                .padding(.bottom, 8)

            Text("Enter your invite code to get started")
                .font(SkimTheme.bodyFont)
                .foregroundColor(SkimTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.bottom, 36)

            // Access code field
            VStack(alignment: .leading, spacing: 8) {
                Text("Invite code")
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textSecondary)

                HStack(spacing: 12) {
                    Image(systemName: "ticket.fill")
                        .font(.system(size: 16))
                        .foregroundColor(focusedField == .accessCode ? SkimTheme.accent : SkimTheme.textTertiary)
                        .frame(width: 20)

                    TextField("", text: $accessCodeText, prompt: Text("Enter invite code").foregroundColor(SkimTheme.textTertiary))
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(SkimTheme.textPrimary)
                        .tint(SkimTheme.inputTint)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .accessCode)
                        .submitLabel(.go)
                        .onSubmit {
                            handleAccessCodeSubmit()
                        }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(SkimTheme.surface)
                .cornerRadius(SkimTheme.cornerRadius)
                .overlay(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                        .stroke(
                            focusedField == .accessCode ? SkimTheme.accent : SkimTheme.border,
                            lineWidth: focusedField == .accessCode ? 2 : 1.5
                        )
                )
                .shadow(
                    color: focusedField == .accessCode ? SkimTheme.accent.opacity(0.15) : .clear,
                    radius: 8, x: 0, y: 2
                )
            }
            .padding(.horizontal, SkimTheme.paddingLarge)
            .padding(.bottom, SkimTheme.paddingLarge)
            .animation(.easeOut(duration: 0.2), value: focusedField)

            // Error message
            errorBanner

            // Continue button
            Button {
                handleAccessCodeSubmit()
            } label: {
                Text("Continue")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SkimButtonStyle())
            .disabled(accessCodeText.isEmpty)
            .opacity(accessCodeText.isEmpty ? 0.5 : 1.0)
            .padding(.horizontal, SkimTheme.paddingLarge)
        }
        .onAppear {
            focusedField = .accessCode
        }
    }

    // MARK: - Step 2: Email Entry

    private var emailEntryView: some View {
        VStack(spacing: 0) {
            Text("Research, distilled.")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textSecondary)
                .padding(.bottom, 36)

            // Email field
            VStack(alignment: .leading, spacing: 8) {
                Text("Email")
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textSecondary)

                HStack(spacing: 12) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 16))
                        .foregroundColor(focusedField == .email ? SkimTheme.accent : SkimTheme.textTertiary)
                        .frame(width: 20)

                    TextField("", text: $email, prompt: Text("you@example.com").foregroundColor(SkimTheme.textTertiary))
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(SkimTheme.textPrimary)
                        .tint(SkimTheme.inputTint)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .focused($focusedField, equals: .email)
                        .submitLabel(.go)
                        .onSubmit {
                            handleEmailContinue()
                        }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(SkimTheme.surface)
                .cornerRadius(SkimTheme.cornerRadius)
                .overlay(
                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                        .stroke(
                            focusedField == .email ? SkimTheme.accent : SkimTheme.border,
                            lineWidth: focusedField == .email ? 2 : 1.5
                        )
                )
                .shadow(
                    color: focusedField == .email ? SkimTheme.accent.opacity(0.15) : .clear,
                    radius: 8, x: 0, y: 2
                )
            }
            .padding(.horizontal, SkimTheme.paddingLarge)
            .padding(.bottom, SkimTheme.paddingLarge)
            .animation(.easeOut(duration: 0.2), value: focusedField)

            // Error message
            errorBanner

            // Continue button
            Button {
                handleEmailContinue()
            } label: {
                HStack(spacing: 10) {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    }
                    Text("Continue")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(SkimButtonStyle())
            .disabled(email.isEmpty || isLoading)
            .opacity(email.isEmpty ? 0.5 : 1.0)
            .padding(.horizontal, SkimTheme.paddingLarge)
        }
        .onAppear {
            focusedField = .email
        }
    }

    // MARK: - Step 3: 6-Digit PIN Verification

    private var pinVerifyView: some View {
        VStack(spacing: 0) {
            Text("Check your email")
                .font(SkimTheme.subheadingFont)
                .foregroundColor(SkimTheme.textSecondary)
                .padding(.bottom, 6)

            Text("We sent a code to \(email)")
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, SkimTheme.paddingLarge)
                .padding(.bottom, 36)

            PINCodeInput(
                digits: $pinDigits,
                length: 6,
                isFocused: focusedField == .pin,
                onFocusTap: { focusedField = .pin },
                onComplete: { code in
                    handleVerifyPin(code: code)
                }
            )
            .padding(.horizontal, SkimTheme.paddingLarge)
            .padding(.bottom, SkimTheme.paddingLarge)

            // Loading indicator
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: SkimTheme.accent))
                    .padding(.bottom, SkimTheme.paddingMedium)
            }

            // Error message
            errorBanner

            // Resend code button
            Button {
                handleResendCode()
            } label: {
                if codeSentConfirmation {
                    Text("Code sent!")
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.accentSecondary)
                        .fontWeight(.semibold)
                } else {
                    Text("Resend code")
                        .font(SkimTheme.captionFont)
                        .foregroundColor(SkimTheme.accent)
                        .fontWeight(.semibold)
                }
            }
            .disabled(codeSentConfirmation || isLoading)
            .padding(.bottom, SkimTheme.paddingLarge)

            // Back link
            Button {
                goToStep(.emailEntry)
                pinDigits = ""
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Use a different email")
                        .fontWeight(.semibold)
                }
                .font(SkimTheme.captionFont)
                .foregroundColor(SkimTheme.accent)
            }
        }
        .onAppear {
            focusedField = .pin
        }
    }

    // MARK: - Shared Components

    @ViewBuilder
    private var errorBanner: some View {
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
                    .fill(SkimTheme.destructive.opacity(0.08))
            )
            .padding(.horizontal, SkimTheme.paddingLarge)
            .padding(.bottom, SkimTheme.paddingMedium)
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    // MARK: - Navigation

    private func goToStep(_ step: AuthStep) {
        errorMessage = nil
        codeSentConfirmation = false
        withAnimation(.easeInOut(duration: 0.35)) {
            currentStep = step
        }
    }

    // MARK: - Actions

    private func handleAccessCodeSubmit() {
        focusedField = nil
        guard !accessCodeText.isEmpty else { return }

        // Validate locally — the word is "dieter"
        if accessCodeText.lowercased().trimmingCharacters(in: .whitespaces) == "dieter" {
            // Save so they never see this screen again
            UserDefaults.standard.set(true, forKey: Self.accessCodeKey)
            goToStep(.emailEntry)
        } else {
            errorMessage = "Invalid invite code"
        }
    }

    private func handleEmailContinue() {
        focusedField = nil
        guard !email.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                let exists = try await APIService.shared.checkEmail(email: email)
                userExists = exists
                if exists {
                    // Existing user: just send OTP
                    try await APIService.shared.requestCode(email: email)
                } else {
                    // New user: send OTP with access code
                    try await APIService.shared.requestCode(email: email, accessCode: accessCodeText)
                }
                isLoading = false
                goToStep(.pinVerify)
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }

    private func handleVerifyPin(code: String) {
        focusedField = nil
        isLoading = true
        errorMessage = nil

        Task {
            do {
                try await appState.authenticate(email: email, code: code)
            } catch {
                isLoading = false
                pinDigits = ""
                errorMessage = error.localizedDescription
            }
        }
    }

    private func handleResendCode() {
        errorMessage = nil

        Task {
            do {
                if userExists {
                    try await APIService.shared.requestCode(email: email)
                } else {
                    try await APIService.shared.requestCode(email: email, accessCode: accessCodeText)
                }
                codeSentConfirmation = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    codeSentConfirmation = false
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - PIN Code Input Component

struct PINCodeInput: View {
    @Binding var digits: String
    let length: Int
    let isFocused: Bool
    let onFocusTap: () -> Void
    let onComplete: (String) -> Void

    @FocusState private var textFieldFocused: Bool
    @State private var shakeOffset: CGFloat = 0

    var body: some View {
        VStack(spacing: 0) {
            // Visual PIN boxes overlaid on the real text field
            ZStack {
                // Real text field — full size of the PIN area so it always receives taps
                TextField("", text: $digits)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .focused($textFieldFocused)
                    .foregroundColor(.clear)
                    .tint(.clear)
                    .accentColor(.clear)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .onChange(of: digits) { _, newValue in
                        // Filter to digits only and clamp length
                        let filtered = String(newValue.filter { $0.isNumber }.prefix(length))
                        if filtered != newValue {
                            digits = filtered
                        }
                        // Auto-trigger when all digits entered
                        if filtered.count == length {
                            onComplete(filtered)
                        }
                    }

                // Visual PIN boxes drawn on top (non-interactive, passes taps through)
                HStack(spacing: 10) {
                    ForEach(0..<length, id: \.self) { index in
                        let digitChar = characterAt(index: index)
                        let isActive = index == digits.count && textFieldFocused

                        ZStack {
                            RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                                .fill(SkimTheme.surface)
                                .frame(width: 48, height: 56)
                                .overlay(
                                    RoundedRectangle(cornerRadius: SkimTheme.cornerRadiusSmall)
                                        .stroke(
                                            isActive ? SkimTheme.accent : SkimTheme.border,
                                            lineWidth: isActive ? 2 : 1.5
                                        )
                                )
                                .shadow(
                                    color: isActive ? SkimTheme.accent.opacity(0.15) : .clear,
                                    radius: 6, x: 0, y: 2
                                )

                            if let char = digitChar {
                                Text(String(char))
                                    .font(.system(size: 24, weight: .medium, design: .rounded))
                                    .foregroundColor(SkimTheme.textPrimary)
                            } else if isActive {
                                RoundedRectangle(cornerRadius: 1)
                                    .fill(SkimTheme.accent)
                                    .frame(width: 2, height: 24)
                            }
                        }
                    }
                }
                .allowsHitTesting(false) // Taps pass through to the real TextField below
                .offset(x: shakeOffset)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                textFieldFocused = true
                onFocusTap()
            }
        }
        .onChange(of: isFocused) { _, newValue in
            textFieldFocused = newValue
        }
        .onAppear {
            if isFocused {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    textFieldFocused = true
                }
            }
        }
    }

    private func characterAt(index: Int) -> Character? {
        guard index < digits.count else { return nil }
        return digits[digits.index(digits.startIndex, offsetBy: index)]
    }
}

// MARK: - Preview

#Preview {
    AuthView()
        .environmentObject(AppState())
}
