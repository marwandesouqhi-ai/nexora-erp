import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  companyName: string;
}

export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, companyName }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 font-cairo flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/55 transition-opacity animate-fade-in" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-card text-right shadow-2xl transition-all sm:my-8 animate-slide-up border border-rose-100">
        
        {/* Header */}
        <div className="bg-rose-50/50 px-6 py-4 border-b border-rose-100 flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg bg-card p-2 text-muted-foreground hover:text-secondary-text hover:bg-card-muted transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shadow-sm border border-border"
            onClick={onClose}
          >
            <span className="sr-only">إغلاق</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-5">
          <div className="flex flex-col items-center text-center">
            <div className="mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 mb-4 ring-8 ring-rose-50">
              <AlertTriangle className="h-8 w-8 text-rose-600" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold leading-6 text-foreground mb-2">تأكيد حذف الشركة</h3>
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد أنك تريد حذف الشركة <span className="font-bold text-foreground">"{companyName}"</span>؟
              <br />
              <span className="text-rose-600 font-semibold mt-2 inline-block bg-rose-50 px-3 py-1 rounded-full">هذا الإجراء لا يمكن التراجع عنه.</span>
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-card-muted/50 px-6 py-4 flex flex-col sm:flex-row-reverse border-t border-border gap-3">
          <button
            type="button"
            disabled={isDeleting}
            className="inline-flex w-full justify-center rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:w-auto transition-all disabled:opacity-50"
            onClick={handleConfirm}
          >
            {isDeleting ? 'جاري الحذف...' : 'نعم، احذف الشركة'}
          </button>
          <button
            type="button"
            className="mt-3 inline-flex w-full justify-center rounded-xl bg-card px-6 py-2.5 text-sm font-bold text-foreground shadow-sm ring-1 ring-inset ring-border-strong hover:bg-card-muted sm:mt-0 sm:w-auto transition-all"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
