import Foundation

enum MindbaseCoreError: LocalizedError {
    case libraryMissing
    case vaultNotOpen
    case api(String)

    var errorDescription: String? {
        switch self {
        case .libraryMissing: return "libmindbase.dylib not found in app bundle"
        case .vaultNotOpen: return "Vault not open"
        case .api(let msg): return msg
        }
    }
}

enum MindbaseCore {
    private struct ErrorPayload: Decodable { let error: String }
    private struct ContentPayload: Decodable { let content: String }
    private struct HTMLPayload: Decodable { let html: String }
    private struct PathPayload: Decodable { let path: String }

    private struct SnapshotPayload: Decodable {
        let info: VaultInfo
        let notes: [NoteEntry]
        let databases: [DatabaseEntry]
        let vaultItems: [VaultItemDTO]
        let folderSections: [FolderSectionDTO]
        let journalDays: [JournalDayLink]
        let popularTags: [TagCount]
        let openTaskCount: Int

        enum CodingKeys: String, CodingKey {
            case info, notes, databases
            case vaultItems = "vault_items"
            case folderSections = "folder_sections"
            case journalDays = "journal_days"
            case popularTags = "popular_tags"
            case openTaskCount = "open_task_count"
        }
    }

    struct VaultItemDTO: Decodable {
        let id: String
        let kind: String
        let title: String
        let subtitle: String
        let path: String
        let folder: String
        let filePath: String
        let modified: Date

        enum CodingKeys: String, CodingKey {
            case id, kind, title, subtitle, path, folder, modified
            case filePath = "file_path"
        }
    }

    struct FolderSectionDTO: Decodable {
        let name: String
        let items: [VaultItemDTO]
    }

    static func open(vaultPath: String) throws -> VaultInfo {
        try decode(VaultInfo.self, call("mindbase_open", vaultPath))
    }

    static func snapshot() throws -> (
        notes: [NoteEntry],
        databases: [DatabaseEntry],
        vaultItems: [VaultItem],
        folderSections: [FolderSection],
        journalDays: [JournalDayLink],
        popularTags: [TagCount],
        openTaskCount: Int
    ) {
        let payload: SnapshotPayload = try decode(SnapshotPayload.self, call("mindbase_vault_snapshot"))
        let items = payload.vaultItems.map(toVaultItem)
        let sections = payload.folderSections.map { sec in
            FolderSection(name: sec.name, items: sec.items.map(toVaultItem))
        }
        return (payload.notes, payload.databases, items, sections, payload.journalDays, payload.popularTags, payload.openTaskCount)
    }

    static func getNote(_ path: String) throws -> Note {
        try decode(Note.self, call("mindbase_get_note", path))
    }

    static func saveNote(_ path: String, content: String) throws -> Note {
        try decode(Note.self, call("mindbase_save_note", path, content))
    }

    static func getDatabaseMarkdown(_ name: String) throws -> String {
        let payload: ContentPayload = try decode(ContentPayload.self, call("mindbase_get_database_markdown", name))
        return payload.content
    }

    static func saveDatabaseMarkdown(_ name: String, content: String) throws {
        struct OK: Decodable { let ok: Bool? }
        _ = try decode(OK.self, call("mindbase_save_database_markdown", name, content))
    }

    static func search(_ query: String) throws -> [SearchResult] {
        try decode([SearchResult].self, call("mindbase_search", query))
    }

    static func previewHTML(for path: String) throws -> String {
        let payload: HTMLPayload = try decode(HTMLPayload.self, call("mindbase_preview_html", path))
        return payload.html
    }

    static func ensureDailyNote(isoDate: String) throws -> String {
        let payload: PathPayload = try decode(PathPayload.self, call("mindbase_ensure_daily_note", isoDate))
        return payload.path
    }

    static func ensureWeeklyNote() throws -> String {
        let payload: PathPayload = try decode(PathPayload.self, call("mindbase_ensure_weekly_note"))
        return payload.path
    }

    private static func toVaultItem(_ dto: VaultItemDTO) -> VaultItem {
        VaultItem(
            id: dto.id,
            kind: dto.kind == "database" ? .database : .note,
            title: dto.title,
            subtitle: dto.subtitle,
            path: dto.path,
            folder: dto.folder,
            fileURL: URL(fileURLWithPath: dto.filePath),
            modified: dto.modified
        )
    }

    private static func call(_ fn: String, _ args: String...) -> String {
        guard let cstr = withCString(fn, args: args) else {
            return "{\"error\":\"libmindbase call failed\"}"
        }
        defer { mindbase_free_string(cstr) }
        return String(cString: cstr)
    }

    private static func withCString(_ fn: String, args: [String]) -> UnsafeMutablePointer<CChar>? {
        func mut(_ p: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar> {
            UnsafeMutablePointer(mutating: p)
        }
        switch (fn, args.count) {
        case ("mindbase_open", 1):
            return args[0].withCString { mindbase_open(mut($0)) }
        case ("mindbase_vault_snapshot", 0):
            return mindbase_vault_snapshot()
        case ("mindbase_get_note", 1):
            return args[0].withCString { mindbase_get_note(mut($0)) }
        case ("mindbase_save_note", 2):
            return args[0].withCString { p in
                args[1].withCString { c in mindbase_save_note(mut(p), mut(c)) }
            }
        case ("mindbase_get_database_markdown", 1):
            return args[0].withCString { mindbase_get_database_markdown(mut($0)) }
        case ("mindbase_save_database_markdown", 2):
            return args[0].withCString { p in
                args[1].withCString { c in mindbase_save_database_markdown(mut(p), mut(c)) }
            }
        case ("mindbase_search", 1):
            return args[0].withCString { mindbase_search(mut($0)) }
        case ("mindbase_preview_html", 1):
            return args[0].withCString { mindbase_preview_html(mut($0)) }
        case ("mindbase_ensure_daily_note", 1):
            return args[0].withCString { mindbase_ensure_daily_note(mut($0)) }
        case ("mindbase_ensure_weekly_note", 0):
            return mindbase_ensure_weekly_note()
        default:
            return nil
        }
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        let data = Data(json.utf8)
        if let err = try? JSONDecoder.mindbase.decode(ErrorPayload.self, from: data), !err.error.isEmpty {
            throw MindbaseCoreError.api(err.error)
        }
        do {
            return try JSONDecoder.mindbase.decode(T.self, from: data)
        } catch {
            throw MindbaseCoreError.api(error.localizedDescription)
        }
    }
}

private extension JSONDecoder {
    static let mindbase: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fmt.date(from: str) { return date }
            fmt.formatOptions = [.withInternetDateTime]
            if let date = fmt.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "bad date")
        }
        return d
    }()
}
