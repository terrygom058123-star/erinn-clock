import AppKit
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    // 미니 시계 (항상 위)
    var miniWindow: NSPanel?
    var miniLabel: NSTextField?
    var miniPeriod: NSTextField?

    // 네이티브 알람 엔진 상태
    var offsetSec: Int = 0
    var alarms: [[String: Any]] = []   // {id, label, h, m}
    var tasks:  [[String: Any]] = []   // {id, label, endAt(ms)}
    var lastFired: [String: TimeInterval] = [:]
    var engineTimer: Timer?
    var activityToken: NSObjectProtocol?   // App Nap 방지

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()

        // App Nap / 타이머 throttling 방지 (창 가려도 알람 동작)
        activityToken = ProcessInfo.processInfo.beginActivity(
            options: [.userInitiated, .idleSystemSleepDisabled],
            reason: "에린 알람 백그라운드 감시"
        )

        let rect = NSRect(x: 0, y: 0, width: 420, height: 800)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "마비노기 에린시계"
        window.minSize = NSSize(width: 380, height: 640)
        window.center()

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "alarm")
        config.userContentController.add(self, name: "playSound")
        config.userContentController.add(self, name: "sync")           // 알람/작업 목록 동기화
        config.userContentController.add(self, name: "toggleMiniClock") // 미니 시계 토글

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]

        if let htmlURL = Bundle.module.url(forResource: "index", withExtension: "html") {
            let resourceURL = htmlURL.deletingLastPathComponent()
            webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
        }

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // 1초마다 알람/작업 감시 (모달 중에도 동작하도록 .common 모드)
        let t = Timer(timeInterval: 1.0, target: self, selector: #selector(engineTick), userInfo: nil, repeats: true)
        RunLoop.main.add(t, forMode: .common)
        engineTimer = t
    }

    func setupMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        menu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(NSMenuItem(
            title: "마비노기 에린시계 종료",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))
        NSApp.mainMenu = menu
    }

    // ─── 에린 시간 계산 (renderer.js와 동일 공식) ───
    func erinnTime() -> (h: Int, m: Int, s: Int) {
        let now = Int(Date().timeIntervalSince1970) - 7 + offsetSec
        let sec = ((now % 2160) + 2160) % 2160
        let h = sec / 90
        let m = Int(Double(sec % 90) / 1.5)
        let s = Int(Double(sec % 90).truncatingRemainder(dividingBy: 1.5) / (1.5 / 60.0))
        return (h, m, s)
    }

    func erinnDisplay(_ h: Int, _ m: Int) -> (period: String, time: String) {
        let period = h < 12 ? "오전" : "오후"
        let hh = h % 12 == 0 ? 12 : h % 12
        return (period, String(format: "%02d:%02d", hh, m))
    }

    // ─── 매 초 감시 ───
    @objc func engineTick() {
        let et = erinnTime()
        let nowMs = Date().timeIntervalSince1970 * 1000

        // 알람 (에린 시:분 일치)
        for a in alarms {
            guard let id = a["id"] as? String,
                  let h = a["h"] as? Int, let m = a["m"] as? Int else { continue }
            if et.h == h && et.m == m {
                if nowMs - (lastFired[id] ?? 0) < 90_000 { continue }  // 에린 1분 = 90초 중복 방지
                lastFired[id] = nowMs
                let label = a["label"] as? String ?? "에린 알람"
                let disp = erinnDisplay(h, m)
                fireAlarm(label: label, sub: "에린 \(disp.period) \(disp.time)")
            }
        }

        // 작업 타이머 (마감 시각 도달)
        for t in tasks {
            guard let id = t["id"] as? String,
                  let endAt = t["endAt"] as? Double else { continue }
            if nowMs >= endAt {
                if (lastFired["task_" + id] ?? 0) > 0 { continue }  // 1회만
                lastFired["task_" + id] = nowMs
                let label = t["label"] as? String ?? "작업"
                fireAlarm(label: label, sub: "작업 완료! 🎉")
            }
        }

        // 미니 시계 갱신
        if miniWindow != nil {
            let disp = erinnDisplay(et.h, et.m)
            miniPeriod?.stringValue = disp.period
            miniLabel?.stringValue = disp.time
        }
    }

    func fireAlarm(label: String, sub: String) {
        playSound()
        let alert = NSAlert()
        alert.messageText = "⏰  \(label)"
        alert.informativeText = "\(sub)\n\n확인을 눌러 끄세요."
        alert.alertStyle = .critical
        alert.addButton(withTitle: "확인")
        NSApp.activate(ignoringOtherApps: true)
        alert.window.level = .floating
        alert.runModal()
    }

    // JavaScript → Swift 메시지 수신
    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        switch message.name {
        case "alarm":
            guard let body = message.body as? [String: String] else { return }
            let label  = body["label"]  ?? "에린 알람"
            let period = body["period"] ?? ""
            let time   = body["time"]   ?? ""
            DispatchQueue.main.async { self.fireAlarm(label: label, sub: "에린 \(period) \(time)") }
        case "playSound":
            DispatchQueue.main.async { self.playSound() }
        case "sync":
            if let body = message.body as? [String: Any] {
                offsetSec = body["offsetSec"] as? Int ?? 0
                alarms = body["alarms"] as? [[String: Any]] ?? []
                let newTasks = body["tasks"] as? [[String: Any]] ?? []
                // 사라진 작업의 발동 기록 정리 (재시작 시 다시 울리도록)
                let ids = Set(newTasks.compactMap { $0["id"] as? String })
                for key in lastFired.keys where key.hasPrefix("task_") {
                    if !ids.contains(String(key.dropFirst(5))) { lastFired[key] = nil }
                }
                tasks = newTasks
            }
        case "toggleMiniClock":
            DispatchQueue.main.async { self.toggleMiniClock() }
        default: break
        }
    }

    // ─── 미니 시계 (모든 앱 위 항상 표시) ───
    func toggleMiniClock() {
        if let w = miniWindow {
            w.close()
            miniWindow = nil
            miniLabel = nil
            miniPeriod = nil
            return
        }

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 180, height: 84),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.backgroundColor = .clear
        panel.hasShadow = true

        let container = NSView(frame: panel.contentView!.bounds)
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.16, alpha: 0.94).cgColor
        container.layer?.cornerRadius = 16
        container.autoresizingMask = [.width, .height]

        let period = NSTextField(labelWithString: "오후")
        period.font = .systemFont(ofSize: 13, weight: .regular)
        period.textColor = NSColor(white: 0.7, alpha: 1)
        period.frame = NSRect(x: 0, y: 56, width: 180, height: 18)
        period.alignment = .center
        period.backgroundColor = .clear
        period.isBezeled = false
        period.isEditable = false

        let time = NSTextField(labelWithString: "--:--")
        time.font = .monospacedDigitSystemFont(ofSize: 38, weight: .thin)
        time.textColor = .white
        time.frame = NSRect(x: 0, y: 8, width: 180, height: 46)
        time.alignment = .center
        time.backgroundColor = .clear
        time.isBezeled = false
        time.isEditable = false

        container.addSubview(period)
        container.addSubview(time)
        panel.contentView?.addSubview(container)

        // 우측 상단에 배치
        if let screen = NSScreen.main {
            let vf = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: vf.maxX - 200, y: vf.maxY - 104))
        }
        panel.orderFrontRegardless()

        miniWindow = panel
        miniLabel = time
        miniPeriod = period
        engineTick()  // 즉시 1회 갱신
    }

    func playSound() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
        task.arguments = ["/System/Library/Sounds/Glass.aiff"]
        try? task.run()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // 미니 시계가 떠 있으면 종료하지 않음
        return miniWindow == nil
    }
}
