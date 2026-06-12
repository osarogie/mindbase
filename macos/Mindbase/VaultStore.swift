import Foundation

enum VaultStoreError: LocalizedError {
    case invalidPath
    case readFailed(String)
    case writeFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidPath: return "Invalid vault path"
        case .readFailed(let p): return "Could not read \(p)"
        case .writeFailed(let p): return "Could not write \(p)"
        }
    }
}

struct VaultStore {
    let root: URL

    init(path: String) throws {
        let expanded = (path as NSString).expandingTildeInPath
        root = URL(fileURLWithPath: expanded, isDirectory: true)
    }

    func ensureLayout() throws {
        try FileManager.default.createDirectory(at: root.appendingPathComponent("notes"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("databases"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appendingPathComponent(".mindbase"), withIntermediateDirectories: true)
    }

    func openLibrary() throws -> VaultInfo {
        try MindbaseCore.open(vaultPath: root.path)
    }

    func vaultInfo() -> VaultInfo {
        VaultInfo(root: root.path, name: root.lastPathComponent)
    }

    func snapshot() throws -> (
        notes: [NoteEntry],
        databases: [DatabaseEntry],
        vaultItems: [VaultItem],
        folderSections: [FolderSection],
        journalDays: [JournalDayLink],
        popularTags: [TagCount],
        openTaskCount: Int
    ) {
        try MindbaseCore.snapshot()
    }

    func listNotes() throws -> [NoteEntry] {
        try snapshot().notes
    }

    func getNote(_ path: String) throws -> Note {
        try MindbaseCore.getNote(path)
    }

    func saveNote(_ path: String, content: String) throws -> Note {
        try MindbaseCore.saveNote(path, content: content)
    }

    func listDatabases() throws -> [DatabaseEntry] {
        try snapshot().databases
    }

    func getDatabaseMarkdown(_ name: String) throws -> String {
        try MindbaseCore.getDatabaseMarkdown(name)
    }

    func saveDatabaseMarkdown(_ name: String, content: String) throws {
        try MindbaseCore.saveDatabaseMarkdown(name, content: content)
    }

    func listVaultItems() throws -> [VaultItem] {
        try snapshot().vaultItems
    }

    func folderSections(from items: [VaultItem]) -> [FolderSection] {
        try! snapshot().folderSections
    }

    func journalDayLinks() -> [JournalDayLink] {
        (try? snapshot().journalDays) ?? []
    }

    func popularTags(limit: Int) -> [TagCount] {
        Array((try? snapshot().popularTags) ?? [])
    }

    func openTaskCount() -> Int {
        (try? snapshot().openTaskCount) ?? 0
    }

    func search(_ query: String) throws -> [SearchResult] {
        try MindbaseCore.search(query)
    }

    func offlinePreviewHTML(for path: String) throws -> String {
        try MindbaseCore.previewHTML(for: path)
    }

    func ensureDailyNote(_ date: Date = Date()) throws -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return try MindbaseCore.ensureDailyNote(isoDate: f.string(from: date))
    }

    func ensureWeeklyNote(_ date: Date = Date()) throws -> String {
        _ = date
        return try MindbaseCore.ensureWeeklyNote()
    }

    func fileURL(for item: VaultItem) -> URL {
        item.fileURL
    }
}
