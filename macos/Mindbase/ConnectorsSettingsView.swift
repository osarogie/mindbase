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
                .disabled(!creds.notionOAuthConfigured)
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
                .disabled(!creds.googleOAuthConfigured)
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

            if !status.isEmpty {
                Section {
                    Text(status).font(.callout).foregroundStyle(.secondary)
                }
            }
        }
        .onAppear {
            Task { await reload() }
        }
        .onChange(of: appModel.goCoreReady) { _, ready in
            if ready { Task { await reload() } }
        }
    }

    private func reload() async {
        guard appModel.goCoreReady else { return }
        creds = (try? await appModel.fetchCredentials()) ?? .empty
    }

    private func save(_ fields: [String: String]) async {
        status = "Saving…"
        do {
            creds = try await appModel.saveCredentials(fields)
            notionToken = ""
            anthropicKey = ""
            status = "Saved locally in vault/.mindbase/secrets.json"
            _ = try? await appModel.syncConnectorsNow()
            try? await appModel.refreshAll()
        } catch {
            status = error.localizedDescription
        }
    }

    private func startGDriveOAuth() async {
        status = "Opening Google sign-in…"
        do {
            let url = try await appModel.gdriveOAuthURL()
            NSWorkspace.shared.open(url)
            status = "Complete sign-in in your browser, then sync again"
        } catch {
            status = error.localizedDescription
        }
    }

    private func startNotionOAuth() async {
        status = "Opening Notion sign-in…"
        do {
            let url = try await appModel.notionOAuthURL()
            NSWorkspace.shared.open(url)
            status = "Complete sign-in in your browser, then sync again"
        } catch {
            status = error.localizedDescription
        }
    }
}
