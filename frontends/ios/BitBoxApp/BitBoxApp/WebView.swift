//
//  WebView.swift
//  BitBoxApp
//
//  Created by dev on 05.12.23.
//

import SwiftUI
import WebKit
import Mobileserver

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

struct WebView: UIViewRepresentable {
    let url: URL
    let setHandlers: SetMessageHandlersProtocol
    
    func makeUIView(context: Context) -> some WKWebView {
        let contentController = WKUserContentController()
        let bridge = JavascriptBridge()
        contentController.add(bridge, name: "goCall")
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        
        // TODO: check if official - needed to allow loading the bundle with <script type="module" src="...">
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        let webView = WKWebView(frame: .zero, configuration: config)
       
        setHandlers.setMessageHandlers(handlers: MessageHandlers(webView: webView))
        let source = """
        window.runningOnIOS = true;
        """
        let userScript = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(userScript)
         
        return webView
    }
    
    func updateUIView(_ uiView: UIViewType, context: Context) {
        uiView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
}
