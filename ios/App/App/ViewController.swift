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
        
        // Set window background for edge-to-edge coverage
        if let window = view.window {
            window.backgroundColor = safeAreaColor
        }
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        view.backgroundColor = safeAreaColor
        view.window?.backgroundColor = safeAreaColor
        configureWebViewBackground()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("✅ Custom ViewController loaded and active")
        view.backgroundColor = safeAreaColor
        view.window?.backgroundColor = safeAreaColor
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
            // Set to non-opaque with clear background so native dark shows through
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear
            
            // Disable rubber-band bounce to prevent white flash
            webView.scrollView.bounces = false
            webView.scrollView.alwaysBounceVertical = false
            webView.scrollView.alwaysBounceHorizontal = false
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
