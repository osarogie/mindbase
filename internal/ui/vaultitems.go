package ui

import (
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/osarogie/mindbase/internal/ui/templates"
)

func buildVaultItems(notes []templates.NoteItem, dbs []templates.DatabaseItem) []templates.VaultItem {
	items := make([]templates.VaultItem, 0, len(notes)+len(dbs))
	for _, n := range notes {
		folder := filepath.Dir(n.Path)
		if folder == "." {
			folder = ""
		}
		items = append(items, templates.VaultItem{
			Kind:     "note",
			Path:     n.Path,
			Folder:   folder,
			Title:    n.Title,
			Subtitle: "Page",
			Modified: n.Modified,
			Active:   n.Active,
		})
	}
	for _, d := range dbs {
		sub := "Database"
		if d.Rows > 0 {
			sub = fmtRows(d.Rows)
		}
		folder := filepath.Dir(d.Name)
		if folder == "." {
			folder = ""
		}
		title := d.Name
		if base := filepath.Base(d.Name); base != "" && base != "." {
			title = base
		}
		items = append(items, templates.VaultItem{
			Kind:     "database",
			Path:     d.Name,
			Folder:   folder,
			Title:    title,
			Subtitle: sub,
			Modified: d.Modified,
			Active:   d.Active,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Modified.Equal(items[j].Modified) {
			return strings.ToLower(items[i].Title) < strings.ToLower(items[j].Title)
		}
		return items[i].Modified.After(items[j].Modified)
	})
	return items
}

func buildFolderSections(items []templates.VaultItem) []templates.FolderSection {
	groups := map[string][]templates.VaultItem{}
	order := make([]string, 0)
	for _, item := range items {
		folder := item.Folder
		if _, ok := groups[folder]; !ok {
			order = append(order, folder)
		}
		groups[folder] = append(groups[folder], item)
	}
	sort.Slice(order, func(i, j int) bool {
		if order[i] == "" {
			return true
		}
		if order[j] == "" {
			return false
		}
		return strings.ToLower(order[i]) < strings.ToLower(order[j])
	})
	sections := make([]templates.FolderSection, 0, len(order))
	for _, name := range order {
		group := groups[name]
		sort.Slice(group, func(i, j int) bool {
			if group[i].Modified.Equal(group[j].Modified) {
				return strings.ToLower(group[i].Title) < strings.ToLower(group[j].Title)
			}
			return group[i].Modified.After(group[j].Modified)
		})
		sections = append(sections, templates.FolderSection{Name: name, Items: group})
	}
	return sections
}

func fmtRows(n int) string {
	if n == 1 {
		return "1 row"
	}
	return strconv.Itoa(n) + " rows"
}

func markActiveItem(items []templates.VaultItem, kind, path string) []templates.VaultItem {
	for i := range items {
		items[i].Active = items[i].Kind == kind && items[i].Path == path
	}
	return items
}

func markActiveSections(sections []templates.FolderSection, kind, path string) []templates.FolderSection {
	for si := range sections {
		for ii := range sections[si].Items {
			item := &sections[si].Items[ii]
			item.Active = item.Kind == kind && item.Path == path
		}
	}
	return sections
}
