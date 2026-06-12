import Foundation

enum Journal {
    static let notesDir = "journal"

    static func dailyPath(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return "\(notesDir)/\(f.string(from: date)).md"
    }

    static func weeklyPath(_ date: Date = Date()) -> String {
        let cal = Calendar(identifier: .iso8601)
        let week = cal.component(.weekOfYear, from: date)
        let year = cal.component(.yearForWeekOfYear, from: date)
        return String(format: "\(notesDir)/%d-W%02d.md", year, week)
    }

    static func dailyTemplate(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMMM d, yyyy"
        return """
        # \(f.string(from: date))

        ## Focus
        - 

        ## Tasks
        - [ ] 

        ## Notes

        """
    }

    static func navDates(for date: Date) -> (prev: String, next: String) {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let cal = Calendar.current
        let prev = cal.date(byAdding: .day, value: -1, to: date)!
        let next = cal.date(byAdding: .day, value: 1, to: date)!
        return (f.string(from: prev), f.string(from: next))
    }
}
