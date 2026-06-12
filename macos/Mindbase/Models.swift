import Foundation

struct NoteEntry: Codable, Identifiable, Hashable {
    var id: String { path }
    let path: String
    let title: String
    let modified: Date
    let size: Int
    let hasAttachments: Bool
}

struct Note: Codable {
    let path: String
    let title: String
    let content: String
}

struct DatabaseEntry: Codable, Identifiable, Hashable {
    var id: String { name }
    let name: String
    let path: String
    let modified: Date
    let rows: Int
    let columns: Int
}

struct DatabaseTable: Codable {
    let name: String
    let path: String
    let headers: [String]
    let rows: [[String]]
}

struct SearchResult: Codable, Identifiable {
    var id: String { "\(type)-\(path)" }
    let path: String
    let title: String
    let type: String
    let snippet: String
    let score: Int
    let modified: Date
}

struct VaultInfo: Codable {
    let root: String
    let name: String
}

enum SidebarSection: String, CaseIterable, Identifiable {
    case library = "Library"

    var id: String { rawValue }
}

enum EditorMode: String, CaseIterable {
    case edit = "Edit"
    case split = "Split"
    case preview = "Preview"
}

struct VaultItem: Identifiable, Hashable {
    enum Kind: String {
        case note
        case database
    }

    let id: String
    let kind: Kind
    let title: String
    let subtitle: String
    let path: String
    let folder: String
    let fileURL: URL
    let modified: Date
}

struct TagCount: Identifiable, Hashable {
    var id: String { tag }
    let tag: String
    let count: Int
}

struct JournalDayLink: Identifiable, Hashable {
    var id: String { date }
    let label: String
    let date: String
    let path: String
}

struct FolderSection: Identifiable, Hashable {
    var id: String { name.isEmpty ? "__root__" : name }
    let name: String
    let items: [VaultItem]
}

struct ConnectorCredentialsView: Codable {
    var notionTokenSet: Bool
    var notionTokenPreview: String
    var notionOAuthConfigured: Bool
    var notionOAuthConnected: Bool
    var gdriveConnected: Bool
    var gdriveAuthMethod: String
    var gdriveTokenPreview: String
    var googleOAuthConfigured: Bool
    var anthropicKeySet: Bool
    var anthropicKeyPreview: String

    static let empty = ConnectorCredentialsView(
        notionTokenSet: false,
        notionTokenPreview: "",
        notionOAuthConfigured: false,
        notionOAuthConnected: false,
        gdriveConnected: false,
        gdriveAuthMethod: "",
        gdriveTokenPreview: "",
        googleOAuthConfigured: false,
        anthropicKeySet: false,
        anthropicKeyPreview: ""
    )

    enum CodingKeys: String, CodingKey {
        case notionTokenSet = "notion_token_set"
        case notionTokenPreview = "notion_token_preview"
        case notionOAuthConfigured = "notion_oauth_configured"
        case notionOAuthConnected = "notion_oauth_connected"
        case gdriveConnected = "gdrive_connected"
        case gdriveAuthMethod = "gdrive_auth_method"
        case gdriveTokenPreview = "gdrive_token_preview"
        case googleOAuthConfigured = "google_oauth_configured"
        case anthropicKeySet = "anthropic_key_set"
        case anthropicKeyPreview = "anthropic_key_preview"
    }
}
