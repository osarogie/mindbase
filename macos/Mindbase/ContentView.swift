import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            DetailView()
        }
        .navigationTitle(appModel.vaultName)
        .alert("Error", isPresented: Binding(
            get: { appModel.errorMessage != nil },
            set: { if !$0 { appModel.errorMessage = nil } }
        )) {
            Button("OK") { appModel.errorMessage = nil }
        } message: {
            Text(appModel.errorMessage ?? "")
        }
        .sheet(isPresented: $appModel.commandPalettePresented) {
            CommandPaletteView()
                .environmentObject(appModel)
        }
        .background {
            Button("") {
                appModel.commandPalettePresented = true
            }
            .keyboardShortcut("p", modifiers: .command)
            .opacity(0)
            .frame(width: 0, height: 0)
        }
    }
}

struct DetailView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        Group {
            if appModel.isLoading {
                ProgressView("Loading vault…")
            } else if let path = appModel.selectedNotePath {
                DocumentEditorView(kind: .note, path: path)
            } else if let db = appModel.selectedDatabase {
                DocumentEditorView(kind: .database, path: db)
            } else {
                WelcomeView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct WelcomeView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "note.text")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Welcome to mindbase")
                .font(.title)
            Text("Native SwiftUI — local vault files on disk, git-tracked.")
                .foregroundStyle(.secondary)
            Text("Select a note or database, or press ⌘K for the command palette.")
                .font(.callout)
                .foregroundStyle(.tertiary)
        }
        .padding()
    }
}

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var path = ""

    var body: some View {
        TabView {
            Form {
                TextField("Vault path", text: $path)
                Button("Apply vault path") {
                    Task { await appModel.applyVaultPath(path) }
                }
            }
            .padding()
            .tabItem { Label("Vault", systemImage: "folder") }

            Form {
                ConnectorsSettingsView()
            }
            .padding()
            .tabItem { Label("Connectors", systemImage: "link") }
        }
        .frame(width: 520, height: 560)
        .onAppear { path = appModel.vaultPath }
    }
}
