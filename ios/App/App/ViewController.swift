import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    
    // Same color as AppDelegate - #0b1220
    private let safeAreaColor = UIColor(red: 11/255, green: 18/255, blue: 32/255, alpha: 1.0)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Set view background immediately
        view.backgroundColor = safeAreaColor
        
        // Configure WebView after it's loaded
        configureWebViewBackground()
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
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Re-apply on layout changes
        configureWebViewBackground()
    }
    
    private func configureWebViewBackground() {
        // Find and configure the WKWebView
        for subview in view.subviews {
            if let webView = subview as? WKWebView {
                // OPAQUE WebView with dark background - not transparent
                webView.isOpaque = true
                webView.backgroundColor = safeAreaColor
                webView.scrollView.backgroundColor = safeAreaColor
                webView.scrollView.contentInsetAdjustmentBehavior = .never
            } else {
                subview.backgroundColor = safeAreaColor
            }
        }
    }
}
