package templates

import (
	"time"

	"github.com/a-h/templ"
	"github.com/osarogie/mindbase/internal/connectors"
)

type NoteItem struct {
	Path      string
	Title     string
	Modified  time.Time
	HasAttach bool
	Active    bool
}

type DatabaseItem struct {
	Name     string
	Rows     int
	Modified time.Time
	Active   bool
}

type VaultItem struct {
	Kind     string // "note" or "database"
	Path     string // note rel path or database name
	Folder   string // parent folder within notes/ or databases/
	Title    string
	Subtitle string
	Modified time.Time
	Active   bool
}

type FolderSection struct {
	Name  string
	Items []VaultItem
}

type SearchResult struct {
	Path    string
	Title   string
	Type    string
	Snippet string
}

type NotePage struct {
	Path        string
	Title       string
	Content     string
	HTML        string
	Attachments []AttachmentItem
	Excalidraw  []string
	Backlinks   []BacklinkItem
	Tags        []string
	Tasks       []TaskItem
	JournalPrev string
	JournalNext string
}

type BacklinkItem struct {
	Path    string
	Title   string
	Context string
}

type TaskItem struct {
	Line     int
	Text     string
	Done     bool
	Schedule string
}

type TagItem struct {
	Tag   string
	Count int
}

type JournalDay struct {
	Label  string
	Date   string
	Path   string
	Active bool
}

type OpenTaskItem struct {
	Path     string
	Text     string
	Schedule string
}

type AttachmentItem struct {
	Name string
	URL  string
	Size int64
}

type DatabasePage struct {
	Name    string
	Path    string
	Title   string
	Content string
}

type SettingsPage struct {
	VaultName       string
	VaultPath       string
	PageCount       int
	DatabaseCount   int
	OpenTaskCount   int
	AppVersion      string
	AutoSync        bool
	SyncIntervalMin int
	SyncSource      string
	SyncSink        string
}

type PageData struct {
	VaultName      string
	View           string
	Items          []VaultItem
	FolderSections []FolderSection
	JournalDays    []JournalDay
	PopularTags    []TagItem
	OpenTaskCount  int
	OpenTasks      []OpenTaskItem
	ActiveTag      string
	Notes          []NoteItem
	Databases  []DatabaseItem
	SearchQ    string
	Results    []SearchResult
	Note       *NotePage
	Database   *DatabasePage
	Settings   *SettingsPage
	Connectors connectors.Status
}

// Component helper for optional main content
func MainContent(data PageData) templ.Component {
	if data.View == "tasks" {
		return TasksInbox(data.OpenTasks)
	}
	if data.View == "connectors" {
		return ConnectorsPanel(data.Connectors)
	}
	if data.View == "settings" && data.Settings != nil {
		return SettingsPanel(*data.Settings)
	}
	if data.Note != nil {
		return MarkdownDocumentEditor("note", data.Note.Path, data.Note.Title, data.Note.Content, data.Note)
	}
	if data.Database != nil {
		return MarkdownDocumentEditor("database", data.Database.Path, data.Database.Title, data.Database.Content, nil)
	}
	return Welcome()
}
