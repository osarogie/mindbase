import Foundation

final class GoCoreService {
    private var process: Process?
    private let portFile: URL

    init() {
        portFile = FileManager.default.temporaryDirectory
            .appendingPathComponent("mindbase-\(UUID().uuidString).port")
    }

    deinit {
        stop()
    }

    func start(vaultPath: String) async throws -> URL {
        stop()
        try? FileManager.default.removeItem(at: portFile)

        guard let binary = Self.locateBinary() else {
            throw GoCoreError.binaryNotFound
        }

        let proc = Process()
        proc.executableURL = binary
        proc.arguments = [
            "-vault", vaultPath,
            "-addr", "127.0.0.1:0",
            "-portfile", portFile.path,
            "-embed",
        ]
        var env = Self.loadEnvFiles(vaultPath: vaultPath)
        env["MINDBASE_VAULT"] = vaultPath
        proc.environment = env

        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = pipe

        try proc.run()
        process = proc

        let addr = try await waitForPort(timeout: 10)
        guard let url = URL(string: "http://\(addr)") else {
            throw GoCoreError.invalidAddress(addr)
        }
        return url
    }

    func stop() {
        process?.terminate()
        process = nil
        try? FileManager.default.removeItem(at: portFile)
    }

    private func waitForPort(timeout: TimeInterval) async throws -> String {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let data = try? Data(contentsOf: portFile),
               let addr = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
               !addr.isEmpty {
                return addr
            }
            if process?.isRunning == false {
                throw GoCoreError.processExited
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        throw GoCoreError.portTimeout
    }

    private static func locateBinary() -> URL? {
        for name in ["mindbase", "ubase"] {
            if let bundled = Bundle.main.url(forResource: name, withExtension: nil),
               FileManager.default.isExecutableFile(atPath: bundled.path) {
                return bundled
            }
        }
        let candidates = [
            "../bin/mindbase",
            "../../bin/mindbase",
            "../../../bin/mindbase",
            "../bin/ubase",
            "../../bin/ubase",
        ]
        for rel in candidates {
            let url = URL(fileURLWithPath: rel, relativeTo: Bundle.main.bundleURL).standardizedFileURL
            if FileManager.default.isExecutableFile(atPath: url.path) {
                return url
            }
        }
        let devPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("bin/mindbase")
        if FileManager.default.isExecutableFile(atPath: devPath.path) {
            return devPath
        }
        return nil
    }

    private static func loadEnvFiles(vaultPath: String) -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        let paths = [
            "\(vaultPath)/.mindbase/env",
            NSHomeDirectory() + "/.mindbase/env",
        ]
        for path in paths {
            guard let content = try? String(contentsOfFile: path, encoding: .utf8) else { continue }
            for line in content.split(separator: "\n") {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
                let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                let key = parts[0].trimmingCharacters(in: .whitespaces)
                var value = parts[1].trimmingCharacters(in: .whitespaces)
                if (value.hasPrefix("\"") && value.hasSuffix("\"")) || (value.hasPrefix("'") && value.hasSuffix("'")) {
                    value = String(value.dropFirst().dropLast())
                }
                if env[key] == nil {
                    env[key] = value
                }
            }
        }
        return env
    }
}

enum GoCoreError: LocalizedError {
    case binaryNotFound
    case portTimeout
    case processExited
    case invalidAddress(String)

    var errorDescription: String? {
        switch self {
        case .binaryNotFound: return "mindbase Go binary not found in app bundle"
        case .portTimeout: return "Timed out waiting for Go core to start"
        case .processExited: return "Go core process exited unexpectedly"
        case .invalidAddress(let a): return "Invalid listen address: \(a)"
        }
    }
}
