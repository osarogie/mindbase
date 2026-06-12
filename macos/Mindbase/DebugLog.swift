import Foundation

enum DebugLog {
    private static let path = "/Volumes/Lacie/Users/osarogie/code/ubase/.cursor/debug-c2f09c.log"

    static func write(location: String, message: String, hypothesisId: String, data: [String: String] = [:]) {
        var payload: [String: Any] = [
            "sessionId": "c2f09c",
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "location": location,
            "message": message,
            "hypothesisId": hypothesisId,
            "data": data,
        ]
        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let line = String(data: json, encoding: .utf8) else { return }
        let url = URL(fileURLWithPath: path)
        if !FileManager.default.fileExists(atPath: path) {
            FileManager.default.createFile(atPath: path, contents: nil)
        }
        guard let handle = try? FileHandle(forWritingTo: url) else { return }
        defer { try? handle.close() }
        try? handle.seekToEnd()
        if let data = (line + "\n").data(using: .utf8) {
            try? handle.write(contentsOf: data)
        }
    }
}
