package editor

import (
	"encoding/json"
	"fmt"

	"github.com/osarogie/mindbase/internal/markdown"
)

// Page is a self-contained WYSIWYG editor HTML document for WebView hosts.
type Page struct {
	HTML string `json:"html"`
}

// BuildPage renders a Lexical-based editor page seeded with vault markdown.
func BuildPage(content string, _ markdown.RenderOptions) Page {
	return BuildPageWithKind(content, "note")
}

// BuildPageWithKind sets slash-command scope for database vs note editors.
func BuildPageWithKind(content string, kind string) Page {
	if kind != "database" {
		kind = "note"
	}
	mdJSON, err := json.Marshal(content)
	if err != nil {
		mdJSON = []byte(`""`)
	}
	kindJSON, err := json.Marshal(kind)
	if err != nil {
		kindJSON = []byte(`"note"`)
	}
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
<meta name="theme-color" content="#ffffff"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
<link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,400&amp;display=swap" rel="stylesheet"/>
<style>%s</style>
</head>
<body class="mb-immersive-doc">
<div id="lexical-root"></div>
<script>window.__MINDBASE_INITIAL_MARKDOWN__ = %s;</script>
<script>window.__MINDBASE_DOCUMENT_KIND__ = %s;</script>
<script>%s</script>
</body>
</html>`, lexicalEditorCSS, string(mdJSON), string(kindJSON), lexicalEditorJS)
	return Page{HTML: html}
}
