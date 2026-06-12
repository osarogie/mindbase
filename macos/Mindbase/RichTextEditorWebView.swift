import SwiftUI
import WebKit

struct RichTextEditorWebView: NSViewRepresentable {
    @Binding var markdown: String
    var onChange: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "ready")
        config.userContentController.add(context.coordinator, name: "content")
        let view = WKWebView(frame: .zero, configuration: config)
        view.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = view
        if let url = Bundle.main.url(forResource: "rich-editor-frame", withExtension: "html") {
            view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else if let dev = devEditorURL() {
            view.load(URLRequest(url: dev))
        }
        return view
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.isReady && context.coordinator.lastMarkdown != markdown {
            context.coordinator.setMarkdown(markdown)
        }
    }

    private func devEditorURL() -> URL? {
        let path = FileManager.default.currentDirectoryPath + "/internal/ui/static/rich-editor-frame.html"
        return URL(fileURLWithPath: path)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var parent: RichTextEditorWebView
        weak var webView: WKWebView?
        var isReady = false
        var lastMarkdown = ""

        init(_ parent: RichTextEditorWebView) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "ready" {
                isReady = true
                setMarkdown(parent.markdown)
                return
            }
            if message.name == "content", let md = message.body as? String {
                DispatchQueue.main.async {
                    if self.parent.markdown != md {
                        self.parent.markdown = md
                        self.parent.onChange?()
                    }
                    self.lastMarkdown = md
                }
            }
        }

        func setMarkdown(_ md: String) {
            guard let webView else { return }
            lastMarkdown = md
            let escaped = md
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "`", with: "\\`")
                .replacingOccurrences(of: "$", with: "\\$")
            webView.evaluateJavaScript("setMarkdown(`\(escaped)`);") { _, _ in }
        }

        func pullMarkdown(completion: @escaping (String) -> Void) {
            webView?.evaluateJavaScript("getMarkdown();") { result, _ in
                completion(result as? String ?? self.parent.markdown)
            }
        }
    }
}
