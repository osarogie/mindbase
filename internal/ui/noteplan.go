package ui

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/journal"
	"github.com/osarogie/mindbase/internal/ui/templates"
	"github.com/osarogie/mindbase/internal/vaultparse"
)

func (h *Handlers) enrichPageData(data templates.PageData) templates.PageData {
	now := time.Now()
	data.JournalDays = buildJournalDays(now)
	tags, _ := vaultparse.ListTags(h.vault)
	data.PopularTags = toTagItems(tags, 12)
	tasks, _ := vaultparse.ListOpenTasks(h.vault)
	data.OpenTaskCount = len(tasks)
	return data
}

func buildJournalDays(t time.Time) []templates.JournalDay {
	specs := []struct {
		offset int
		label  string
	}{
		{-1, "Yesterday"},
		{0, "Today"},
		{1, "Tomorrow"},
	}
	out := make([]templates.JournalDay, 0, 4)
	for _, spec := range specs {
		day := t.AddDate(0, 0, spec.offset)
		out = append(out, templates.JournalDay{
			Label: spec.label,
			Date:  day.Format("2006-01-02"),
			Path:  journal.DailyPath(day),
		})
	}
	out = append(out, templates.JournalDay{
		Label: "This week",
		Date:  "week",
		Path:  journal.WeeklyPath(t),
	})
	return out
}

func toTagItems(tags []vaultparse.TagCount, limit int) []templates.TagItem {
	if limit <= 0 || len(tags) < limit {
		limit = len(tags)
	}
	out := make([]templates.TagItem, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, templates.TagItem{Tag: tags[i].Tag, Count: tags[i].Count})
	}
	return out
}

func (h *Handlers) noteMeta(path, content string) (backlinks []templates.BacklinkItem, tags []string, tasks []templates.TaskItem, prev, next string) {
	if bl, err := vaultparse.FindBacklinks(h.vault, path); err == nil {
		for _, b := range bl {
			backlinks = append(backlinks, templates.BacklinkItem{Path: b.Path, Title: b.Title, Context: b.Context})
		}
	}
	if backlinks == nil {
		backlinks = []templates.BacklinkItem{}
	}
	tags = vaultparse.ExtractTags(content)
	for _, t := range vaultparse.ExtractTasks(path, content) {
		tasks = append(tasks, templates.TaskItem{Line: t.Line, Text: t.Text, Done: t.Done, Schedule: t.Schedule})
	}
	if strings.HasPrefix(path, journal.NotesDir+"/") {
		base := strings.TrimSuffix(filepath.Base(path), ".md")
		if day, err := time.Parse("2006-01-02", base); err == nil {
			prev, next = journal.NavDates(day)
		}
	}
	return backlinks, tags, tasks, prev, next
}

func (h *Handlers) ensureDailyNote(day time.Time) (string, error) {
	path := journal.DailyPath(day)
	if _, err := h.notes.Get(path); err != nil {
		_, err = h.notes.Save(path, journal.DailyTemplate(day))
		if err != nil {
			return "", err
		}
	}
	return path, nil
}

func (h *Handlers) ensureWeeklyNote(day time.Time) (string, error) {
	path := journal.WeeklyPath(day)
	if _, err := h.notes.Get(path); err != nil {
		_, err = h.notes.Save(path, journal.WeeklyTemplate(day))
		if err != nil {
			return "", err
		}
	}
	return path, nil
}
