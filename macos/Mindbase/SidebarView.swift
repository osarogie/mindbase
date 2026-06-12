import SwiftUI

struct SidebarView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        VStack(spacing: 0) {
            TextField("Search", text: $appModel.searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding()
                .onChange(of: appModel.searchQuery) { _, _ in
                    appModel.performSearch()
                }

            if !appModel.searchResults.isEmpty {
                List(appModel.searchResults) { result in
                    Button {
                        Task {
                            if result.type == "note" {
                                await appModel.selectNote(result.path)
                            } else {
                                let name = result.path.replacingOccurrences(of: ".csv", with: "")
                                await appModel.selectDatabase(name)
                            }
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.title).font(.headline)
                            Text(result.snippet).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        if let item = vaultItem(matching: result) {
                            Button("Open in Finder") { appModel.revealInFinder(item) }
                        }
                    }
                }
                .listStyle(.plain)
                .frame(maxHeight: 160)
            }

            Divider()

            VStack(alignment: .leading, spacing: 4) {
                Text("Calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .padding(.horizontal, 12)
                ForEach(appModel.journalDays) { day in
                    Button {
                        Task { await appModel.openJournalDay(day) }
                    } label: {
                        Label(day.label, systemImage: day.date == "week" ? "calendar" : "calendar.day.timeline.left")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 8)
                }
                Button {
                    Task { await appModel.openTasksInbox() }
                } label: {
                    HStack {
                        Label("Open tasks", systemImage: "checklist")
                        Spacer()
                        if appModel.openTaskCount > 0 {
                            Text("\(appModel.openTaskCount)")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .background(Color.accentColor.opacity(0.2))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal, 8)
                }
                .buttonStyle(.plain)
                if !appModel.popularTags.isEmpty {
                    Text("Tags")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .padding(.horizontal, 12)
                        .padding(.top, 4)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(appModel.popularTags) { tag in
                                Text("#\(tag.tag)")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.secondary.opacity(0.12))
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 8)
                    }
                }
            }
            .padding(.vertical, 6)

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(appModel.folderSections) { section in
                        if !section.name.isEmpty {
                            Text(section.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                                .padding(.horizontal, 8)
                                .padding(.top, 4)
                        }
                        ForEach(section.items) { item in
                            vaultRow(item)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 320)
    }

    @ViewBuilder
    private func vaultRow(_ item: VaultItem) -> some View {
        Button {
            appModel.selectedItemID = item.id
            Task {
                if item.kind == .note {
                    await appModel.selectNote(item.path)
                } else {
                    await appModel.selectDatabase(item.path)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: item.kind == .note ? "doc.text" : "tablecells")
                    .foregroundStyle(appModel.selectedItemID == item.id ? Color.accentColor : .secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .foregroundStyle(appModel.selectedItemID == item.id ? .primary : .secondary)
                    Text(item.subtitle).font(.caption).foregroundStyle(.tertiary)
                }
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(appModel.selectedItemID == item.id ? Color.accentColor.opacity(0.12) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Open in Finder") { appModel.revealInFinder(item) }
        }
        .padding(.horizontal, 6)
    }

    private func vaultItem(matching result: SearchResult) -> VaultItem? {
        if result.type == "note" {
            return appModel.vaultItems.first { $0.kind == .note && $0.path == result.path }
        }
        let name = result.path.replacingOccurrences(of: ".csv", with: "")
        return appModel.vaultItems.first { $0.kind == .database && $0.path == name }
    }
}
