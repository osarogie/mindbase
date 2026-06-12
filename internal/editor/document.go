package editor

import (
	"fmt"
	"html/template"

	"github.com/osarogie/mindbase/internal/markdown"
)

// Page is a self-contained WYSIWYG editor HTML document for WebView hosts.
type Page struct {
	HTML string `json:"html"`
}

// BuildPage renders markdown to a full-screen contenteditable document.
func BuildPage(content string, opts markdown.RenderOptions) Page {
	body := string(markdown.Render(content, opts))
	if body == "" {
		body = "<p><br/></p>"
	}
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>%s</style>
</head>
<body>
<div id="doc" class="mindbase-wysiwyg" contenteditable="true" spellcheck="true">%s</div>
<script>%s</script>
</body>
</html>`, wysiwygCSS(), body, wysiwygJS())
	return Page{HTML: html}
}

func wysiwygCSS() string {
	return `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  background: #FCFAF3; color: #332D21;
  -webkit-text-size-adjust: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body { display: flex; flex-direction: column; min-height: 100%; }
.mindbase-wysiwyg {
  flex: 1; min-height: 100%;
  padding: 20px 20px 48px;
  outline: none; font-size: 17px; line-height: 1.65;
  -webkit-user-select: text; user-select: text;
}
.mindbase-wysiwyg:focus { outline: none; }
.mindbase-wysiwyg h1 { font-size: 2rem; font-weight: 700; margin: 0 0 0.75rem; line-height: 1.2; letter-spacing: -0.02em; }
.mindbase-wysiwyg h2 { font-size: 1.45rem; font-weight: 650; margin: 1.25rem 0 0.5rem; }
.mindbase-wysiwyg h3 { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.35rem; }
.mindbase-wysiwyg p { margin: 0 0 0.65rem; }
.mindbase-wysiwyg ul, .mindbase-wysiwyg ol { margin: 0 0 0.65rem; padding-left: 1.35rem; }
.mindbase-wysiwyg li { margin: 0.2rem 0; }
.mindbase-wysiwyg ul.task-list { list-style: none; padding-left: 0; }
.mindbase-wysiwyg li.task-item { display: flex; align-items: flex-start; gap: 0.5rem; }
.mindbase-wysiwyg li.task-item input { margin-top: 0.35rem; pointer-events: none; }
.mindbase-wysiwyg code {
  background: #EFE9DA; border-radius: 4px; padding: 0.1em 0.35em;
  font-family: Menlo, monospace; font-size: 0.9em;
}
.mindbase-wysiwyg pre {
  background: #1E1E1E; color: #f5f5f5; border-radius: 12px;
  padding: 12px; overflow-x: auto; margin: 0 0 0.75rem;
}
.mindbase-wysiwyg pre code { background: transparent; padding: 0; color: inherit; }
.mindbase-wysiwyg blockquote {
  border-left: 3px solid #C4B89E; padding-left: 12px; margin: 0 0 0.65rem; color: #5C5344;
}
.mindbase-wysiwyg a { color: #147A64; text-decoration: none; font-weight: 500; }
.mindbase-wysiwyg a.wiki-link.missing { color: #867A60; border-bottom: 1px dashed #C4B89E; }
.mindbase-wysiwyg .tag-link { color: #6A53D6; }
.mindbase-wysiwyg .mention { color: #6A53D6; font-weight: 500; }
.mindbase-wysiwyg .schedule-badge { color: #147A64; font-weight: 600; }
.mindbase-wysiwyg table { border-collapse: collapse; width: 100%; margin: 0 0 0.75rem; font-size: 0.95rem; }
.mindbase-wysiwyg td, .mindbase-wysiwyg th { border: 1px solid #DAD0B8; padding: 6px 10px; }
.mindbase-wysiwyg .database-embed { overflow-x: auto; margin: 0 0 0.75rem; }
`
}

func wysiwygJS() template.HTML {
	//nolint:gosec // trusted editor bootstrap script
	return template.HTML(`
(function () {
  var doc = document.getElementById('doc');
  var debounce;
  function post(msg) {
    var payload = JSON.stringify(msg);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mindbase) {
      window.webkit.messageHandlers.mindbase.postMessage(payload);
    }
  }
  function notifyChange() {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      post({ type: 'change', html: doc.innerHTML });
    }, 280);
  }
  function notifyHeight() {
    var h = Math.max(doc.scrollHeight, document.documentElement.scrollHeight, 320);
    post({ type: 'height', value: h });
  }
  doc.addEventListener('input', function () { notifyChange(); notifyHeight(); });
  doc.addEventListener('keyup', notifyHeight);
  window.mindbaseInsertHtml = function (html) {
    doc.focus();
    try {
      document.execCommand('insertHTML', false, html);
    } catch (e) {
      doc.innerHTML += html;
    }
    notifyChange();
    notifyHeight();
  };
  window.mindbaseExecFormat = function (cmd) {
    doc.focus();
    try {
      document.execCommand(cmd, false, null);
    } catch (e) {}
    notifyChange();
    notifyHeight();
  };
  post({ type: 'ready' });
  notifyHeight();
  if (window.ResizeObserver) {
    new ResizeObserver(notifyHeight).observe(doc);
  }
})();
`)
}
