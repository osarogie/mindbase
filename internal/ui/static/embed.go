package static

import "embed"

//go:embed app.css app.js icons/*
var Files embed.FS
