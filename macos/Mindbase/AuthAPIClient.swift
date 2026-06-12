import Foundation

enum AuthAPIError: LocalizedError {
    case notConfigured
    case badStatus(Int)
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Auth API URL is not configured"
        case .badStatus(let c): return "Auth API returned HTTP \(c)"
        case .decodeFailed: return "Failed to decode auth API response"
        }
    }
}

/// Remote auth/connectors API — used for OAuth and connector sync only (not vault content).
actor AuthAPIClient {
    static let baseURLKey = "authAPIBaseURL"

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    static var configuredBaseURL: URL? {
        guard let raw = UserDefaults.standard.string(forKey: baseURLKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty,
              let url = URL(string: raw) else { return nil }
        return url
    }

    private func url(_ path: String) throws -> URL {
        guard let base = Self.configuredBaseURL else { throw AuthAPIError.notConfigured }
        return base.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    func syncConnectors() async throws -> String {
        let endpoint = try url("/api/connectors/sync")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AuthAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }

    func pushCredentials(_ fields: [String: String]) async throws -> ConnectorCredentialsView {
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
        guard let url = URL(string: resp.auth_url) else { throw AuthAPIError.decodeFailed }
        return url
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let endpoint = try url(path)
        let (data, response) = try await session.data(from: endpoint)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AuthAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let endpoint = try url(path)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AuthAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
