package connectors

import "github.com/osarogie/mindbase/internal/debuglog"

func agentLog(location, message, hypothesisID string, data map[string]any) {
	// #region agent log
	debuglog.Write(location, message, hypothesisID, data)
	// #endregion
}
