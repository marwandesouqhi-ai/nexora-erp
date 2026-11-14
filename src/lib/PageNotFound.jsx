import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function PageNotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4" dir="rtl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-2">404</h1>
            <p className="text-muted-foreground font-bold mb-1">الصفحة غير موجودة</p>
            <p className="text-muted-foreground text-sm mb-6">الصفحة اللي بتدور عليها مش موجودة أو اتنقلت لمكان تاني.</p>
            <Link
                to="/"
                className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
            >
                <Home className="w-4 h-4" />
                الرجوع للوحة التحكم
            </Link>
        </div>
    );
}