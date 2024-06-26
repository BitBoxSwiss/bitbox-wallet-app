//
//  WebView.swift
//  BitBoxApp
//
//  Created by dev on 05.12.23.
//

import SwiftUI
import WebKit
import Mobileserver

// We setup a custom scheme qrc:/... to load web resources from our local bundle.
// This serves two purposes:
// - the React router is the BrowserRouter, so if we loaded index.html as a file, routing 
//   to e.g. /accounts-summary would try to load this file as an absolute path.
//   Using the custom scheme, the base will always be qrc:/, so it would route to qrc:/accounts-summary,
//   which works with the BrowserRouter. If we used the HashRouter, it would work with a custom scheme or by
//   loading it as a file.
// - MoonPay expects the Origin of the request to be either "qrc:" or "https://shiftcrypto.ch".
//   "qrc:" originally comes from the Qt frontend where local resources can be loaded using this scheme,
//   and MoonPay whitelisted this Origin.
//   The Origin header to allow Moonpay to load in the iframe. Moonpay compares the origin against a list
//   of origins configured in the Moonpay admin.
//   This is a security feature relevant for websites running in browsers, but in the case of the
//   BitBoxApp, it is useless, as any app can do this.
//
//   Unfortunately there seems to be no simple way to include this header only in requests to Moonpay.
//
//   We choose 'qrc' over 'https://shiftcrypto.ch' as the origin/base because WebView let's us easily register
//   a custom scheme handler, while intercepting general requests is more difficult. Also, while we use
//   the BrowserRouter, we cannot use a custom base name, as the BrowserRouter is not compatible with
//   loading index.html as a file/string (see above), which is the only way in which one can set a base
//   (`loadHTMLString(_:baseURL:)`). Also, using https://shiftcrypto.ch as the base would be strange
//   in any case.
let scheme = "qrc"

class JavascriptBridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "goCall", let body = message.body as? [String: AnyObject] {
            let queryID = body["queryID"] as! Int
            let query = body["query"] as! String
            MobileserverBackendCall(queryID, query)
        }
    }
}

struct MessageHandlers: MessageHandlersProtocol {
    let webView: WKWebView
    
    func callResponseHandler(queryID: Int, response: String) {
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.onMobileCallResponse(\(queryID), \(response));")
        }
    }
    
    func pushNotificationHandler(msg: String) {
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.onMobilePushNotification && window.onMobilePushNotification(\(msg));")
        }
    }
}

class CustomSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let url = urlSchemeTask.request.url!
        // Replace qrc:/foo.html with assets/web/foo.html.
        let localPath = "assets/web/" + removingPrefix(url.absoluteString, scheme + ":/")
        if let filePath = Bundle.main.path(forResource: localPath, ofType: ""),
           let fileData = try? Data(contentsOf: URL(fileURLWithPath: filePath)) {
            let mimeType = mimeTypeForPath(path: localPath)
            let response = URLResponse(url: url, mimeType: mimeType, expectedContentLength: fileData.count, textEncodingName: nil)
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(fileData)
            urlSchemeTask.didFinish()
        } else {
            urlSchemeTask.didFailWithError(NSError(domain: "LocalResourceError", code: 404, userInfo: nil))
        }
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    }
    
    private func removingPrefix(_ s: String, _ prefix: String) -> String {
        guard s.hasPrefix(prefix) else { return s }
        return String(s.dropFirst(prefix.count))
    }
    
    private func mimeTypeForPath(path: String) -> String {
        let ext = (path as NSString).pathExtension
        switch ext.lowercased() {
        case "html": return "text/html"
        case "js": return "application/javascript"
        case "css": return "text/css"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        default: return "application/octet-stream"
        }
    }
}

struct WebView: UIViewRepresentable {
    let setHandlers: SetMessageHandlersProtocol
    
    func makeUIView(context: Context) -> some WKWebView {
        let contentController = WKUserContentController()
        let bridge = JavascriptBridge()
        contentController.add(bridge, name: "goCall")
        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        let customSchemeHandler = CustomSchemeHandler()
        config.setURLSchemeHandler(customSchemeHandler, forURLScheme: scheme)

        // Allows third-party cookies. Needed for onramp iframe'd widgets like MoonPay.  
        config.websiteDataStore = WKWebsiteDataStore.default()

        // TODO: check if official - needed to allow loading the bundle with <script type="module" src="...">
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        setHandlers.setMessageHandlers(handlers: MessageHandlers(webView: webView))
        let source = """
        window.runningOnIOS = true;
        """
        let userScript = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(userScript)
         
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        
        return webView
    }
    
    func updateUIView(_ uiView: UIViewType, context: Context) {
        uiView.load(URLRequest(url: URL(string: scheme + ":/index.html")!))
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        // Intercept all URLs
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            print("Loading URL: " + url.absoluteString)
            // TODO: figure out if there are links (not target=_blank which are handled below) that
            // should be intercepted here to be opened in the system browser instead.
            // For now, allow everything.
            decisionHandler(.allow)
        }
        
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Intercept target=_blank link clicks and open them in the system browser.
            // This opens e.g. the cookie policy and other external links in the Moonpay/Pocket widgets, etc.
            if navigationAction.targetFrame == nil || !navigationAction.targetFrame!.isMainFrame {
                if let url = navigationAction.request.url {
                    if UIApplication.shared.canOpenURL(url) {
                        UIApplication.shared.open(url)
                    }
                }
            }
            return nil
        }
    }
}
