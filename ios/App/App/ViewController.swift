import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    
    // Bulletproof dark color - matches #0b1220
    private let safeAreaColor = UIColor(red: 11/255, green: 18/255, blue: 32/255, alpha: 1.0)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Set view background immediately
        view.backgroundColor = safeAreaColor
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        view.backgroundColor = safeAreaColor
        configureWebViewBackground()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        view.backgroundColor = safeAreaColor
        configureWebViewBackground()
        
        // Delayed application to catch async WKWebView attachment
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.configureWebViewBackground()
        }
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        configureWebViewBackground()
    }
    
    private func configureWebViewBackground() {
        // Recursively find WKWebView in entire view hierarchy
        if let webView = findWKWebView(in: view) {
            webView.isOpaque = true
            webView.backgroundColor = safeAreaColor
            webView.scrollView.backgroundColor = safeAreaColor
        }
    }
    
    /// Recursively searches the view hierarchy for WKWebView
    private func findWKWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView {
            return webView
        }
        
        for subview in view.subviews {
            if let found = findWKWebView(in: subview) {
                return found
            }
        }
        
        return nil
    }
}
