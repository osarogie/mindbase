import SwiftUI
import WebKit

struct RichTextEditorWebView: NSViewRepresentable {
    @Binding var markdown: String
    var documentPath: String
    var onChange: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "mindbase")
        let view = WKWebView(frame: .zero, configuration: config)
        view.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = view
        context.coordinator.loadPage(path: documentPath, markdown: markdown)
        return view
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.shouldReload(path: documentPath, markdown: markdown) {
            context.coordinator.loadPage(path: documentPath, markdown: markdown)
        }
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var parent: RichTextEditorWebView
        weak var webView: WKWebView?
        var isReady = false
        var lastMarkdown = ""
        var loadedPath = ""
        private var syncTask: Task<Void, Never>?

        init(_ parent: RichTextEditorWebView) {
            self.parent = parent
        }

        func shouldReload(path: String, markdown: String) -> Bool {
            path != loadedPath || (!isReady && markdown != lastMarkdown)
        }

        func loadPage(path: String, markdown: String) {
            loadedPath = path
            lastMarkdown = markdown
            isReady = false
            Task {
                do {
                    let html = try MindbaseCore.wysiwygPage(path: path, content: markdown)
                    await MainActor.run {
                        self.webView?.loadHTMLString(html, baseURL: nil)
                    }
                } catch {
                    await MainActor.run {
                        self.webView?.loadHTMLString(
                            "<p style=\"font-family:system-ui;color:#666;padding:1rem\">Editor failed to load.</p>",
                            baseURL: nil
                        )
                    }
                }
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "mindbase" else { return }
            let payload: [String: Any]
            if let dict = message.body as? [String: Any] {
                payload = dict
            } else if let raw = message.body as? String,
                      let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                payload = obj
            } else {
                return
            }

            switch payload["type"] as? String {
            case "ready":
                isReady = true
            case "change":
                guard let html = payload["html"] as? String else { return }
                syncMarkdown(fromHTML: html)
            default:
                break
            }
        }

        func syncMarkdown(fromHTML html: String) {
            syncTask?.cancel()
            syncTask = Task {
                do {
                    let md = try MindbaseCore.htmlToMarkdown(html)
                    guard !Task.isCancelled else { return }
                    await MainActor.run {
                        if self.parent.markdown != md {
                            self.parent.markdown = md
                            self.parent.onChange?()
                        }
                        self.lastMarkdown = md
                    }
                } catch {
                    // keep last good markdown
                }
            }
        }

        func pullMarkdown(completion: @escaping (String) -> Void) {
            webView?.evaluateJavaScript("document.getElementById('doc')?.innerHTML || ''") { result, _ in
                let html = result as? String ?? ""
                if html.isEmpty {
                    completion(self.parent.markdown)
                    return
                }
                Task {
                    do {
                        let md = try MindbaseCore.htmlToMarkdown(html)
                        await MainActor.run { completion(md) }
                    } catch {
                        await MainActor.run { completion(self.parent.markdown) }
                    }
                }
            }
        }
    }
}
