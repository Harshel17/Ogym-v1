import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    
    // Bulletproof dark color for safe areas - matches #0b1220
    static let safeAreaColor = UIColor(red: 11/255, green: 18/255, blue: 32/255, alpha: 1.0)

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Set background colors at multiple points to ensure coverage
        applyBulletproofBackground()
        
        // Delayed applications to catch late-loading views
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.applyBulletproofBackground()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.applyBulletproofBackground()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.applyBulletproofBackground()
        }
        
        return true
    }
    
    private func applyBulletproofBackground() {
        let bgColor = AppDelegate.safeAreaColor
        
        // 1. Set window background
        window?.backgroundColor = bgColor
        
        // 2. Set root view controller background
        if let rootVC = window?.rootViewController {
            rootVC.view.backgroundColor = bgColor
            
            // 3. Configure WebView as OPAQUE with dark color (not transparent)
            configureOpaqueWebView(in: rootVC.view, color: bgColor)
        }
        
        // 4. Handle iOS 13+ scenes
        if #available(iOS 13.0, *) {
            for scene in UIApplication.shared.connectedScenes {
                if let windowScene = scene as? UIWindowScene {
                    for sceneWindow in windowScene.windows {
                        sceneWindow.backgroundColor = bgColor
                        if let rootVC = sceneWindow.rootViewController {
                            rootVC.view.backgroundColor = bgColor
                            configureOpaqueWebView(in: rootVC.view, color: bgColor)
                        }
                    }
                }
            }
        }
    }
    
    private func configureOpaqueWebView(in view: UIView, color: UIColor) {
        // Set background on all views in hierarchy
        view.backgroundColor = color
        
        for subview in view.subviews {
            if let webView = subview as? WKWebView {
                // OPAQUE WebView painted with dark color - NOT transparent
                webView.isOpaque = true
                webView.backgroundColor = color
                webView.scrollView.backgroundColor = color
            } else {
                // Paint all intermediate views
                subview.backgroundColor = color
                configureOpaqueWebView(in: subview, color: color)
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Re-apply on foreground in case of any state changes
        applyBulletproofBackground()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-apply when app becomes active
        applyBulletproofBackground()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
