import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as CapacitorCamera } from "@capacitor/camera";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    const requestCameraPermission = async (): Promise<boolean> => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permission = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
          console.log("Camera permission result:", permission);
          return permission.camera === 'granted' || permission.camera === 'limited';
        } catch (err) {
          console.error("Capacitor camera permission error:", err);
          return false;
        }
      }
      return true;
    };

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          console.log("Scanner already stopped");
        }
        scannerRef.current = null;
      }
    };

    const startScanner = async () => {
      if (!containerRef.current) return;
      
      try {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          setError("Camera access denied. Please enable camera permission in your device settings.");
          setIsStarting(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        
        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: Capacitor.isNativePlatform() ? 1.0 : 1.777,
          formatsToSupport: [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
          ] as any
        };
        
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (!scannedRef.current) {
              scannedRef.current = true;
              console.log("Barcode scanned:", decodedText);
              onScan(decodedText);
              stopScanner();
            }
          },
          () => {}
        );
        
        setIsStarting(false);
      } catch (err: any) {
        console.error("Scanner error:", err);
        if (err.name === "NotAllowedError" || err.message?.includes("Permission")) {
          setError("Camera access denied. Please allow camera access in your device settings and try again.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else if (err.message?.includes("already running")) {
          await stopScanner();
          setTimeout(() => startScanner(), 500);
          return;
        } else {
          setError(`Could not start camera: ${err.message || "Please try again."}`);
        }
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan]);

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100001] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-medium">Scan Barcode</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          className="text-white hover:bg-white/20"
          data-testid="button-close-scanner"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4" ref={containerRef}>
        {isStarting && !error && (
          <div className="text-white text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p>Starting camera...</p>
            <p className="text-sm text-white/60 mt-2">Please allow camera access if prompted</p>
          </div>
        )}
        
        {error && (
          <Card className="max-w-sm mx-4">
            <CardContent className="pt-6 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={handleClose} className="w-full" data-testid="button-dismiss-error">
                  Close
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tip: Check your device settings to enable camera permissions for this app
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div 
          id="barcode-reader" 
          className={`w-full max-w-md ${isStarting || error ? "hidden" : ""}`}
          style={{ borderRadius: "8px", overflow: "hidden" }}
        />
      </div>

      <div className="p-4 text-center text-white/70 text-sm" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        <p>Point your camera at a barcode</p>
      </div>
    </div>
  );
}
