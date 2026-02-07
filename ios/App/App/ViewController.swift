import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController, WKNavigationDelegate {

    override func viewDidLoad() {
        super.viewDidLoad()
        bridge?.webView?.navigationDelegate = self
        bridge?.webView?.allowsBackForwardNavigationGestures = true
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        NSLog("OGym: WebView started loading: \(webView.url?.absoluteString ?? "nil")")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSLog("OGym: WebView finished loading: \(webView.url?.absoluteString ?? "nil")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("OGym: Navigation failed: \(error.localizedDescription)")
        showError("Navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("OGym: Provisional navigation failed: \(error.localizedDescription)")
        showError("Could not load page: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(.allow)
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "OGym Loading Error", message: message + "\n\nTap Retry to try again.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in
                if let url = URL(string: "https://app.ogym.fitness") {
                    self.bridge?.webView?.load(URLRequest(url: url))
                }
            })
            if self.isViewLoaded && self.view.window != nil {
                self.present(alert, animated: true)
            }
        }
    }
}
