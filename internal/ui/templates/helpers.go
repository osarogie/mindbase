package templates

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

func formatInt(n int) string {
	return strconv.Itoa(n)
}

func formatFileSize(b int64) string {
	switch {
	case b < 1024:
		return fmt.Sprintf("%d B", b)
	case b < 1024*1024:
		return fmt.Sprintf("%.1f KB", float64(b)/1024)
	default:
		return fmt.Sprintf("%.1f MB", float64(b)/(1024*1024))
	}
}

func attachmentIcon(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic":
		return "🖼"
	case ".pdf":
		return "📄"
	case ".mp4", ".mov", ".webm", ".mkv":
		return "🎬"
	case ".mp3", ".wav", ".m4a", ".aac":
		return "🎵"
	case ".zip", ".tar", ".gz", ".7z":
		return "📦"
	case ".md", ".txt", ".csv":
		return "📝"
	default:
		return "📎"
	}
}

func attachmentMarkdownRef(notePath, name string) string {
	base := strings.TrimSuffix(notePath, filepath.Ext(notePath))
	return fmt.Sprintf("![%s](%s.attachments/%s)", name, base, name)
}
