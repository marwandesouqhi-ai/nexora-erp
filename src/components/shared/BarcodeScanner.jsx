import { useEffect, useState, useId, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, X, AlertCircle } from 'lucide-react';

/**
 * زرار + نافذة لمسح الباركود عبر كاميرا الجهاز.
 * Props:
 *  - onScanSuccess(code): يُستدعى عند نجاح المسح
 *  - label: نص الزرار (اختياري)
 */
export default function BarcodeScanner({ onScanSuccess, label = 'مسح بالكاميرا' }) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const readerId = useId().replace(/:/g, '-'); // معرّف فريد لتفادي تعارض id عند تعدد الاستخدام

  const handleClose = useCallback(() => {
    setIsScanning(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (!isScanning) return undefined;

    let scanner = new Html5QrcodeScanner(
      readerId,
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
      false
    );

    scanner.render(
      (decodedText) => {
        onScanSuccess?.(decodedText);
        setIsScanning(false);
      },
      (errorMessage) => {
        // أخطاء المسح المستمرة (عدم اكتشاف كود) تُتجاهل، لكن نلتقط رفض إذن الكاميرا
        if (/NotAllowedError|Permission/i.test(errorMessage)) {
          setCameraError('تم رفض إذن الوصول للكاميرا. فعّل الإذن من إعدادات المتصفح.');
        }
      }
    );

    return () => {
      scanner?.clear().catch(() => {
        // تجاهل الخطأ لو الـ scanner اتنضف بالفعل أو لسه بيتحمّل
      });
      scanner = null;
    };
  }, [isScanning, onScanSuccess, readerId]);

  return (
    <div className="flex flex-col items-center gap-4">
      {!isScanning ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsScanning(true)}
          className="gap-2 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
        >
          <Camera className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          {label}
        </Button>
      ) : (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ماسح الباركود"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-card p-4 ">
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-2 top-2"
              onClick={handleClose}
              aria-label="إغلاق الماسح"
            >
              <X className="h-5 w-5" />
            </Button>
            <h3 className="mb-4 text-center font-bold text-foreground ">
              وجّه الكاميرا نحو الباركود
            </h3>

            {cameraError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
                <p className="text-xs font-bold text-red-500">{cameraError}</p>
              </div>
            ) : (
              <div
                id={readerId}
                className="overflow-hidden rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}