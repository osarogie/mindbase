package watcher

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
	"github.com/osarogie/mindbase/internal/vault"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Event struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

type Watcher struct {
	vault   *vault.Vault
	fs      *fsnotify.Watcher
	clients map[*websocket.Conn]struct{}
	mu      sync.Mutex
	done    chan struct{}
}

func New(v *vault.Vault) (*Watcher, error) {
	fs, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{
		vault:   v,
		fs:      fs,
		clients: make(map[*websocket.Conn]struct{}),
		done:    make(chan struct{}),
	}
	if err := fs.Add(v.Root); err != nil {
		fs.Close()
		return nil, err
	}
	go w.loop()
	return w, nil
}

func (w *Watcher) Close() {
	close(w.done)
	w.fs.Close()
}

func (w *Watcher) HandleWS(rw http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return
	}
	w.mu.Lock()
	w.clients[conn] = struct{}{}
	w.mu.Unlock()

	defer func() {
		w.mu.Lock()
		delete(w.clients, conn)
		w.mu.Unlock()
		conn.Close()
	}()

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (w *Watcher) loop() {
	for {
		select {
		case <-w.done:
			return
		case event, ok := <-w.fs.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
				w.broadcast(event)
			}
		case _, ok := <-w.fs.Errors:
			if !ok {
				return
			}
		}
	}
}

func (w *Watcher) broadcast(event fsnotify.Event) {
	rel, err := filepath.Rel(w.vault.Root, event.Name)
	if err != nil {
		return
	}
	rel = filepath.ToSlash(rel)

	eventType := "changed"
	if strings.Contains(rel, vault.NotesDir) {
		eventType = "note"
	} else if strings.Contains(rel, vault.DatabasesDir) {
		eventType = "database"
	}

	payload, _ := json.Marshal(Event{Type: eventType, Path: rel})
	w.mu.Lock()
	defer w.mu.Unlock()
	for conn := range w.clients {
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}
}
