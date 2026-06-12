package static

import "embed"

//go:embed app.css app.js tw.css icons/*
var Files embed.FS
