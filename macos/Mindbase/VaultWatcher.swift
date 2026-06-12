import CoreServices
import Foundation

final class VaultWatcher {
    private var stream: FSEventStreamRef?
    private let callback: () -> Void

    init(onChange: @escaping () -> Void) {
        self.callback = onChange
    }

    deinit {
        stop()
    }

    func start(watching root: URL) {
        stop()
        var context = FSEventStreamContext(
            version: 0,
            info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil,
            release: nil,
            copyDescription: nil
        )
        let flags = FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents)
        let latency: CFTimeInterval = 0.3
        stream = FSEventStreamCreate(
            nil,
            { _, info, _, _, _, _ in
                guard let info else { return }
                let watcher = Unmanaged<VaultWatcher>.fromOpaque(info).takeUnretainedValue()
                DispatchQueue.main.async { watcher.callback() }
            },
            &context,
            [root.path] as CFArray,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            latency,
            flags
        )
        if let stream {
            FSEventStreamSetDispatchQueue(stream, DispatchQueue.main)
            FSEventStreamStart(stream)
        }
    }

    func stop() {
        if let stream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            self.stream = nil
        }
    }
}
