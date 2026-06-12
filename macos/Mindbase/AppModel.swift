import AppKit
import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var vaultName = "mindbase"
    @Published var vaultPath: String
    @Published var section: SidebarSection = .library
    @Published var notes: [NoteEntry] = []
    @Published var databases: [DatabaseEntry] = []
    @Published var vaultItems: [VaultItem] = []
    @Published var folderSections: [FolderSection] = []
    @Published var journalDays: [JournalDayLink] = []
    @Published var popularTags: [TagCount] = []
    @Published var openTaskCount = 0
    @Published var selectedItemID: String?
    @Published var searchQuery = ""
    @Published var searchResults: [SearchResult] = []
    @Published var selectedNotePath: String?
    @Published var selectedDatabase: String?
    @Published var noteContent = ""
    @Published var previewHTML = ""
    @Published var editorMode: EditorMode = .split
    @Published var databaseHeaders: [String] = []
    @Published var databaseRows: [[String]] = []
    @Published var statusMessage = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isOfflineMode = true
    @Published var goCoreReady = false

    private let goCore = GoCoreService()
    private let api = APIClient()
    private var vaultStore: VaultStore?
    private var loadedNotePath: String?
    private var loadedDatabase: String?
    private var autosaveTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        if let saved = UserDefaults.standard.string(forKey: "vaultPath") {
            vaultPath = saved
        } else if FileManager.default.fileExists(atPath: "\(home)/mindbase-vault") {
            vaultPath = "\(home)/mindbase-vault"
        } else if FileManager.default.fileExists(atPath: "\(home)/ubase-vault") {
            vaultPath = "\(home)/ubase-vault"
        } else {
            vaultPath = "\(home)/mindbase-vault"
        }
    }

    func bootstrap() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let store = try VaultStore(path: vaultPath)
            try store.ensureLayout()
            try store.seedWelcomeIfEmpty()
            vaultStore = store
            let info = store.vaultInfo()
            vaultName = info.name
            try await refreshFromVault()
            isOfflineMode = true
            goCoreReady = false
            statusMessage = "Offline"
            // #region agent log
            DebugLog.write(location: "AppModel.swift:bootstrap", message: "offline vault ready", hypothesisId: "H1", data: [
                "vault": vaultPath,
                "notes": String(notes.count),
            ])
            // #endregion
            Task { await startGoCoreInBackground() }
        } catch {
            errorMessage = error.localizedDescription
            // #region agent log
            DebugLog.write(location: "AppModel.swift:bootstrap", message: "bootstrap failed", hypothesisId: "H1", data: ["error": error.localizedDescription])
            // #endregion
        }
    }

    private func startGoCoreInBackground() async {
        do {
            let url = try await goCore.start(vaultPath: vaultPath)
            await api.setBaseURL(url)
            goCoreReady = true
            isOfflineMode = false
            statusMessage = "Syncing Notion & Drive…"
            do {
                let syncBody = try await api.syncConnectors()
                try await refreshFromVault()
                statusMessage = "Connected · cache synced"
                // #region agent log
                DebugLog.write(location: "AppModel.swift:startGoCore", message: "connector sync ok", hypothesisId: "H3", data: [
                    "url": url.absoluteString,
                    "sync": String(syncBody.prefix(300)),
                    "notes": String(notes.count),
                ])
                // #endregion
            } catch {
                statusMessage = "Connected · sync skipped"
                // #region agent log
                DebugLog.write(location: "AppModel.swift:startGoCore", message: "connector sync failed", hypothesisId: "H3", data: [
                    "url": url.absoluteString,
                    "error": error.localizedDescription,
                ])
                // #endregion
            }
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            statusMessage = ""
            // #region agent log
            DebugLog.write(location: "AppModel.swift:startGoCore", message: "go core online", hypothesisId: "H2", data: ["url": url.absoluteString])
            // #endregion
        } catch {
            // #region agent log
            DebugLog.write(location: "AppModel.swift:startGoCore", message: "go core unavailable, staying offline", hypothesisId: "H2", data: ["error": error.localizedDescription])
            // #endregion
        }
    }

    private func refreshFromVault() async throws {
        guard let store = vaultStore else { return }
        notes = try store.listNotes()
        databases = try store.listDatabases()
        vaultItems = store.listVaultItems()
        folderSections = store.folderSections(from: vaultItems)
        journalDays = store.journalDayLinks()
        popularTags = store.popularTags(limit: 12)
        openTaskCount = store.openTaskCount()
            // #region agent log
            DebugLog.write(location: "AppModel.swift:bootstrap", message: "vault items loaded", hypothesisId: "H6", data: [
                "items": String(vaultItems.count),
                "notes": String(notes.count),
                "databases": String(databases.count),
            ])
            // #endregion
        if let path = selectedNotePath {
            selectedItemID = "note:\(path)"
        } else if let db = selectedDatabase {
            selectedItemID = "db:\(db)"
        }
    }

    func refreshAll() async throws {
        try await refreshFromVault()
    }

    func selectNote(_ path: String) async {
        section = .library
        selectedDatabase = nil
        selectedNotePath = path
        selectedItemID = "note:\(path)"
        do {
            guard let store = vaultStore else { return }
            let note = try store.getNote(path)
            noteContent = note.content
            loadedNotePath = path
            await refreshPreview()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func selectDatabase(_ name: String) async {
        section = .library
        selectedNotePath = nil
        selectedDatabase = name
        selectedItemID = "db:\(name)"
        do {
            guard let store = vaultStore else { return }
            noteContent = try store.getDatabaseMarkdown(name)
            loadedDatabase = name
            loadedNotePath = nil
            previewHTML = "<div class=\"markdown-preview-inner\"><pre>\(noteContent)</pre></div>"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveCurrent(silent: Bool = false) async {
        if !silent { statusMessage = "Saving…" }
        do {
            guard let store = vaultStore else { return }
            if let path = selectedNotePath {
                _ = try store.saveNote(path, content: noteContent)
                loadedNotePath = path
                try await refreshFromVault()
                await refreshPreview()
            } else if let name = selectedDatabase {
                _ = try store.saveDatabaseMarkdown(name, content: noteContent)
                loadedDatabase = name
                try await refreshFromVault()
                previewHTML = "<div class=\"markdown-preview-inner\"><pre>\(noteContent)</pre></div>"
            }
            statusMessage = silent ? "Saved" : "Saved"
            // #region agent log
            DebugLog.write(location: "AppModel.swift:saveCurrent", message: "document saved", hypothesisId: "H7", data: [
                "note": selectedNotePath ?? "",
                "database": selectedDatabase ?? "",
                "silent": String(silent),
                "bytes": String(noteContent.count),
            ])
            // #endregion
            try? await Task.sleep(nanoseconds: silent ? 600_000_000 : 1_000_000_000)
            if statusMessage == "Saved" { statusMessage = "" }
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = ""
        }
    }

    func refreshPreview() async {
        guard let path = selectedNotePath else { return }
        if goCoreReady {
            do {
                previewHTML = try await api.previewHTML(for: path)
                return
            } catch {
                // #region agent log
                DebugLog.write(location: "AppModel.swift:refreshPreview", message: "api preview failed, fallback offline", hypothesisId: "H3", data: ["error": error.localizedDescription])
                // #endregion
            }
        }
        do {
            previewHTML = try vaultStore?.offlinePreviewHTML(for: path) ?? "<p>Preview unavailable</p>"
        } catch {
            previewHTML = "<p>Preview unavailable</p>"
        }
    }

    func apiPreview(for path: String) async throws -> String {
        try await api.previewHTML(for: path)
    }

    func onContentChanged() {
        scheduleAutosave()
        guard editorMode != .edit else { return }
        Task { await refreshPreview() }
    }

    private func scheduleAutosave() {
        autosaveTask?.cancel()
        autosaveTask = Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            await saveCurrent(silent: true)
        }
    }

    func performSearch() {
        searchTask?.cancel()
        let q = searchQuery
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else { return }
            do {
                if goCoreReady, !q.isEmpty {
                    searchResults = try await api.search(q)
                } else {
                    searchResults = try vaultStore?.search(q) ?? []
                }
            } catch {
                searchResults = (try? vaultStore?.search(q)) ?? []
            }
        }
    }

    func openToday() async {
        if let today = journalDays.first(where: { $0.label == "Today" }) {
            await openJournalDay(today)
        }
    }

    func openJournalDay(_ day: JournalDayLink) async {
        do {
            guard let store = vaultStore else { return }
            let path: String
            if day.date == "week" {
                path = try store.ensureWeeklyNote()
            } else {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd"
                let date = f.date(from: day.date) ?? Date()
                path = try store.ensureDailyNote(date)
            }
            try await refreshFromVault()
            await selectNote(path)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openTasksInbox() async {
        section = .library
        selectedNotePath = nil
        selectedDatabase = nil
        selectedItemID = nil
        statusMessage = "\(openTaskCount) open tasks in vault"
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        statusMessage = ""
    }

    func createNote() async {
        let alert = NSAlert()
        alert.messageText = "New Note"
        alert.informativeText = "Enter note path (e.g. ideas/note.md)"
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 240, height: 24))
        alert.accessoryView = input
        alert.addButton(withTitle: "Create")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        var path = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !path.hasSuffix(".md") { path += ".md" }
        do {
            guard let store = vaultStore else { return }
            _ = try store.saveNote(path, content: "# \(path.replacingOccurrences(of: ".md", with: ""))\n\n")
            try await refreshFromVault()
            await selectNote(path)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func applyVaultPath(_ path: String) async {
        vaultPath = path
        UserDefaults.standard.set(path, forKey: "vaultPath")
        goCore.stop()
        goCoreReady = false
        await bootstrap()
    }

    func fetchCredentials() async throws -> ConnectorCredentialsView {
        try await api.getCredentials()
    }

    func saveCredentials(_ fields: [String: String]) async throws -> ConnectorCredentialsView {
        try await api.updateCredentials(fields)
    }

    func syncConnectorsNow() async throws -> String {
        try await api.syncConnectors()
    }

    func gdriveOAuthURL() async throws -> URL {
        try await api.gdriveOAuthURL()
    }

    func notionOAuthURL() async throws -> URL {
        try await api.notionOAuthURL()
    }

    func revealInFinder(_ item: VaultItem) {
        let exists = FileManager.default.fileExists(atPath: item.fileURL.path)
        // #region agent log
        DebugLog.write(location: "AppModel.swift:revealInFinder", message: "reveal in finder", hypothesisId: "H6", data: [
            "kind": item.kind.rawValue,
            "path": item.fileURL.path,
            "exists": String(exists),
        ])
        // #endregion
        guard exists else {
            errorMessage = "File not found: \(item.fileURL.path)"
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([item.fileURL])
    }
}
