import AppKit

let delegate = AppDelegate()
let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
