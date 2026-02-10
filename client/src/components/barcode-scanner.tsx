import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Camera, Loader2, ImageIcon, Keyboard, ScanLine } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoOption, setShowPhotoOption] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.log("Scanner already stopped");
      }
      scannerRef.current = null;
    }
  }, []);

  const scanWithZxing = async (imageDataUrl: string): Promise<string | null> => {
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      const reader = new BrowserMultiFormatReader(hints);
      
      const result = await reader.decodeFromImageUrl(imageDataUrl);
      console.log("ZXing decoded:", result.getText());
      return result.getText();
    } catch (err) {
      console.log("ZXing primary scan failed:", err);
      return null;
    }
  };

  const scanWithHtml5Qrcode = async (imageDataUrl: string): Promise<string | null> => {
    try {
      const html5QrCode = new Html5Qrcode("barcode-reader-photo", { verbose: false });
      
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], "barcode.jpg", { type: "image/jpeg" });
      
      const result = await html5QrCode.scanFile(file, true);
      console.log("html5-qrcode decoded:", result);
      return result;
    } catch (err) {
      console.log("html5-qrcode scan failed:", err);
      return null;
    }
  };

  const scanImageFile = async (imageBase64: string) => {
    setIsProcessingPhoto(true);
    setError(null);
    
    try {
      let result = await scanWithZxing(imageBase64);
      
      if (!result) {
        result = await scanWithHtml5Qrcode(imageBase64);
      }
      
      if (result) {
        console.log("Barcode found:", result);
        onScan(result);
        onClose();
        return;
      }
      
      setError("No barcode detected in the image. Try entering it manually.");
      setShowManualEntry(true);
      setIsProcessingPhoto(false);
    } catch (err: any) {
      console.error("Photo scan error:", err);
      setError("Could not read the barcode. Try entering it manually.");
      setShowManualEntry(true);
      setIsProcessingPhoto(false);
    }
  };

  const takePhotoAndScan = async () => {
    setError(null);
    setShowManualEntry(false);
    try {
      const { Camera: CapCamera, CameraResultType: CRT, CameraSource: CS } = await import("@capacitor/camera");
      const permission = await CapCamera.requestPermissions({ permissions: ['camera'] });
      if (permission.camera !== 'granted' && permission.camera !== 'limited') {
        setError("Camera permission denied. Please enable it in your device settings.");
        return;
      }

      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CRT.DataUrl,
        source: CS.Camera,
        correctOrientation: true,
        width: 1920,
        height: 1080,
      });

      if (photo.dataUrl) {
        await scanImageFile(photo.dataUrl);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.message?.includes("cancelled") || err.message?.includes("canceled") || err.message?.includes("User cancelled")) {
        return;
      }
      setError("Could not take photo. Please try again.");
    }
  };

  const pickPhotoAndScan = async () => {
    setError(null);
    setShowManualEntry(false);
    try {
      const { Camera: CapCamera, CameraResultType: CRT, CameraSource: CS } = await import("@capacitor/camera");
      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CRT.DataUrl,
        source: CS.Photos,
      });

      if (photo.dataUrl) {
        await scanImageFile(photo.dataUrl);
      }
    } catch (err: any) {
      console.error("Photo pick error:", err);
      if (err.message?.includes("cancelled") || err.message?.includes("canceled") || err.message?.includes("User cancelled")) {
        return;
      }
      setError("Could not select photo. Please try again.");
    }
  };

  const handleManualSubmit = () => {
    const cleanedBarcode = manualBarcode.replace(/\s/g, '').trim();
    if (cleanedBarcode.length >= 8) {
      onScan(cleanedBarcode);
      onClose();
    }
  };

  useEffect(() => {
    if (isNative) {
      setIsStarting(false);
      setShowPhotoOption(true);
      return;
    }

    const startScanner = async () => {
      if (!containerRef.current) return;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777,
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

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan, isNative, stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100001] bg-black/95 flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary" />
          <h2 className="text-base font-medium text-white">Scan Barcode</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          className="text-white/70"
          data-testid="button-close-scanner"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-y-auto" ref={containerRef}>
        {isStarting && !error && !showPhotoOption && (
          <div className="text-white text-center p-6">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/70">Starting camera...</p>
          </div>
        )}

        {isProcessingPhoto && (
          <div className="text-white text-center p-6">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/70">Reading barcode...</p>
          </div>
        )}

        {showPhotoOption && !isProcessingPhoto && (
          <div className="w-full max-w-sm mx-auto px-5 py-6">
            {!showManualEntry ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
                    <ScanLine className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-white text-base">Scan Product Barcode</h3>
                  <p className="text-xs text-white/50 mt-1">Take a photo or enter the barcode number</p>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/15 border border-destructive/20 px-3 py-2">
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <Button 
                    onClick={takePhotoAndScan} 
                    className="w-full gap-2"
                    data-testid="button-take-photo"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </Button>
                  <Button 
                    onClick={pickPhotoAndScan} 
                    variant="outline"
                    className="w-full gap-2 border-white/20 text-white"
                    data-testid="button-pick-photo"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Choose from Gallery
                  </Button>
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-black/95 px-2 text-white/40">or</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowManualEntry(true)} 
                    variant="ghost"
                    className="w-full gap-2 text-white/60"
                    data-testid="button-manual-entry"
                  >
                    <Keyboard className="w-4 h-4" />
                    Enter Barcode Manually
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
                    <Keyboard className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-white text-base">Enter Barcode</h3>
                  <p className="text-xs text-white/50 mt-1">Type the numbers printed below the barcode</p>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/15 border border-destructive/20 px-3 py-2">
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 8901234567890"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                    className="text-center text-lg tracking-wider bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    autoFocus
                    data-testid="input-barcode"
                  />
                  <Button 
                    onClick={handleManualSubmit}
                    disabled={manualBarcode.replace(/\s/g, '').length < 8}
                    className="w-full"
                    data-testid="button-submit-barcode"
                  >
                    Look Up Product
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowManualEntry(false);
                      setManualBarcode("");
                      setError(null);
                    }} 
                    variant="ghost"
                    className="w-full text-white/60"
                    data-testid="button-back-to-scan"
                  >
                    Back to Camera
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {error && !showPhotoOption && (
          <div className="w-full max-w-sm mx-auto px-5 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
              <Camera className="w-7 h-7 text-white/50" />
            </div>
            <p className="text-sm text-white/70 mb-4">{error}</p>
            <div className="space-y-2">
              {isNative && (
                <Button onClick={() => { setError(null); }} className="w-full" data-testid="button-try-again">
                  Try Again
                </Button>
              )}
              <Button onClick={handleClose} variant={isNative ? "outline" : "default"} className="w-full" data-testid="button-dismiss-error">
                Close
              </Button>
            </div>
          </div>
        )}
        
        <div 
          id="barcode-reader" 
          className={`w-full max-w-md ${isStarting || error || showPhotoOption ? "hidden" : ""}`}
          style={{ borderRadius: "8px", overflow: "hidden" }}
        />
        <div id="barcode-reader-photo" className="hidden" />
      </div>

      {!showPhotoOption && !error && (
        <div className="px-4 py-3 text-center text-white/50 text-xs" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          <p>Point your camera at a barcode</p>
        </div>
      )}
    </div>
  );
}
