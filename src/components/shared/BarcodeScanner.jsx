import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export default function BarcodeScanner({ onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner("reader", {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0
      });

      scanner.render((decodedText) => {
        onScanSuccess(decodedText);
        setIsScanning(false);
        if (scanner) { scanner.clear(); }
      }, () => {
        // Ignore errors
      });
    }

    return () => {
      if (scanner) { scanner.clear(); }
    };
  }, [isScanning, onScanSuccess]);

  return (
    <div className="flex flex-col items-center gap-4">
      {!isScanning ? (
        <Button 
          variant="outline" 
          onClick={() => setIsScanning(true)}
          className="gap-2 border-indigo-200 hover:bg-indigo-50"
        >
          <Camera className="w-4 h-4 text-indigo-600" />
          ??? ???????? ?????
        </Button>
      ) : (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-md relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2"
              onClick={() => setIsScanning(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            <h3 className="text-center font-bold mb-4">??? ???????? ??? ????????</h3>
            <div id="reader" className="overflow-hidden rounded-xl border-2 border-dashed border-indigo-200"></div>
          </div>
        </div>
      )}
    </div>
  );
}
