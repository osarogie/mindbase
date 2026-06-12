package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"context"
	"encoding/json"
	"sync"
	"time"
	"unsafe"

	"github.com/osarogie/mindbase/internal/ai"
	"github.com/osarogie/mindbase/internal/native"
	"github.com/osarogie/mindbase/internal/search"
)

var (
	mu  sync.Mutex
	eng *native.Engine
)

func jsonReply(v any, err error) *C.char {
	if err != nil {
		b, _ := json.Marshal(map[string]string{"error": err.Error()})
		return C.CString(string(b))
	}
	b, _ := json.Marshal(v)
	return C.CString(string(b))
}

//export mindbase_free_string
func mindbase_free_string(s *C.char) {
	C.free(unsafe.Pointer(s))
}

//export mindbase_open
func mindbase_open(vaultPath *C.char) *C.char {
	path := C.GoString(vaultPath)
	e, err := native.Open(path)
	if err != nil {
		return jsonReply(nil, err)
	}
	if err := e.SeedWelcomeIfEmpty(); err != nil {
		return jsonReply(nil, err)
	}
	mu.Lock()
	eng = e
	mu.Unlock()
	return jsonReply(e.VaultInfo(), nil)
}

//export mindbase_vault_snapshot
func mindbase_vault_snapshot() *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	snap, err := e.Snapshot()
	return jsonReply(snap, err)
}

//export mindbase_get_note
func mindbase_get_note(path *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	n, err := e.GetNote(C.GoString(path))
	return jsonReply(n, err)
}

//export mindbase_save_note
func mindbase_save_note(path *C.char, content *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	n, err := e.SaveNote(C.GoString(path), C.GoString(content))
	return jsonReply(n, err)
}

//export mindbase_delete_vault_item
func mindbase_delete_vault_item(kind *C.char, path *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	err := e.DeleteVaultItem(C.GoString(kind), C.GoString(path))
	return jsonReply(map[string]bool{"ok": err == nil}, err)
}

//export mindbase_get_database_markdown
func mindbase_get_database_markdown(name *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	md, err := e.GetDatabaseMarkdown(C.GoString(name))
	if err != nil {
		return jsonReply(nil, err)
	}
	return jsonReply(map[string]string{"content": md}, nil)
}

//export mindbase_save_database_markdown
func mindbase_save_database_markdown(name *C.char, content *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	err := e.SaveDatabaseMarkdown(C.GoString(name), C.GoString(content))
	return jsonReply(map[string]bool{"ok": err == nil}, err)
}

//export mindbase_search
func mindbase_search(query *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	results, err := e.Search(C.GoString(query))
	if err != nil {
		return jsonReply(nil, err)
	}
	if results == nil {
		results = []search.Result{}
	}
	return jsonReply(results, nil)
}

//export mindbase_list_open_tasks
func mindbase_list_open_tasks() *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	tasks, err := e.ListOpenTasks()
	return jsonReply(tasks, err)
}

//export mindbase_get_csv_table
func mindbase_get_csv_table(path *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	table, err := e.GetCSVTable(C.GoString(path))
	return jsonReply(table, err)
}

//export mindbase_read_file_payload
func mindbase_read_file_payload(path *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	payload, err := e.ReadFilePayload(C.GoString(path))
	return jsonReply(payload, err)
}

//export mindbase_preview_html
func mindbase_preview_html(path *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	html, err := e.PreviewHTML(C.GoString(path))
	if err != nil {
		return jsonReply(nil, err)
	}
	return jsonReply(map[string]string{"html": html}, nil)
}

//export mindbase_ensure_daily_note
func mindbase_ensure_daily_note(isoDate *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	raw := C.GoString(isoDate)
	t, err := time.Parse("2006-01-02", raw)
	if err != nil {
		t = time.Now()
	}
	path, err := e.EnsureDailyNote(t)
	return jsonReply(map[string]string{"path": path}, err)
}

//export mindbase_ensure_weekly_note
func mindbase_ensure_weekly_note() *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	path, err := e.EnsureWeeklyNote(time.Now())
	return jsonReply(map[string]string{"path": path}, err)
}

//export mindbase_note_history
func mindbase_note_history(path *C.char, limit C.int) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	hist, err := e.NoteHistory(C.GoString(path), int(limit))
	return jsonReply(hist, err)
}

//export mindbase_note_at_rev
func mindbase_note_at_rev(path *C.char, rev *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	content, err := e.NoteAtRev(C.GoString(path), C.GoString(rev))
	if err != nil {
		return jsonReply(nil, err)
	}
	return jsonReply(map[string]string{
		"path":    C.GoString(path),
		"rev":     C.GoString(rev),
		"content": content,
	}, nil)
}

//export mindbase_wysiwyg_page
func mindbase_wysiwyg_page(path *C.char, content *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	html, err := e.RenderWysiwygPage(C.GoString(path), C.GoString(content))
	if err != nil {
		return jsonReply(nil, err)
	}
	return jsonReply(map[string]string{"html": html}, nil)
}

//export mindbase_html_to_markdown
func mindbase_html_to_markdown(html *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	md, err := e.HTMLToMarkdown(C.GoString(html))
	if err != nil {
		return jsonReply(nil, err)
	}
	return jsonReply(map[string]string{"markdown": md}, nil)
}

//export mindbase_ai_chat
func mindbase_ai_chat(body *C.char) *C.char {
	mu.Lock()
	e := eng
	mu.Unlock()
	if e == nil {
		return jsonReply(nil, errNotOpen)
	}
	var req ai.ChatRequest
	if err := json.Unmarshal([]byte(C.GoString(body)), &req); err != nil {
		return jsonReply(nil, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	res, err := e.AIChat(ctx, req)
	return jsonReply(res, err)
}

var errNotOpen = &nativeError{"vault not open — call mindbase_open first"}

type nativeError struct{ msg string }

func (e *nativeError) Error() string { return e.msg }

func main() {}
