import AppKit
import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var vaultName = "mindbase"
    @Published var vaultPath: String
    @Published var authAPIBaseURL: String = UserDefaults.standard.string(forKey: AuthAPIClient.baseURLKey) ?? ""
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
    @Published var commandPalettePresented = false

    private let authAPI = AuthAPIClient()
    private var vaultStore: VaultStore?
    private var vaultWatcher: VaultWatcher?
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
            _ = try store.openLibrary()
            vaultStore = store
            vaultName = store.vaultInfo().name
            startWatchingVault(at: store.root)
            try await refreshFromVault()
            statusMessage = "Local vault"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func startWatchingVault(at root: URL) {
        vaultWatcher?.stop()
        let watcher = VaultWatcher { [weak self] in
            Task { @MainActor in
                try? await self?.refreshFromVault()
            }
        }
        watcher.start(watching: root)
        vaultWatcher = watcher
    }

    private func refreshFromVault() async throws {
        guard let store = vaultStore else { return }
        let snap = try store.snapshot()
        notes = snap.notes
        databases = snap.databases
        vaultItems = snap.vaultItems
        folderSections = snap.folderSections
        journalDays = snap.journalDays
        popularTags = snap.popularTags
        openTaskCount = snap.openTaskCount
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
            statusMessage = "Saved"
            try? await Task.sleep(nanoseconds: silent ? 600_000_000 : 1_000_000_000)
            if statusMessage == "Saved" { statusMessage = "" }
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = ""
        }
    }

    func refreshPreview() async {
        guard let path = selectedNotePath else { return }
        do {
            previewHTML = try vaultStore?.offlinePreviewHTML(for: path) ?? "<p>Preview unavailable</p>"
        } catch {
            previewHTML = "<p>Preview unavailable</p>"
        }
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
            searchResults = (try? vaultStore?.search(q)) ?? []
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
        vaultWatcher?.stop()
        await bootstrap()
    }

    func applyAuthAPIBaseURL(_ url: String) {
        authAPIBaseURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(authAPIBaseURL, forKey: AuthAPIClient.baseURLKey)
    }

    func localCredentials() throws -> ConnectorCredentialsView {
        guard let store = vaultStore else { return .empty }
        return try VaultSecrets(vaultRoot: store.root).view()
    }

    func saveCredentials(_ fields: [String: String]) async throws -> ConnectorCredentialsView {
        guard let store = vaultStore else { return .empty }
        let local = try VaultSecrets(vaultRoot: store.root).apply(fields: fields)
        if AuthAPIClient.configuredBaseURL != nil {
            _ = try await authAPI.pushCredentials(fields)
        }
        return local
    }

    func syncConnectorsNow() async throws -> String {
        try await authAPI.syncConnectors()
    }

    func gdriveOAuthURL() async throws -> URL {
        try await authAPI.gdriveOAuthURL()
    }

    func notionOAuthURL() async throws -> URL {
        try await authAPI.notionOAuthURL()
    }

    func revealInFinder(_ item: VaultItem) {
        let exists = FileManager.default.fileExists(atPath: item.fileURL.path)
        guard exists else {
            errorMessage = "File not found: \(item.fileURL.path)"
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([item.fileURL])
    }
}
