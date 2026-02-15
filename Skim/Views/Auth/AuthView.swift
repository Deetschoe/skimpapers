import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var appState: AppState

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var viewOpacity: Double = 0

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
        case password
    }

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

                    Text(isSignUp ? "Create your account" : "Welcome back")
                        .font(SkimTheme.subheadingFont)
                        .foregroundColor(SkimTheme.textSecondary)
                        .padding(.bottom, 36)

                    // Form fields
                    VStack(spacing: 20) {
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

                                TextField("you@example.com", text: $email)
                                    .font(.system(size: 16, weight: .regular))
                                    .foregroundColor(SkimTheme.textPrimary)
                                    .textContentType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .keyboardType(.emailAddress)
                                    .focused($focusedField, equals: .email)
                                    .submitLabel(.next)
                                    .onSubmit {
                                        focusedField = .password
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

                        // Password field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Password")
                                .font(SkimTheme.captionFont)
                                .foregroundColor(SkimTheme.textSecondary)

                            HStack(spacing: 12) {
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(focusedField == .password ? SkimTheme.accent : SkimTheme.textTertiary)
                                    .frame(width: 20)

                                SecureField("Enter password", text: $password)
                                    .font(.system(size: 16, weight: .regular))
                                    .foregroundColor(SkimTheme.textPrimary)
                                    .textContentType(isSignUp ? .newPassword : .password)
                                    .focused($focusedField, equals: .password)
                                    .submitLabel(.go)
                                    .onSubmit {
                                        submit()
                                    }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(SkimTheme.surface)
                            .cornerRadius(SkimTheme.cornerRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                                    .stroke(
                                        focusedField == .password ? SkimTheme.accent : SkimTheme.border,
                                        lineWidth: focusedField == .password ? 2 : 1.5
                                    )
                            )
                            .shadow(
                                color: focusedField == .password ? SkimTheme.accent.opacity(0.15) : .clear,
                                radius: 8, x: 0, y: 2
                            )

                            if isSignUp {
                                Text("At least 8 characters")
                                    .font(.system(size: 11, weight: .regular))
                                    .foregroundColor(SkimTheme.textTertiary)
                            }
                        }
                    }
                    .padding(.horizontal, SkimTheme.paddingLarge)
                    .padding(.bottom, SkimTheme.paddingLarge)
                    .tint(SkimTheme.accent)
                    .animation(.easeOut(duration: 0.2), value: focusedField)

                    // Error message
                    if let error = appState.errorMessage {
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

                    // Primary action button
                    Button {
                        submit()
                    } label: {
                        HStack(spacing: 10) {
                            if appState.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Text(isSignUp ? "Create Account" : "Sign In")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SkimButtonStyle())
                    .disabled(email.isEmpty || password.isEmpty || appState.isLoading)
                    .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1.0)
                    .padding(.horizontal, SkimTheme.paddingLarge)
                    .padding(.bottom, SkimTheme.paddingLarge)

                    // Divider
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
                    .padding(.horizontal, SkimTheme.paddingLarge * 2)
                    .padding(.bottom, SkimTheme.paddingLarge)

                    // Toggle between Sign In / Sign Up
                    Button {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            isSignUp.toggle()
                            appState.errorMessage = nil
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(isSignUp ? "Already have an account?" : "Don't have an account?")
                                .foregroundColor(SkimTheme.textSecondary)
                            Text(isSignUp ? "Sign In" : "Sign Up")
                                .foregroundColor(SkimTheme.accent)
                                .fontWeight(.semibold)
                        }
                        .font(SkimTheme.captionFont)
                    }
                }
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .opacity(viewOpacity)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                viewOpacity = 1.0
            }
        }
        .animation(.easeInOut(duration: 0.2), value: appState.errorMessage)
    }

    private func submit() {
        focusedField = nil
        guard !email.isEmpty, !password.isEmpty else { return }

        Task {
            do {
                if isSignUp {
                    try await appState.signUp(email: email, password: password)
                } else {
                    try await appState.signIn(email: email, password: password)
                }
            } catch {
                appState.errorMessage = error.localizedDescription
            }
        }
    }
}

#Preview {
    AuthView()
        .environmentObject(AppState())
}
