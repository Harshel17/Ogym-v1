import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Loader2 } from "lucide-react";

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
    const startScanner = async () => {
      if (!containerRef.current) return;
      
      try {
        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777
          },
          (decodedText) => {
            if (!scannedRef.current) {
              scannedRef.current = true;
              onScan(decodedText);
              stopScanner();
            }
          },
          () => {}
        );
        
        setIsStarting(false);
      } catch (err: any) {
        console.error("Scanner error:", err);
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera access and try again.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera. Please try again.");
        }
        setIsStarting(false);
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          console.log("Scanner already stopped");
        }
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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
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
          </div>
        )}
        
        {error && (
          <Card className="max-w-sm">
            <CardContent className="pt-6 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleClose} data-testid="button-dismiss-error">
                Close
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div 
          id="barcode-reader" 
          className={`w-full max-w-md ${isStarting || error ? "hidden" : ""}`}
          style={{ borderRadius: "8px", overflow: "hidden" }}
        />
      </div>

      <div className="p-4 text-center text-white/70 text-sm">
        <p>Point your camera at a barcode</p>
      </div>
    </div>
  );
}
