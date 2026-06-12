package native

import (
	"context"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/ai"
	"github.com/osarogie/mindbase/internal/connectors"
	"github.com/osarogie/mindbase/internal/database"
	"github.com/osarogie/mindbase/internal/editor"
	"github.com/osarogie/mindbase/internal/journal"
	"github.com/osarogie/mindbase/internal/markdown"
	"github.com/osarogie/mindbase/internal/notes"
	"github.com/osarogie/mindbase/internal/search"
	"github.com/osarogie/mindbase/internal/snapshots"
	"github.com/osarogie/mindbase/internal/vault"
	"github.com/osarogie/mindbase/internal/vaultgit"
	"github.com/osarogie/mindbase/internal/vaultmedia"
	"github.com/osarogie/mindbase/internal/vaultparse"
)

type Engine struct {
	vault     *vault.Vault
	notes     *notes.Service
	databases *database.Service
	search    *search.Service
}

type NoteEntry struct {
	Path         string    `json:"path"`
	Title        string    `json:"title"`
	Modified     time.Time `json:"modified"`
	Size         int64     `json:"size"`
	HasAttach    bool      `json:"hasAttachments"`
}

type Note struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type DatabaseEntry struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Modified time.Time `json:"modified"`
	Rows     int       `json:"rows"`
	Columns  int       `json:"columns"`
}

type VaultItem struct {
	ID       string    `json:"id"`
	Kind     string    `json:"kind"`
	Title    string    `json:"title"`
	Subtitle string    `json:"subtitle"`
	Path     string    `json:"path"`
	Folder   string    `json:"folder"`
	FilePath string    `json:"file_path"`
	Modified time.Time `json:"modified"`
}

type FolderSection struct {
	Name  string      `json:"name"`
	Items []VaultItem `json:"items"`
}

type JournalDayLink struct {
	Label string `json:"label"`
	Date  string `json:"date"`
	Path  string `json:"path"`
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

type OpenTaskEntry struct {
	Path      string   `json:"path"`
	NoteTitle string   `json:"note_title"`
	Line      int      `json:"line"`
	Text      string   `json:"text"`
	Schedule  string   `json:"schedule,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

type VaultInfo struct {
	Root string `json:"root"`
	Name string `json:"name"`
}

type VaultSnapshot struct {
	Info          VaultInfo        `json:"info"`
	Notes         []NoteEntry      `json:"notes"`
	Databases     []DatabaseEntry  `json:"databases"`
	VaultItems    []VaultItem      `json:"vault_items"`
	FolderSections []FolderSection `json:"folder_sections"`
	JournalDays   []JournalDayLink `json:"journal_days"`
	PopularTags   []TagCount       `json:"popular_tags"`
	OpenTaskCount int              `json:"open_task_count"`
}

func Open(vaultPath string) (*Engine, error) {
	v, err := vault.Open(vaultPath)
	if err != nil {
		return nil, err
	}
	return &Engine{
		vault:     v,
		notes:     notes.NewService(v),
		databases: database.NewService(v),
		search:    search.NewService(v),
	}, nil
}

func (e *Engine) Root() string { return e.vault.Root }

func (e *Engine) VaultInfo() VaultInfo {
	return VaultInfo{Root: e.vault.Root, Name: filepath.Base(e.vault.Root)}
}

func (e *Engine) SeedWelcomeIfEmpty() error {
	list, err := e.notes.List()
	if err != nil {
		return err
	}
	if len(list) > 0 {
		return nil
	}
	welcome := `# Welcome to mindbase

Your vault is managed by **libmindbase** — plain files on disk, git-tracked on save.

- Edit notes in the app
- Changes autosave through the Go core library
- Use **Settings → Connectors** for remote auth when configured
`
	_, err = e.notes.Save("welcome.md", welcome)
	return err
}

func (e *Engine) Snapshot() (VaultSnapshot, error) {
	noteList, err := e.notes.List()
	if err != nil {
		return VaultSnapshot{}, err
	}
	dbList, err := e.databases.List()
	if err != nil {
		return VaultSnapshot{}, err
	}

	notesOut := make([]NoteEntry, 0, len(noteList))
	for _, n := range noteList {
		notesOut = append(notesOut, NoteEntry{
			Path: n.Path, Title: n.Title, Modified: n.Modified, Size: n.Size, HasAttach: n.HasAttach,
		})
	}
	dbsOut := make([]DatabaseEntry, 0, len(dbList))
	for _, d := range dbList {
		dbsOut = append(dbsOut, DatabaseEntry{
			Name: d.Name, Path: d.Path, Modified: d.Modified, Rows: d.Rows, Columns: d.Columns,
		})
	}

	media, _ := vaultmedia.List(e.vault)
	items := buildVaultItems(e.vault, notesOut, dbsOut, media)
	sections := buildFolderSections(items)
	jDays := journalDayLinks()
	tags, _ := vaultparse.ListTags(e.vault)
	tagOut := make([]TagCount, 0, 12)
	for i, t := range tags {
		if i >= 12 {
			break
		}
		tagOut = append(tagOut, TagCount{Tag: t.Tag, Count: t.Count})
	}
	openTasks, _ := vaultparse.ListOpenTasks(e.vault)

	return VaultSnapshot{
		Info:           e.VaultInfo(),
		Notes:          notesOut,
		Databases:      dbsOut,
		VaultItems:     items,
		FolderSections: sections,
		JournalDays:    jDays,
		PopularTags:    tagOut,
		OpenTaskCount:  len(openTasks),
	}, nil
}

func (e *Engine) GetNote(path string) (*Note, error) {
	n, err := e.notes.Get(path)
	if err != nil {
		return nil, err
	}
	return &Note{Path: n.Path, Title: n.Title, Content: n.Content}, nil
}

func (e *Engine) SaveNote(path, content string) (*Note, error) {
	n, err := e.notes.Save(path, content)
	if err != nil {
		return nil, err
	}
	return &Note{Path: n.Path, Title: n.Title, Content: n.Content}, nil
}

func (e *Engine) DeleteVaultItem(kind, path string) error {
	switch kind {
	case "database":
		return e.databases.Delete(path)
	case "note", "image", "pdf", "epub", "csv", "":
		return e.notes.Delete(path)
	default:
		return fmt.Errorf("unsupported kind %q", kind)
	}
}

func (e *Engine) GetDatabaseMarkdown(name string) (string, error) {
	return database.GetMarkdown(e.databases, name)
}

func (e *Engine) SaveDatabaseMarkdown(name, content string) error {
	_, err := database.SaveMarkdown(e.databases, name, content)
	return err
}

func (e *Engine) Search(query string) ([]search.Result, error) {
	return e.search.Query(query)
}

func (e *Engine) ListOpenTasks() ([]OpenTaskEntry, error) {
	tasks, err := vaultparse.ListOpenTasks(e.vault)
	if err != nil {
		return nil, err
	}
	titleByPath := map[string]string{}
	out := make([]OpenTaskEntry, 0, len(tasks))
	for _, task := range tasks {
		title, ok := titleByPath[task.Path]
		if !ok {
			note, err := e.notes.Get(task.Path)
			if err != nil {
				title = markdown.TitleFromPath(task.Path)
			} else {
				title = note.Title
			}
			titleByPath[task.Path] = title
		}
		out = append(out, OpenTaskEntry{
			Path:      task.Path,
			NoteTitle: title,
			Line:      task.Line,
			Text:      task.Text,
			Schedule:  task.Schedule,
			Tags:      task.Tags,
		})
	}
	if out == nil {
		out = []OpenTaskEntry{}
	}
	return out, nil
}

func (e *Engine) renderOpts(notePath string) markdown.RenderOptions {
	paths := make([]string, 0)
	if list, err := e.notes.List(); err == nil {
		for _, item := range list {
			paths = append(paths, item.Path)
		}
	}
	return markdown.RenderOptions{
		NotePath:  notePath,
		NoteIndex: markdown.BuildNoteIndex(paths),
		LoadDatabase: func(name string) (*database.Table, error) {
			return e.databases.Get(name)
		},
	}
}

func (e *Engine) PreviewHTML(notePath string) (string, error) {
	n, err := e.notes.Get(notePath)
	if err != nil {
		return "", err
	}
	inner := string(markdown.Render(n.Content, e.renderOpts(notePath)))
	return `<div class="markdown-preview-inner">` + inner + `</div>`, nil
}

func (e *Engine) RenderWysiwygPage(notePath, content string) (string, error) {
	page := editor.BuildPage(content, e.renderOpts(notePath))
	return page.HTML, nil
}

func (e *Engine) HTMLToMarkdown(html string) (string, error) {
	return editor.HTMLToMarkdown(html)
}

func (e *Engine) EnsureDailyNote(date time.Time) (string, error) {
	path := journal.DailyPath(date)
	if _, err := e.notes.Get(path); err != nil {
		if _, err := e.notes.Save(path, journal.DailyTemplate(date)); err != nil {
			return "", err
		}
	}
	return path, nil
}

type HistoryCommit struct {
	Hash    string `json:"hash"`
	Short   string `json:"short"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
	Source  string `json:"source,omitempty"`
}

type NoteHistory struct {
	Path    string          `json:"path"`
	HasGit  bool            `json:"has_git"`
	HasRepo bool            `json:"has_repo"`
	Source  string          `json:"source"`
	Commits []HistoryCommit `json:"commits"`
}

func (e *Engine) NoteHistory(notePath string, limit int) (NoteHistory, error) {
	if limit <= 0 {
		limit = 30
	}
	gitPath := vaultgit.NotePath(notePath)
	out := NoteHistory{
		Path:   notePath,
		HasGit: vaultgit.HasRepo(e.vault.Root),
		Source: "snapshots",
	}

	if out.HasGit {
		out.HasRepo = true
		commits, err := vaultgit.Log(e.vault.Root, vaultgit.LogOptions{Limit: limit, Path: gitPath})
		if err == nil && len(commits) > 0 {
			out.Source = "git"
			out.Commits = make([]HistoryCommit, 0, len(commits))
			for _, c := range commits {
				out.Commits = append(out.Commits, HistoryCommit{
					Hash: c.Hash, Short: c.Short, Date: c.Date, Subject: c.Subject, Source: "git",
				})
			}
			return out, nil
		}
	}

	entries, err := snapshots.Log(e.vault.Root, gitPath, limit)
	if err != nil {
		return out, err
	}
	out.Commits = make([]HistoryCommit, 0, len(entries))
	for _, c := range entries {
		out.Commits = append(out.Commits, HistoryCommit{
			Hash: c.Hash, Short: c.Short, Date: c.Date, Subject: c.Subject, Source: "snapshots",
		})
	}
	return out, nil
}

func (e *Engine) NoteAtRev(notePath, rev string) (string, error) {
	rev = strings.TrimSpace(rev)
	if rev == "" {
		return "", fmt.Errorf("rev required")
	}
	gitPath := vaultgit.NotePath(notePath)
	if strings.HasPrefix(rev, "snap-") {
		return snapshots.Content(e.vault.Root, gitPath, rev)
	}
	return vaultgit.FileAtRev(e.vault.Root, rev, gitPath)
}

func (e *Engine) EnsureWeeklyNote(date time.Time) (string, error) {
	path := journal.WeeklyPath(date)
	if _, err := e.notes.Get(path); err != nil {
		if _, err := e.notes.Save(path, journal.WeeklyTemplate(date)); err != nil {
			return "", err
		}
	}
	return path, nil
}

type CSVTable struct {
	Path    string     `json:"path"`
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

type FilePayload struct {
	Path        string `json:"path"`
	Mime        string `json:"mime"`
	Base64      string `json:"base64"`
	Size        int64  `json:"size"`
}

func (e *Engine) GetCSVTable(vaultPath string) (*CSVTable, error) {
	if table, err := e.databases.Get(vaultPath); err == nil {
		return &CSVTable{
			Path:    table.Name,
			Headers: table.Headers,
			Rows:    table.Rows,
		}, nil
	}
	full, err := e.vault.ResolveNotePath(vaultPath)
	if err != nil {
		return nil, err
	}
	if strings.ToLower(filepath.Ext(full)) != ".csv" {
		return nil, fmt.Errorf("not a csv file")
	}
	return readCSVAbsolute(full, vaultPath)
}

func readCSVAbsolute(full, rel string) (*CSVTable, error) {
	f, err := os.Open(full)
	if err != nil {
		return nil, fmt.Errorf("open csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}
	rel = filepath.ToSlash(rel)
	if len(records) == 0 {
		return &CSVTable{Path: rel, Headers: []string{}, Rows: [][]string{}}, nil
	}
	return &CSVTable{Path: rel, Headers: records[0], Rows: records[1:]}, nil
}

func (e *Engine) ReadFilePayload(vaultPath string) (*FilePayload, error) {
	full, err := e.vault.ResolveNotePath(vaultPath)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, err
	}
	ext := strings.ToLower(filepath.Ext(full))
	mime := mimeForExt(ext)
	return &FilePayload{
		Path:   filepath.ToSlash(vaultPath),
		Mime:   mime,
		Base64: base64.StdEncoding.EncodeToString(data),
		Size:   int64(len(data)),
	}, nil
}

func mimeForExt(ext string) string {
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".heic":
		return "image/heic"
	case ".heif":
		return "image/heif"
	case ".svg":
		return "image/svg+xml"
	case ".pdf":
		return "application/pdf"
	case ".epub":
		return "application/epub+zip"
	case ".csv":
		return "text/csv"
	default:
		return "application/octet-stream"
	}
}

func buildVaultItems(v *vault.Vault, notes []NoteEntry, dbs []DatabaseEntry, media []vaultmedia.Entry) []VaultItem {
	items := make([]VaultItem, 0, len(notes)+len(dbs)+len(media))
	for _, n := range notes {
		full, _ := v.ResolveNotePath(n.Path)
		folder := filepath.Dir(n.Path)
		if folder == "." {
			folder = ""
		}
		items = append(items, VaultItem{
			ID: "note:" + n.Path, Kind: "note", Title: n.Title, Subtitle: "Page",
			Path: n.Path, Folder: folder, FilePath: full, Modified: n.Modified,
		})
	}
	for _, d := range dbs {
		full, _ := v.ResolveDatabasePath(d.Name)
		folder := filepath.Dir(d.Name)
		if folder == "." {
			folder = ""
		}
		title := filepath.Base(d.Name)
		sub := "Database"
		if d.Rows > 0 {
			sub = fmtRows(d.Rows)
		}
		items = append(items, VaultItem{
			ID: "db:" + d.Name, Kind: "database", Title: title, Subtitle: sub,
			Path: d.Name, Folder: folder, FilePath: full, Modified: d.Modified,
		})
	}
	for _, m := range media {
		folder := m.Folder
		items = append(items, VaultItem{
			ID: string(m.Kind) + ":" + m.Path,
			Kind: string(m.Kind), Title: m.Title,
			Subtitle: vaultmedia.Subtitle(m.Kind, m.Size),
			Path: m.Path, Folder: folder, FilePath: m.FilePath, Modified: m.Modified,
		})
	}
	sortVaultItems(items)
	return items
}

func buildFolderSections(items []VaultItem) []FolderSection {
	groups := map[string][]VaultItem{}
	order := []string{}
	for _, item := range items {
		if _, ok := groups[item.Folder]; !ok {
			order = append(order, item.Folder)
		}
		groups[item.Folder] = append(groups[item.Folder], item)
	}
	sortFolderNames(order)
	sections := make([]FolderSection, 0, len(order))
	for _, name := range order {
		group := groups[name]
		sortVaultItems(group)
		sections = append(sections, FolderSection{Name: name, Items: group})
	}
	return sections
}

func journalDayLinks() []JournalDayLink {
	now := time.Now()
	specs := []struct {
		offset int
		label  string
	}{
		{-1, "Yesterday"}, {0, "Today"}, {1, "Tomorrow"},
	}
	out := make([]JournalDayLink, 0, 4)
	for _, s := range specs {
		day := now.AddDate(0, 0, s.offset)
		out = append(out, JournalDayLink{
			Label: s.label,
			Date:  day.Format("2006-01-02"),
			Path:  journal.DailyPath(day),
		})
	}
	out = append(out, JournalDayLink{Label: "This week", Date: "week", Path: journal.WeeklyPath(now)})
	return out
}

func fmtRows(n int) string {
	if n == 1 {
		return "1 row"
	}
	return fmt.Sprintf("%d rows", n)
}

func sortVaultItems(items []VaultItem) {
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].Modified.After(items[i].Modified) ||
				(items[j].Modified.Equal(items[i].Modified) && strings.ToLower(items[j].Title) < strings.ToLower(items[i].Title)) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
}

func sortFolderNames(order []string) {
	for i := 0; i < len(order); i++ {
		for j := i + 1; j < len(order); j++ {
			aEmpty, bEmpty := order[i] == "", order[j] == ""
			if bEmpty && !aEmpty {
				order[i], order[j] = order[j], order[i]
				continue
			}
			if strings.ToLower(order[j]) < strings.ToLower(order[i]) {
				order[i], order[j] = order[j], order[i]
			}
		}
	}
}

func (e *Engine) AIChat(ctx context.Context, req ai.ChatRequest) (*ai.ChatResponse, error) {
	conn, err := connectors.NewService(e.vault)
	if err != nil {
		return nil, err
	}
	return conn.AIChat(ctx, req)
}
