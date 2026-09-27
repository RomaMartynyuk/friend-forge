import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift frames-to-gif.swift FRAME_DIRECTORY OUTPUT.gif\n", stderr)
    exit(2)
}

let source = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let frames = try FileManager.default.contentsOfDirectory(at: source, includingPropertiesForKeys: nil)
    .filter { $0.lastPathComponent.hasPrefix("frame-") && $0.pathExtension == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !frames.isEmpty else { fatalError("No PNG frames found") }
guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, frames.count, nil) else {
    fatalError("Could not create GIF")
}
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for frame in frames {
    guard let imageSource = CGImageSourceCreateWithURL(frame as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        fatalError("Could not read \(frame.path)")
    }
    let settings = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 0.12]] as CFDictionary
    CGImageDestinationAddImage(destination, image, settings)
}
guard CGImageDestinationFinalize(destination) else { fatalError("GIF encoding failed") }
print("Wrote \(output.path) from \(frames.count) mock-wallet frames")
