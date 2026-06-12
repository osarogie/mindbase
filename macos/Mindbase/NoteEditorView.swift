import SwiftUI

struct DocumentEditorView: View {
    @EnvironmentObject private var appModel: AppModel
    let kind: VaultItem.Kind
    let path: String

    private var title: String {
        (path as NSString).lastPathComponent.replacingOccurrences(of: ".md", with: "")
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(path)
                    .font(.headline)
                    .lineLimit(1)
                if kind == .database {
                    Text("database")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if !appModel.statusMessage.isEmpty {
                    Text(appModel.statusMessage).foregroundStyle(.secondary)
                }
                Picker("Mode", selection: $appModel.editorMode) {
                    ForEach(EditorMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 220)
                Button("Save") {
                    Task { await appModel.saveCurrent() }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            Divider()

            HStack(spacing: 0) {
                if appModel.editorMode != .preview {
                    RichTextEditorWebView(markdown: $appModel.noteContent) {
                        appModel.onContentChanged()
                    }
                    .frame(minWidth: 200)
                }
                if appModel.editorMode != .edit {
                    MarkdownPreviewWebView(html: appModel.previewHTML)
                        .frame(minWidth: 200)
                }
            }
        }
        .onChange(of: path) { _, newPath in
            Task {
                if kind == .note {
                    await appModel.selectNote(newPath)
                } else {
                    await appModel.selectDatabase(newPath)
                }
            }
        }
        .onChange(of: appModel.editorMode) { _, mode in
            if mode != .edit {
                Task { await appModel.refreshPreview() }
            }
        }
    }
}

struct NoteEditorView: View {
    @EnvironmentObject private var appModel: AppModel
    let notePath: String

    var body: some View {
        DocumentEditorView(kind: .note, path: notePath)
    }
}

struct DatabaseEditorView: View {
    @EnvironmentObject private var appModel: AppModel
    let databaseName: String

    var body: some View {
        DocumentEditorView(kind: .database, path: databaseName)
    }
}
