import Foundation

enum APIError: LocalizedError {
    case notRunning
    case badStatus(Int)
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .notRunning: return "Go core is not running"
        case .badStatus(let c): return "Server returned HTTP \(c)"
        case .decodeFailed: return "Failed to decode server response"
        }
    }
}

actor APIClient {
    private let session: URLSession
    private var baseURL: URL?

    init(session: URLSession = .shared) {
        self.session = session
    }

    func setBaseURL(_ url: URL) {
        baseURL = url
    }

    private func url(_ path: String) throws -> URL {
        guard let baseURL else { throw APIError.notRunning }
        return baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    func vault() async throws -> VaultInfo {
        try await get("/api/vault")
    }

    func listNotes() async throws -> [NoteEntry] {
        try await get("/api/notes/")
    }

    func getNote(_ path: String) async throws -> Note {
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        return try await get("/api/notes/\(encoded)")
    }

    func saveNote(_ path: String, content: String) async throws -> Note {
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        struct Body: Encodable { let content: String }
        return try await put("/api/notes/\(encoded)", body: Body(content: content))
    }

    func listDatabases() async throws -> [DatabaseEntry] {
        try await get("/api/databases/")
    }

    func getDatabase(_ name: String) async throws -> DatabaseTable {
        try await get("/api/databases/\(name)")
    }

    func saveDatabase(_ name: String, headers: [String], rows: [[String]]) async throws -> DatabaseTable {
        struct Body: Encodable {
            let headers: [String]
            let rows: [[String]]
        }
        return try await put("/api/databases/\(name)", body: Body(headers: headers, rows: rows))
    }

    func search(_ query: String) async throws -> [SearchResult] {
        guard !query.isEmpty else { return [] }
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name: "q", value: query)]
        let q = components.percentEncodedQuery.map { "?\($0)" } ?? ""
        return try await get("/api/search\(q)")
    }

    func previewHTML(for path: String) async throws -> String {
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        let url = try url("/preview/\(encoded)")
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }

    func syncConnectors() async throws -> String {
        let url = try url("/api/connectors/sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }

    func getCredentials() async throws -> ConnectorCredentialsView {
        try await get("/api/connectors/credentials")
    }

    func updateCredentials(_ fields: [String: String]) async throws -> ConnectorCredentialsView {
        try await put("/api/connectors/credentials", body: fields)
    }

    func gdriveOAuthURL() async throws -> URL {
        try await oauthStartURL("/api/connectors/gdrive/oauth/start", redirectPath: "/api/connectors/gdrive/oauth/callback")
    }

    func notionOAuthURL() async throws -> URL {
        try await oauthStartURL("/api/connectors/notion/oauth/start", redirectPath: "/api/connectors/notion/oauth/callback")
    }

    private func oauthStartURL(_ path: String, redirectPath: String) async throws -> URL {
        let redirect = try url(redirectPath).absoluteString
        let encoded = redirect.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirect
        struct Resp: Decodable { let auth_url: String }
        let resp: Resp = try await get("\(path)?redirect_uri=\(encoded)")
        guard let url = URL(string: resp.auth_url) else { throw APIError.decodeFailed }
        return url
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = try url(path)
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw APIError.badStatus(-1) }
        guard (200..<300).contains(http.statusCode) else { throw APIError.badStatus(http.statusCode) }
        if data.count == 4, String(data: data, encoding: .utf8) == "null" {
            if let empty = EmptyArrayFallback.emptyArray(for: T.self) as? T {
                return empty
            }
        }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom(decodeDate)
            return try decoder.decode(T.self, from: data)
        } catch {
            // #region agent log
            DebugLog.write(location: "APIClient.swift:get", message: "decode failed", hypothesisId: "H4", data: [
                "path": path,
                "body": String(data: data.prefix(200), encoding: .utf8) ?? "",
                "error": error.localizedDescription,
            ])
            // #endregion
            throw APIError.decodeFailed
        }
    }

    private func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let url = try url(path)
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.badStatus(-1) }
        guard (200..<300).contains(http.statusCode) else { throw APIError.badStatus(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom(decodeDate)
        return try decoder.decode(T.self, from: data)
    }

    private func decodeDate(_ decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let str = try container.decode(String.self)
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fmt.date(from: str) { return d }
        fmt.formatOptions = [.withInternetDateTime]
        if let d = fmt.date(from: str) { return d }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZZZZ"
        if let d = df.date(from: str) { return d }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(str)")
    }
}

private enum EmptyArrayFallback {
    static func emptyArray(for type: Any.Type) -> Any? {
        switch type {
        case is [NoteEntry].Type: return [NoteEntry]()
        case is [DatabaseEntry].Type: return [DatabaseEntry]()
        case is [SearchResult].Type: return [SearchResult]()
        default: return nil
        }
    }
}
