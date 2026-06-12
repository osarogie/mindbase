import SwiftUI

struct PaletteCommand: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String
    let keywords: [String]
    let action: () -> Void

    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return true }
        let hay = ([title, subtitle ?? ""] + keywords).joined(separator: " ").lowercased()
        return hay.contains(q) || q.split(separator: " ").allSatisfy { hay.contains(String($0)) }
    }
}

struct CommandPaletteView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selection = 0
    @FocusState private var focused: Bool

    private var commands: [PaletteCommand] {
        var list: [PaletteCommand] = [
            PaletteCommand(
                id: "nav-today",
                title: "Open today's journal",
                subtitle: "Journal",
                icon: "calendar",
                keywords: ["journal", "today"],
                action: { run { await appModel.openToday() } }
            ),
            PaletteCommand(
                id: "action-new",
                title: "New note",
                subtitle: "Create page",
                icon: "square.and.pencil",
                keywords: ["create"],
                action: { run { await appModel.createNote() } }
            ),
            PaletteCommand(
                id: "action-save",
                title: "Save",
                subtitle: "Current document",
                icon: "square.and.arrow.down",
                keywords: ["write"],
                action: { run { await appModel.saveCurrent() } }
            ),
            PaletteCommand(
                id: "nav-tasks",
                title: "Open tasks inbox",
                subtitle: "\(appModel.openTaskCount) open",
                icon: "checklist",
                keywords: ["tasks", "todo"],
                action: { run { await appModel.openTasksInbox() } }
            ),
        ]

        for item in appModel.vaultItems {
            list.append(
                PaletteCommand(
                    id: item.id,
                    title: item.title,
                    subtitle: item.path,
                    icon: item.kind == .note ? "doc.text" : "tablecells",
                    keywords: [item.folder, item.subtitle],
                    action: {
                        run {
                            if item.kind == .note {
                                await appModel.selectNote(item.path)
                            } else {
                                await appModel.selectDatabase(item.path)
                            }
                        }
                    }
                )
            )
        }
        return list
    }

    private var filtered: [PaletteCommand] {
        let matched = commands.filter { $0.matches(query) }
        return Array(matched.prefix(24))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "command")
                    .foregroundStyle(.secondary)
                TextField("Type a command or search…", text: $query)
                    .textFieldStyle(.plain)
                    .focused($focused)
                    .onSubmit { runSelected() }
                    .onChange(of: query) { _, _ in selection = 0 }
                Text("⌘K")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(12)

            Divider()

            List {
                ForEach(Array(filtered.enumerated()), id: \.element.id) { index, cmd in
                    Button {
                        cmd.action()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: cmd.icon)
                                .foregroundStyle(.secondary)
                                .frame(width: 18)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(cmd.title)
                                if let subtitle = cmd.subtitle {
                                    Text(subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                        .background(index == selection ? Color.accentColor.opacity(0.12) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.plain)
        }
        .frame(width: 520, height: 420)
        .onAppear {
            selection = 0
            focused = true
        }
    }

    private func runSelected() {
        guard filtered.indices.contains(selection) else { return }
        filtered[selection].action()
    }

    private func run(_ work: @escaping () async -> Void) {
        dismiss()
        Task { await work() }
    }
}
