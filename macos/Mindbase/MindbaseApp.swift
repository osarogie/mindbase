import SwiftUI

@main
struct MindbaseApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appModel)
                .task {
                    await appModel.bootstrap()
                }
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Note") {
                    Task { await appModel.createNote() }
                }
                .keyboardShortcut("n", modifiers: [.command])
                Button("Today's Note") {
                    Task { await appModel.openToday() }
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])
            }
            CommandGroup(after: .saveItem) {
                Button("Save") {
                    Task { await appModel.saveCurrent() }
                }
                .keyboardShortcut("s", modifiers: [.command])
            }
        }

        Settings {
            SettingsView()
                .environmentObject(appModel)
        }
    }
}
