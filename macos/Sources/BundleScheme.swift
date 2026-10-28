import Foundation
import WebKit

final class BundleScheme: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let file = NativePolicy.resource(for: url, root: root),
              let data = try? Data(contentsOf: file), data.count <= 12_000_000 else {
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }
        let types = [
            "html":"text/html", "js":"text/javascript", "css":"text/css",
            "json":"application/json", "webmanifest":"application/manifest+json",
            "svg":"image/svg+xml", "png":"image/png", "webp":"image/webp",
            "woff2":"font/woff2", "ttf":"font/ttf", "txt":"text/plain", "md":"text/plain"
        ]
        let mime = types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count,
                                   textEncodingName: mime.hasPrefix("text/") ? "utf-8" : nil)
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
