import SwiftUI
import WebKit

struct MarkdownPreviewWebView: NSViewRepresentable {
    let html: String

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let view = WKWebView(frame: .zero, configuration: config)
        view.setValue(false, forKey: "drawsBackground")
        return view
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        let styled = """
        <!doctype html>
        <html><head>
        <meta charset="utf-8">
        <meta name="color-scheme" content="dark light">
        <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
        <style>
          body { font: -apple-system-body; line-height: 1.5; padding: 16px; margin: 0; }
          pre { background: rgba(127,127,127,.15); padding: 8px; border-radius: 8px; overflow-x: auto; }
          code { background: rgba(127,127,127,.15); padding: 2px 4px; border-radius: 4px; }
          .wiki-link.missing { opacity: 0.6; border-bottom: 1px dashed currentColor; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid rgba(127,127,127,.35); padding: 4px 8px; }
        </style>
        </head><body>
        \(html)
        <script>
          if (window.mermaid) {
            mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
          }
        </script>
        </body></html>
        """
        webView.loadHTMLString(styled, baseURL: nil)
    }
}
