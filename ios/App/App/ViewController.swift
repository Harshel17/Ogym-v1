import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        clearWebViewCache()
    }

    private func clearWebViewCache() {
        let dataTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeOfflineWebApplicationCache
        ]
        WKWebsiteDataStore.default().removeData(
            ofTypes: dataTypes,
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) {
            print("OGym: WebView cache cleared")
        }
    }
}
