import AppKit
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    // 미니 시계 (항상 위)
    var miniWindow: NSPanel?
    var miniLabel: NSTextField?
    var miniPeriod: NSTextField?
    var miniTasks: NSTextField?
    var miniStack: NSStackView?

    // 네이티브 알람 엔진 상태
    var offsetSec: Int = 0
    var alarms: [[String: Any]] = []   // {id, label, h, m}
    var tasks:  [[String: Any]] = []   // {id, label, endAt(ms)}
    var lastFired: [String: TimeInterval] = [:]
    var engineTimer: Timer?
    var activityToken: NSObjectProtocol?   // App Nap 방지

    // 알람 발동 상태 (팝업 대신 미니 시계 깜빡임)
    var alarmActive = false
    var alarmText = ""   // 알람 이름
    var alarmSub  = ""   // 에린 시각 / "작업 완료"
    var flashTimer: Timer?
    var flashOn = false
    var flashTicks = 0

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
            if alarmActive {
                // 알람 모드: 어떤 알람인지(이름+시각) 표시 + 깜빡임
                miniPeriod?.stringValue = "⏰ \(alarmText)"       // 알람 이름
                miniLabel?.font = .systemFont(ofSize: 20, weight: .bold)
                miniLabel?.stringValue = alarmSub                 // 에린 시각 / 작업 완료
                miniTasks?.isHidden = false
                miniTasks?.textColor = .white
                miniTasks?.stringValue = "👆 눌러서 끄기"
            } else {
                let disp = erinnDisplay(et.h, et.m)
                miniPeriod?.stringValue = disp.period
                miniLabel?.font = .monospacedDigitSystemFont(ofSize: 36, weight: .thin)
                miniLabel?.stringValue = disp.time

                var lines: [String] = []
                for t in tasks {
                    guard let endAt = t["endAt"] as? Double else { continue }
                    let icon = t["icon"] as? String ?? "⚒️"
                    let name = t["shortName"] as? String ?? (t["label"] as? String ?? "작업")
                    let remSec = Int(max(0, (endAt - nowMs) / 1000))
                    let mmss = remSec <= 0 ? "완료!" : String(format: "%02d:%02d", remSec / 60, remSec % 60)
                    lines.append("\(icon) \(name)  \(mmss)")
                }
                let txt = lines.joined(separator: "\n")
                if let tasksField = miniTasks {
                    tasksField.textColor = NSColor(calibratedRed: 0.52, green: 0.80, blue: 0.45, alpha: 1)
                    tasksField.stringValue = txt
                    tasksField.isHidden = txt.isEmpty
                }
            }
            resizeMiniToFit()
        }
    }

    func resizeMiniToFit() {
        guard let panel = miniWindow, let stack = miniStack else { return }
        stack.layoutSubtreeIfNeeded()
        let fit = stack.fittingSize
        let w: CGFloat = 200
        let h = max(80, fit.height)
        if abs(panel.frame.height - h) < 1 { return }   // 변화 없으면 스킵
        let top = panel.frame.maxY
        panel.setFrame(NSRect(x: panel.frame.minX, y: top - h, width: w, height: h), display: true)
    }

    // 알람 발동: 팝업 대신 미니 시계를 빨갛게 깜빡이며 알림
    func fireAlarm(label: String, sub: String) {
        alarmActive = true
        alarmText = label
        alarmSub = sub
        playSound()

        // 미니 시계가 꺼져 있으면 자동으로 띄움 (항상 보이도록)
        if miniWindow == nil { showMiniWindow() }

        // 깜빡임 시작
        flashTimer?.invalidate()
        flashTicks = 0
        let ft = Timer(timeInterval: 0.5, target: self, selector: #selector(flashTick), userInfo: nil, repeats: true)
        RunLoop.main.add(ft, forMode: .common)
        flashTimer = ft
        flashTick()
        engineTick()
    }

    @objc func flashTick() {
        flashOn.toggle()
        flashTicks += 1
        if let bg = miniWindow?.contentView {
            bg.layer?.backgroundColor = flashOn
                ? NSColor(calibratedRed: 0.86, green: 0.15, blue: 0.15, alpha: 0.97).cgColor   // 빨강
                : NSColor(calibratedRed: 0.55, green: 0.05, blue: 0.05, alpha: 0.97).cgColor   // 어두운 빨강
        }
        // 6틱(3초)마다 소리 재생 (끌 때까지)
        if flashTicks % 6 == 0 { playSound() }
    }

    func dismissNativeAlarm() {
        if !alarmActive { return }
        alarmActive = false
        flashTimer?.invalidate(); flashTimer = nil
        flashOn = false
        // 배경 원래색 복귀
        miniWindow?.contentView?.layer?.backgroundColor =
            NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.16, alpha: 0.94).cgColor
        engineTick()
    }

    @objc func miniClicked() {
        if alarmActive { dismissNativeAlarm() }
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
        if miniWindow != nil {
            dismissNativeAlarm()
            miniWindow?.close()
            miniWindow = nil
            miniLabel = nil
            miniPeriod = nil
            miniTasks = nil
            miniStack = nil
            return
        }
        showMiniWindow()
    }

    func showMiniWindow() {
        if miniWindow != nil { return }

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 200, height: 90),
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

        let bg = NSView()
        bg.wantsLayer = true
        bg.layer?.backgroundColor = NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.16, alpha: 0.94).cgColor
        bg.layer?.cornerRadius = 16
        panel.contentView = bg

        // 클릭 시 알람 끄기
        let click = NSClickGestureRecognizer(target: self, action: #selector(miniClicked))
        bg.addGestureRecognizer(click)

        let period = NSTextField(labelWithString: "오후")
        period.font = .systemFont(ofSize: 13, weight: .regular)
        period.textColor = NSColor(white: 0.7, alpha: 1)
        period.alignment = .center
        period.isBezeled = false; period.isEditable = false; period.backgroundColor = .clear

        let time = NSTextField(labelWithString: "--:--")
        time.font = .monospacedDigitSystemFont(ofSize: 36, weight: .thin)
        time.textColor = .white
        time.alignment = .center
        time.isBezeled = false; time.isEditable = false; time.backgroundColor = .clear

        let tasksField = NSTextField(labelWithString: "")
        tasksField.font = .monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        tasksField.textColor = NSColor(calibratedRed: 0.52, green: 0.80, blue: 0.45, alpha: 1)
        tasksField.alignment = .center
        tasksField.isBezeled = false; tasksField.isEditable = false; tasksField.backgroundColor = .clear
        tasksField.maximumNumberOfLines = 0
        tasksField.lineBreakMode = .byWordWrapping
        tasksField.isHidden = true

        let stack = NSStackView(views: [period, time, tasksField])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 3
        stack.edgeInsets = NSEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        stack.translatesAutoresizingMaskIntoConstraints = false
        bg.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: bg.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: bg.trailingAnchor),
            stack.topAnchor.constraint(equalTo: bg.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bg.bottomAnchor),
        ])

        // 우측 상단에 배치
        if let screen = NSScreen.main {
            let vf = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: vf.maxX - 220, y: vf.maxY - 110))
        }
        panel.orderFrontRegardless()

        miniWindow = panel
        miniLabel = time
        miniPeriod = period
        miniTasks = tasksField
        miniStack = stack
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
