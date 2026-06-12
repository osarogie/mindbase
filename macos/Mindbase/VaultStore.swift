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

    private var notesRoot: URL { root.appendingPathComponent("notes", isDirectory: true) }
    private var databasesRoot: URL { root.appendingPathComponent("databases", isDirectory: true) }
    private var metaRoot: URL { root.appendingPathComponent(".mindbase", isDirectory: true) }

    init(path: String) throws {
        let expanded = (path as NSString).expandingTildeInPath
        root = URL(fileURLWithPath: expanded, isDirectory: true)
    }

    func ensureLayout() throws {
        try FileManager.default.createDirectory(at: notesRoot, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: databasesRoot, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: metaRoot, withIntermediateDirectories: true)
    }

    func seedWelcomeIfEmpty() throws {
        let existing = try listNotes()
        guard existing.isEmpty else { return }
        let welcome = """
        # Welcome to mindbase

        Your vault works **offline** — notes and databases are stored on disk.

        - Edit notes in the rich text editor
        - Press **Save** to write to `notes/`
        - Go core starts in the background for live preview when available
        """
        _ = try saveNote("welcome.md", content: welcome)
    }

    func vaultInfo() -> VaultInfo {
        VaultInfo(root: root.path, name: root.lastPathComponent)
    }

    func listNotes() throws -> [NoteEntry] {
        guard FileManager.default.fileExists(atPath: notesRoot.path) else { return [] }
        var entries: [NoteEntry] = []
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(at: notesRoot, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey], options: [.skipsHiddenFiles]) else {
            return []
        }
        for case let fileURL as URL in enumerator {
            if fileURL.pathExtension != "md" { continue }
            if fileURL.path.contains(".attachments") { continue }
            let rel = fileURL.path.replacingOccurrences(of: notesRoot.path + "/", with: "")
            let values = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            let modified = values?.contentModificationDate ?? Date()
            let size = values?.fileSize ?? 0
            let attachDir = notesRoot.appendingPathComponent(rel + ".attachments")
            let hasAttach = (try? attachDir.checkResourceIsReachable()) == true
            entries.append(NoteEntry(
                path: rel,
                title: titleFromPath(rel),
                modified: modified,
                size: size,
                hasAttachments: hasAttach
            ))
        }
        return entries.sorted { $0.modified > $1.modified }
    }

    func getNote(_ path: String) throws -> Note {
        let url = try resolveNoteURL(path)
        let content = try String(contentsOf: url, encoding: .utf8)
        return Note(path: path, title: titleFromPath(path), content: content)
    }

    func saveNote(_ path: String, content: String) throws -> Note {
        let url = try resolveNoteURL(path)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try content.write(to: url, atomically: true, encoding: .utf8)
        return try getNote(path)
    }

    func listDatabases() throws -> [DatabaseEntry] {
        guard FileManager.default.fileExists(atPath: databasesRoot.path) else { return [] }
        var entries: [DatabaseEntry] = []
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(at: databasesRoot, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]) else {
            return []
        }
        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension == "csv" else { continue }
            let rel = fileURL.path.replacingOccurrences(of: databasesRoot.path + "/", with: "")
            let name = String(rel.dropLast(4))
            guard let table = try? readCSV(at: fileURL) else { continue }
            let values = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey])
            entries.append(DatabaseEntry(
                name: name,
                path: fileURL.lastPathComponent,
                modified: values?.contentModificationDate ?? Date(),
                rows: table.rows.count,
                columns: table.headers.count
            ))
        }
        return entries.sorted { $0.modified > $1.modified }
    }

    func getDatabase(_ name: String) throws -> DatabaseTable {
        let url = try resolveDatabaseURL(name)
        let table = try readCSV(at: url)
        return DatabaseTable(name: name, path: url.lastPathComponent, headers: table.headers, rows: table.rows)
    }

    func getDatabaseMarkdown(_ name: String) throws -> String {
        let table = try getDatabase(name)
        let title = (name as NSString).lastPathComponent
        return DatabaseMarkdown.toMarkdown(name: title, headers: table.headers, rows: table.rows)
    }

    func saveDatabase(_ name: String, headers: [String], rows: [[String]]) throws -> DatabaseTable {
        let url = try resolveDatabaseURL(name)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var lines: [String] = []
        lines.append(headers.map(escapeCSV).joined(separator: ","))
        for row in rows {
            var cells = row
            while cells.count < headers.count { cells.append("") }
            lines.append(cells.prefix(headers.count).map(escapeCSV).joined(separator: ","))
        }
        try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
        return DatabaseTable(name: name, path: url.lastPathComponent, headers: headers, rows: rows)
    }

    func saveDatabaseMarkdown(_ name: String, content: String) throws -> DatabaseTable {
        let parsed = DatabaseMarkdown.fromMarkdown(content, relName: name)
        return try saveDatabase(name, headers: parsed.headers, rows: parsed.rows)
    }

    func listVaultItems() -> [VaultItem] {
        var items: [VaultItem] = []
        for note in (try? listNotes()) ?? [] {
            guard let url = try? resolveNoteURL(note.path) else { continue }
            let folder = folderName(for: note.path)
            items.append(VaultItem(
                id: "note:\(note.path)",
                kind: .note,
                title: note.title,
                subtitle: "Page",
                path: note.path,
                folder: folder,
                fileURL: url,
                modified: note.modified
            ))
        }
        for db in (try? listDatabases()) ?? [] {
            guard let url = try? resolveDatabaseURL(db.name) else { continue }
            let sub = db.rows == 1 ? "1 row" : "\(db.rows) rows"
            let title = (db.name as NSString).lastPathComponent
            items.append(VaultItem(
                id: "db:\(db.name)",
                kind: .database,
                title: title,
                subtitle: db.rows > 0 ? sub : "Database",
                path: db.name,
                folder: folderName(for: db.name),
                fileURL: url,
                modified: db.modified
            ))
        }
        return items.sorted {
            if $0.modified == $1.modified { return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            return $0.modified > $1.modified
        }
    }

    func folderSections(from items: [VaultItem]) -> [FolderSection] {
        var groups: [String: [VaultItem]] = [:]
        var order: [String] = []
        for item in items {
            if groups[item.folder] == nil {
                order.append(item.folder)
            }
            groups[item.folder, default: []].append(item)
        }
        order.sort { lhs, rhs in
            if lhs.isEmpty { return true }
            if rhs.isEmpty { return false }
            return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
        }
        return order.map { name in
            let group = (groups[name] ?? []).sorted {
                if $0.modified == $1.modified { return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
                return $0.modified > $1.modified
            }
            return FolderSection(name: name, items: group)
        }
    }

    func fileURL(for item: VaultItem) -> URL {
        item.fileURL
    }

    func ensureDailyNote(_ date: Date = Date()) throws -> String {
        let path = Journal.dailyPath(date)
        if (try? getNote(path)) == nil {
            _ = try saveNote(path, content: Journal.dailyTemplate(date))
        }
        return path
    }

    func ensureWeeklyNote(_ date: Date = Date()) throws -> String {
        let path = Journal.weeklyPath(date)
        if (try? getNote(path)) == nil {
            let f = DateFormatter()
            f.dateFormat = "yyyy-'W'ww"
            let cal = Calendar(identifier: .iso8601)
            let week = cal.component(.weekOfYear, from: date)
            let year = cal.component(.yearForWeekOfYear, from: date)
            let content = "# Week \(week) · \(year)\n\n## Goals\n- [ ] \n\n## Review\n- \n"
            _ = try saveNote(path, content: content)
        }
        return path
    }

    func journalDayLinks() -> [JournalDayLink] {
        let cal = Calendar.current
        let specs: [(Int, String)] = [(-1, "Yesterday"), (0, "Today"), (1, "Tomorrow")]
        return specs.map { offset, label in
            let day = cal.date(byAdding: .day, value: offset, to: Date()) ?? Date()
            return JournalDayLink(label: label, date: isoDate(day), path: Journal.dailyPath(day))
        } + [JournalDayLink(label: "This week", date: "week", path: Journal.weeklyPath())]
    }

    func popularTags(limit: Int) -> [TagCount] {
        var counts: [String: Int] = [:]
        for note in (try? listNotes()) ?? [] {
            guard let content = try? getNote(note.path).content else { continue }
            for tag in extractTags(from: content) {
                counts[tag, default: 0] += 1
            }
        }
        let sorted = counts.sorted {
            if $0.value == $1.value { return $0.key < $1.key }
            return $0.value > $1.value
        }
        return sorted.prefix(limit).map { TagCount(tag: $0.key, count: $0.value) }
    }

    func openTaskCount() -> Int {
        var count = 0
        for note in (try? listNotes()) ?? [] {
            guard let content = try? getNote(note.path).content else { continue }
            count += countOpenTasks(in: content)
        }
        return count
    }

    func search(_ query: String) throws -> [SearchResult] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return [] }
        var results: [SearchResult] = []
        for note in try listNotes() {
            let content = (try? getNote(note.path).content.lowercased()) ?? ""
            if note.title.lowercased().contains(q) || content.contains(q) {
                results.append(SearchResult(
                    path: note.path,
                    title: note.title,
                    type: "note",
                    snippet: snippet(from: content, matching: q),
                    score: 1,
                    modified: note.modified
                ))
            }
        }
        for db in try listDatabases() {
            if db.name.lowercased().contains(q) {
                results.append(SearchResult(
                    path: db.path,
                    title: db.name,
                    type: "database",
                    snippet: "CSV database · \(db.rows) rows",
                    score: 1,
                    modified: db.modified
                ))
            }
        }
        return results
    }

    func offlinePreviewHTML(for path: String) throws -> String {
        let note = try getNote(path)
        let escaped = note.content
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        return "<div class=\"markdown-preview-inner\"><pre>\(escaped)</pre><p><em>Offline preview — start Go core for full markdown rendering.</em></p></div>"
    }

    private func resolveNoteURL(_ path: String) throws -> URL {
        let clean = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !clean.isEmpty, !clean.contains("..") else { throw VaultStoreError.invalidPath }
        return notesRoot.appendingPathComponent(clean)
    }

    private func resolveDatabaseURL(_ name: String) throws -> URL {
        let clean = name.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !clean.isEmpty, !clean.contains("..") else { throw VaultStoreError.invalidPath }
        var url = databasesRoot
        for part in clean.split(separator: "/") {
            url = url.appendingPathComponent(String(part))
        }
        return url.appendingPathExtension("csv")
    }

    private func folderName(for path: String) -> String {
        let dir = (path as NSString).deletingLastPathComponent
        if dir == "." || dir == path { return "" }
        return dir
    }

    private func titleFromPath(_ path: String) -> String {
        (path as NSString).lastPathComponent.replacingOccurrences(of: ".md", with: "")
    }

    private func readCSV(at url: URL) throws -> (headers: [String], rows: [[String]]) {
        let text = try String(contentsOf: url, encoding: .utf8)
        let lines = text.split(whereSeparator: \.isNewline).map(String.init)
        guard let headerLine = lines.first else { return ([], []) }
        let headers = parseCSVLine(headerLine)
        let rows = lines.dropFirst().map { parseCSVLine($0) }
        return (headers, rows)
    }

    private func parseCSVLine(_ line: String) -> [String] {
        var fields: [String] = []
        var current = ""
        var inQuotes = false
        for ch in line {
            if ch == "\"" {
                inQuotes.toggle()
            } else if ch == "," && !inQuotes {
                fields.append(current)
                current = ""
            } else {
                current.append(ch)
            }
        }
        fields.append(current)
        return fields
    }

    private func escapeCSV(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    private func snippet(from text: String, matching query: String) -> String {
        guard let range = text.range(of: query) else {
            return String(text.prefix(120))
        }
        let start = text.index(range.lowerBound, offsetBy: -40, limitedBy: text.startIndex) ?? text.startIndex
        let end = text.index(range.upperBound, offsetBy: 40, limitedBy: text.endIndex) ?? text.endIndex
        return String(text[start..<end])
    }

    private func isoDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func extractTags(from content: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: #"(?:^|[\s(])#([a-zA-Z][\w/-]*)"#) else { return [] }
        let range = NSRange(content.startIndex..., in: content)
        var seen = Set<String>()
        var tags: [String] = []
        for match in regex.matches(in: content, range: range) {
            guard match.numberOfRanges > 1, let r = Range(match.range(at: 1), in: content) else { continue }
            let tag = String(content[r]).lowercased()
            if seen.insert(tag).inserted { tags.append(tag) }
        }
        return tags
    }

    private func countOpenTasks(in content: String) -> Int {
        guard let regex = try? NSRegularExpression(pattern: #"(?m)^[\t ]*[-*+][\t ]+\[ \][\t ]+"#) else { return 0 }
        return regex.numberOfMatches(in: content, range: NSRange(content.startIndex..., in: content))
    }
}
