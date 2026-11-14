import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts, generateProductBarcode, updateProduct } from '@/firebase/collections/products';
import { useRole } from '@/lib/RoleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, Barcode as BarcodeIcon, Printer } from 'lucide-react';

import { PageHero } from '@/components/page';
// ملحوظة: المشروع مفيهوش مكتبة QR/Barcode مثبتة، فبنستخدم خدمة صور خارجية عامة
// (لا حاجة لأي مفتاح API) لتوليد الصورة مباشرة برابط <img>.
function buildBarcodeUrl(code) {
    return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(code)}&code=Code128&translate-esc=true`;
}
function buildQrUrl(code) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}`;
}

export default function BarcodeGenerator() {
    const { can } = useRole();
    const qc = useQueryClient();
    const [manualCode, setManualCode] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [mode, setMode] = useState('barcode');
    const [generatedCodes, setGeneratedCodes] = useState({});
    const printRef = useRef(null);

    const { data: products = [] } = useQuery({ queryKey: ['products-barcode'], queryFn: getProducts });
    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const codeValue = selectedProduct?.barcode || generatedCodes[selectedProductId] || manualCode;
    const label = selectedProduct?.product_name || 'كود مخصص';

    const handleProductSelect = async (productId) => {
        setSelectedProductId(productId);
        setManualCode('');
        const product = products.find((item) => item.id === productId);
        if (!product || product.barcode) return;

        const barcode = generateProductBarcode(product.id);
        setGeneratedCodes((current) => ({ ...current, [productId]: barcode }));
        await updateProduct(productId, { barcode });
        qc.invalidateQueries({ queryKey: ['products-barcode'] });
    };

    const handlePrint = () => {
        if (!codeValue) return;

        const printWindow = window.open('', '_blank', 'width=400,height=500');
        if (!printWindow) {
            window.alert('اسمح بالنوافذ المنبثقة من المتصفح لطباعة الملصق.');
            return;
        }
        printWindow.document.write(`
            <html dir="rtl"><head><title>طباعة الباركود</title></head>
            <body style="text-align:center;font-family:sans-serif;">
                <p style="font-weight:bold;">${label}</p>
                <img src="${mode === 'barcode' ? buildBarcodeUrl(codeValue) : buildQrUrl(codeValue)}" onerror="this.alt='تعذر تحميل صورة الكود'" />
                <p>${codeValue}</p>
                <script>window.onload = () => window.print();</script>
            </body></html>
        `);
        printWindow.document.close();
    };

    if (!can('can_view_inventory')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={QrCode}
                tone="cyan"
                title="مولّد الباركود / QR"
                subtitle="اختر صنفًا من المخزون أو أدخل كودًا يدويًا لتوليد وطباعة ملصق باركود/QR."
            />

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader><CardTitle className="text-lg font-black text-foreground">إعدادات الكود</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">اختر صنفًا من المخزون (اختياري)</label>
                            <Select value={selectedProductId} onValueChange={handleProductSelect}>
                                <SelectTrigger><SelectValue placeholder="اختر صنف..." /></SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.product_name} {p.barcode ? `(${p.barcode})` : ''}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">أو أدخل كودًا يدويًا</label>
                            <Input value={manualCode} onChange={(e) => { setManualCode(e.target.value); setSelectedProductId(''); }} placeholder="مثال: 6221234567890" />
                        </div>

                        <Tabs value={mode} onValueChange={setMode}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="barcode" className="gap-2"><BarcodeIcon className="h-4 w-4" /> باركود</TabsTrigger>
                                <TabsTrigger value="qr" className="gap-2"><QrCode className="h-4 w-4" /> QR كود</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Button className="w-full gap-2" disabled={!codeValue} onClick={handlePrint}>
                            <Printer className="h-4 w-4" /> طباعة الملصق
                        </Button>
                    </CardContent>
                </Card>

                <Card className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm" ref={printRef}>
                    {codeValue ? (
                        <>
                            <p className="mb-3 text-center text-sm font-bold text-foreground">{label}</p>
                            <img
                                src={mode === 'barcode' ? buildBarcodeUrl(codeValue) : buildQrUrl(codeValue)}
                                alt="Generated code"
                                className="max-w-full rounded-lg border border-border bg-white p-3"
                            />
                            <p className="mt-3 text-xs text-muted-foreground">{codeValue}</p>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">اختر صنفًا أو أدخل كودًا لمعاينة الملصق</p>
                    )}
                </Card>
            </div>
        </div>
    );
}
