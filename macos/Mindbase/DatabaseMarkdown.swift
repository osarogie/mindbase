import Foundation

enum DatabaseMarkdown {
    static func toMarkdown(name: String, headers: [String], rows: [[String]]) -> String {
        var lines: [String] = ["# \(name)", ""]
        guard !headers.isEmpty else { return lines.joined(separator: "\n") }
        lines.append("| \(headers.map(escapeCell).joined(separator: " | ")) |")
        lines.append("| \(headers.map { _ in "---" }.joined(separator: " | ")) |")
        for row in rows {
            var cells = row
            while cells.count < headers.count { cells.append("") }
            lines.append("| \(cells.prefix(headers.count).map(escapeCell).joined(separator: " | ")) |")
        }
        return lines.joined(separator: "\n")
    }

    static func fromMarkdown(_ content: String, relName: String) -> (headers: [String], rows: [[String]]) {
        var title = (relName as NSString).lastPathComponent
        var tableLines: [String] = []
        for line in content.split(separator: "\n", omittingEmptySubsequences: false) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("# ") {
                title = String(trimmed.dropFirst(2))
                continue
            }
            if trimmed.hasPrefix("|") {
                tableLines.append(trimmed)
            }
        }
        _ = title
        guard let first = tableLines.first else { return ([], []) }
        let headers = parseRow(first)
        var start = 1
        if tableLines.count > 1, isSeparatorRow(tableLines[1]) {
            start = 2
        }
        var rows: [[String]] = []
        for line in tableLines.dropFirst(start) where !isSeparatorRow(line) {
            rows.append(padRow(parseRow(line), count: headers.count))
        }
        return (headers, rows)
    }

    private static func parseRow(_ line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("|") { trimmed.removeFirst() }
        if trimmed.hasSuffix("|") { trimmed.removeLast() }
        return trimmed.split(separator: "|", omittingEmptySubsequences: false).map {
            String($0).trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\\|", with: "|")
        }
    }

    private static func isSeparatorRow(_ line: String) -> Bool {
        let cells = parseRow(line)
        guard !cells.isEmpty else { return false }
        for cell in cells {
            let c = cell.trimmingCharacters(in: .whitespaces)
            if c.isEmpty { continue }
            for ch in c where ch != "-" && ch != ":" && ch != " " {
                return false
            }
        }
        return true
    }

    private static func padRow(_ row: [String], count: Int) -> [String] {
        var out = row
        while out.count < count { out.append("") }
        return Array(out.prefix(count))
    }

    private static func escapeCell(_ value: String) -> String {
        value.replacingOccurrences(of: "|", with: "\\|")
    }
}
