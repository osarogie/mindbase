import AppKit
import SwiftUI

struct ConnectorsSettingsView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var notionToken = ""
    @State private var anthropicKey = ""
    @State private var googleOAuthJSON = ""
    @State private var gdriveServiceAccountJSON = ""
    @State private var notionOAuthClientID = ""
    @State private var notionOAuthClientSecret = ""
    @State private var creds: ConnectorCredentialsView = .empty
    @State private var status = ""

    var body: some View {
        Group {
            Section("Auth API") {
                Text("OAuth and connector sync use your hosted mindbase server — not local content APIs.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("https://your-mindbase.example.com", text: $appModel.authAPIBaseURL)
                    .textFieldStyle(.roundedBorder)
                Button("Save Auth API URL") {
                    appModel.applyAuthAPIBaseURL(appModel.authAPIBaseURL)
                    status = appModel.authAPIBaseURL.isEmpty
                        ? "Auth API cleared — credentials stay local only"
                        : "Auth API URL saved"
                }
            }

            Section("Notion") {
                if creds.notionTokenSet {
                    Text("Token: \(creds.notionTokenPreview)").foregroundStyle(.secondary)
                }
                SecureField("Integration token", text: $notionToken)
                Button("Save Notion token") {
                    Task { await save(["notion_token": notionToken]) }
                }
                TextField("OAuth client ID", text: $notionOAuthClientID)
                SecureField("OAuth client secret", text: $notionOAuthClientSecret)
                Button("Save Notion OAuth app") {
                    Task {
                        await save([
                            "notion_oauth_client_id": notionOAuthClientID,
                            "notion_oauth_client_secret": notionOAuthClientSecret,
                        ])
                    }
                }
                Button("Sign in with Notion") {
                    Task { await startNotionOAuth() }
                }
                .disabled(!creds.notionOAuthConfigured || AuthAPIClient.configuredBaseURL == nil)
            }

            Section("Google Drive") {
                if creds.gdriveConnected {
                    Text(creds.gdriveTokenPreview).foregroundStyle(.secondary)
                }
                TextEditor(text: $googleOAuthJSON)
                    .frame(minHeight: 80)
                    .font(.system(.caption, design: .monospaced))
                Button("Save Google OAuth client JSON") {
                    Task { await save(["google_oauth_client_json": googleOAuthJSON]) }
                }
                Button("Sign in with Google") {
                    Task { await startGDriveOAuth() }
                }
                .disabled(!creds.googleOAuthConfigured || AuthAPIClient.configuredBaseURL == nil)
                TextEditor(text: $gdriveServiceAccountJSON)
                    .frame(minHeight: 80)
                    .font(.system(.caption, design: .monospaced))
                Button("Save service account JSON") {
                    Task { await save(["gdrive_credentials_json": gdriveServiceAccountJSON]) }
                }
            }

            Section("Claude") {
                if creds.anthropicKeySet {
                    Text("Key: \(creds.anthropicKeyPreview)").foregroundStyle(.secondary)
                }
                SecureField("API key", text: $anthropicKey)
                Button("Save Claude key") {
                    Task { await save(["anthropic_api_key": anthropicKey]) }
                }
            }

            Section("Remote sync") {
                Button("Sync connectors on Auth API") {
                    Task { await remoteSync() }
                }
                .disabled(AuthAPIClient.configuredBaseURL == nil)
            }

            if !status.isEmpty {
                Section {
                    Text(status).font(.callout).foregroundStyle(.secondary)
                }
            }
        }
        .onAppear {
            Task { await reload() }
        }
    }

    private func reload() async {
        creds = (try? appModel.localCredentials()) ?? .empty
    }

    private func save(_ fields: [String: String]) async {
        status = "Saving…"
        do {
            creds = try await appModel.saveCredentials(fields)
            notionToken = ""
            anthropicKey = ""
            status = "Saved in vault/.mindbase/secrets.json"
            if AuthAPIClient.configuredBaseURL != nil {
                status += " · pushed to Auth API"
            }
        } catch {
            status = error.localizedDescription
        }
    }

    private func remoteSync() async {
        status = "Syncing via Auth API…"
        do {
            _ = try await appModel.syncConnectorsNow()
            status = "Remote connector sync complete"
        } catch {
            status = error.localizedDescription
        }
    }

    private func startGDriveOAuth() async {
        status = "Opening Google sign-in…"
        do {
            let url = try await appModel.gdriveOAuthURL()
            NSWorkspace.shared.open(url)
            status = "Complete sign-in in your browser"
        } catch {
            status = error.localizedDescription
        }
    }

    private func startNotionOAuth() async {
        status = "Opening Notion sign-in…"
        do {
            let url = try await appModel.notionOAuthURL()
            NSWorkspace.shared.open(url)
            status = "Complete sign-in in your browser"
        } catch {
            status = error.localizedDescription
        }
    }
}
