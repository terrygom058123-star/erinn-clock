import AppKit
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()

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

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]

        if let htmlURL = Bundle.module.url(forResource: "index", withExtension: "html") {
            let resourceURL = htmlURL.deletingLastPathComponent()
            webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
        }

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
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

    // JavaScript → Swift 메시지 수신
    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        if message.name == "alarm" {
            guard let body = message.body as? [String: String] else { return }
            let label  = body["label"]  ?? "에린 알람"
            let period = body["period"] ?? ""
            let time   = body["time"]   ?? ""
            DispatchQueue.main.async { self.showAlert(label: label, period: period, time: time) }
        } else if message.name == "playSound" {
            DispatchQueue.main.async { self.playSound() }
        }
    }

    // 맥OS 최상위 시스템 경고창 (모든 앱 위에 표시)
    func showAlert(label: String, period: String, time: String) {
        let alert = NSAlert()
        alert.messageText = "⏰  \(label)"
        alert.informativeText = "에린 \(period) \(time)\n\n확인을 눌러 끄세요."
        alert.alertStyle = .critical
        alert.addButton(withTitle: "확인")
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    func playSound() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
        task.arguments = ["/System/Library/Sounds/Glass.aiff"]
        try? task.run()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
