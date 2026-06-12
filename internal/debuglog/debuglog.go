package debuglog

import (
	"encoding/json"
	"os"
	"time"
)

const Path = "/Volumes/Lacie/Users/osarogie/code/ubase/.cursor/debug-c2f09c.log"

func Write(location, message, hypothesisID string, data map[string]any) {
	payload := map[string]any{
		"sessionId":    "c2f09c",
		"timestamp":    time.Now().UnixMilli(),
		"location":     location,
		"message":      message,
		"hypothesisId": hypothesisID,
		"data":         data,
	}
	line, err := json.Marshal(payload)
	if err != nil {
		return
	}
	f, err := os.OpenFile(Path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(line, '\n'))
}
