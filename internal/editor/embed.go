package editor

import _ "embed"

// Lexical editor bundle (built from editor-ui/ via `make editor-ui`).
//
//go:embed lexical/editor.js
var lexicalEditorJS string

//go:embed lexical/editor.css
var lexicalEditorCSS string
