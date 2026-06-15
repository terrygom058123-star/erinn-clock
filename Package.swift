// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ErinnClock",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "ErinnClock",
            path: "Sources",
            resources: [
                .copy("index.html"),
                .copy("renderer.js"),
                .copy("style.css"),
            ]
        )
    ]
)
