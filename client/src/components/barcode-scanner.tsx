import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Loader2, ImageIcon } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoOption, setShowPhotoOption] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
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

  const scanImageWithZxing = async (imageDataUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.CODE_93,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints);
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          const result = await reader.decodeFromImageElement(img);
          console.log("ZXing barcode result:", result.getText());
          resolve(result.getText());
        } catch (err) {
          console.log("ZXing scan failed, trying with rotation...", err);
          
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              
              const hints = new Map();
              hints.set(DecodeHintType.TRY_HARDER, true);
              const reader = new BrowserMultiFormatReader(hints);
              const rotatedImg = new Image();
              rotatedImg.src = canvas.toDataURL();
              await new Promise(r => rotatedImg.onload = r);
              const result = await reader.decodeFromImageElement(rotatedImg);
              console.log("ZXing barcode result (rotated):", result.getText());
              resolve(result.getText());
              return;
            }
          } catch (rotErr) {
            console.log("Rotated scan also failed");
          }
          
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageDataUrl;
    });
  };

  const scanImageFile = async (imageBase64: string) => {
    setIsProcessingPhoto(true);
    setError(null);
    
    try {
      const result = await scanImageWithZxing(imageBase64);
      
      if (result) {
        console.log("Barcode found:", result);
        onScan(result);
        onClose();
        return;
      }
      
      console.log("ZXing failed, trying html5-qrcode...");
      try {
        const html5QrCode = new Html5Qrcode("barcode-reader-photo", { verbose: false });
        
        const response = await fetch(imageBase64);
        const blob = await response.blob();
        const file = new File([blob], "barcode.jpg", { type: "image/jpeg" });
        
        const html5Result = await html5QrCode.scanFile(file, true);
        console.log("html5-qrcode result:", html5Result);
        onScan(html5Result);
        onClose();
        return;
      } catch (html5Err) {
        console.log("html5-qrcode also failed:", html5Err);
      }
      
      setError("No barcode found in the photo. Please ensure the barcode is clearly visible and try again.");
      setIsProcessingPhoto(false);
    } catch (err: any) {
      console.error("Photo scan error:", err);
      setError("Could not scan the photo. Please try again with a clearer image.");
      setIsProcessingPhoto(false);
    }
  };

  const takePhotoAndScan = async () => {
    setError(null);
    try {
      const permission = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
      if (permission.camera !== 'granted' && permission.camera !== 'limited') {
        setError("Camera permission denied. Please enable it in your device settings.");
        return;
      }

      const photo = await CapacitorCamera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
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
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
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
        {isStarting && !error && !showPhotoOption && (
          <div className="text-white text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p>Starting camera...</p>
          </div>
        )}

        {isProcessingPhoto && (
          <div className="text-white text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p>Scanning barcode...</p>
          </div>
        )}

        {showPhotoOption && !isProcessingPhoto && !error && (
          <Card className="max-w-sm mx-4 w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <Camera className="w-16 h-16 mx-auto text-primary" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Scan Product Barcode</h3>
                <p className="text-sm text-muted-foreground">Take a clear photo of the barcode</p>
              </div>
              <div className="space-y-2">
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
                  className="w-full gap-2"
                  data-testid="button-pick-photo"
                >
                  <ImageIcon className="w-4 h-4" />
                  Choose from Gallery
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: Hold camera steady and ensure barcode is well-lit
              </p>
            </CardContent>
          </Card>
        )}
        
        {error && (
          <Card className="max-w-sm mx-4">
            <CardContent className="pt-6 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
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
            </CardContent>
          </Card>
        )}
        
        <div 
          id="barcode-reader" 
          className={`w-full max-w-md ${isStarting || error || showPhotoOption ? "hidden" : ""}`}
          style={{ borderRadius: "8px", overflow: "hidden" }}
        />
        <div id="barcode-reader-photo" className="hidden" />
      </div>

      {!showPhotoOption && !error && (
        <div className="p-4 text-center text-white/70 text-sm" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <p>Point your camera at a barcode</p>
        </div>
      )}
    </div>
  );
}
