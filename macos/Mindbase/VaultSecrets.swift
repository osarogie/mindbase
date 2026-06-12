import Foundation

struct VaultSecretsData: Codable {
    var notionToken: String?
    var anthropicAPIKey: String?
    var gdriveCredentialsJSON: String?
    var gdriveTokenJSON: String?
    var googleOAuthClientJSON: String?
    var notionOAuthClientID: String?
    var notionOAuthClientSecret: String?
    var notionOAuthAccessToken: String?

    enum CodingKeys: String, CodingKey {
        case notionToken = "notion_token"
        case anthropicAPIKey = "anthropic_api_key"
        case gdriveCredentialsJSON = "gdrive_credentials_json"
        case gdriveTokenJSON = "gdrive_token_json"
        case googleOAuthClientJSON = "google_oauth_client_json"
        case notionOAuthClientID = "notion_oauth_client_id"
        case notionOAuthClientSecret = "notion_oauth_client_secret"
        case notionOAuthAccessToken = "notion_oauth_access_token"
    }
}

struct VaultSecrets {
    let vaultRoot: URL
    private var path: URL { vaultRoot.appendingPathComponent(".mindbase/secrets.json") }

    func load() throws -> VaultSecretsData {
        guard FileManager.default.fileExists(atPath: path.path) else { return VaultSecretsData() }
        let data = try Data(contentsOf: path)
        return try JSONDecoder().decode(VaultSecretsData.self, from: data)
    }

    func save(_ data: VaultSecretsData) throws {
        try FileManager.default.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoded = try JSONEncoder().encode(data)
        try encoded.write(to: path, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
    }

    func view() throws -> ConnectorCredentialsView {
        let data = try load()
        let notionToken = firstNonEmpty(data.notionOAuthAccessToken, data.notionToken)
        var gdriveConnected = false
        var gdriveMethod = ""
        var gdrivePreview = ""
        if data.gdriveTokenJSON?.isEmpty == false && data.googleOAuthClientJSON?.isEmpty == false {
            gdriveConnected = true
            gdriveMethod = "oauth"
            gdrivePreview = "Google account connected"
        } else if data.gdriveCredentialsJSON?.isEmpty == false {
            gdriveConnected = true
            gdriveMethod = "service_account"
            gdrivePreview = "Service account configured"
        } else if data.gdriveTokenJSON?.isEmpty == false {
            gdriveConnected = true
            gdriveMethod = "token"
        }
        return ConnectorCredentialsView(
            notionTokenSet: !notionToken.isEmpty,
            notionTokenPreview: previewToken(notionToken),
            notionOAuthConfigured: !(data.notionOAuthClientID ?? "").isEmpty && !(data.notionOAuthClientSecret ?? "").isEmpty,
            notionOAuthConnected: !(data.notionOAuthAccessToken ?? "").isEmpty,
            gdriveConnected: gdriveConnected,
            gdriveAuthMethod: gdriveMethod,
            gdriveTokenPreview: gdrivePreview,
            googleOAuthConfigured: !(data.googleOAuthClientJSON ?? "").isEmpty,
            anthropicKeySet: !(data.anthropicAPIKey ?? "").isEmpty,
            anthropicKeyPreview: previewToken(data.anthropicAPIKey ?? "")
        )
    }

    func apply(fields: [String: String]) throws -> ConnectorCredentialsView {
        var data = try load()
        if let v = fields["notion_token"], !v.isEmpty { data.notionToken = v }
        if let v = fields["anthropic_api_key"], !v.isEmpty { data.anthropicAPIKey = v }
        if let v = fields["gdrive_credentials_json"], !v.isEmpty { data.gdriveCredentialsJSON = v }
        if let v = fields["google_oauth_client_json"], !v.isEmpty { data.googleOAuthClientJSON = v }
        if let v = fields["notion_oauth_client_id"], !v.isEmpty { data.notionOAuthClientID = v }
        if let v = fields["notion_oauth_client_secret"], !v.isEmpty { data.notionOAuthClientSecret = v }
        try save(data)
        return try view()
    }

    private func previewToken(_ token: String) -> String {
        let t = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return "" }
        if t.count <= 8 { return "••••" }
        return String(t.prefix(4)) + "…" + String(t.suffix(4))
    }

    private func firstNonEmpty(_ values: String?...) -> String {
        for v in values {
            if let v, !v.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return v }
        }
        return ""
    }
}
