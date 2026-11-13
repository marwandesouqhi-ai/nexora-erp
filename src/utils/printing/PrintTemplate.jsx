import { forwardRef, useMemo } from "react";
import { formatCurrency, toDate } from "@/utils";

const defaultItems = [];

function normalizeItems(invoice) {
    if (!invoice) return defaultItems;

    if (Array.isArray(invoice.items)) {
        return invoice.items.map((item) => ({
            product_name:
                item.product_name ??
                item.name ??
                item.productName ??
                "منتج بدون اسم",
            barcode: item.barcode ?? "",
            quantity: Number(item.quantity ?? item.qty ?? 0),
            price: Number(item.price ?? item.selling_price ?? 0),
            total: Number(
                item.total ??
                Number(item.quantity ?? item.qty ?? 0) *
                Number(item.price ?? item.selling_price ?? 0)
            ),
        }));
    }

    return defaultItems;
}

const PrintTemplate = forwardRef(function PrintTemplate(
    {
        sale = null,
        invoice = null,
        companyName = "NEXORA ERP",
        companySubtitle = "نظام إدارة متكامل",
        logoUrl = "",
        currency = "ج.م",
        className = "",
        showBarcode = true,
        footer = "شكرًا لتعاملكم معنا!",
        headerColor = '#111827',
        accentColor = '#2563eb',
        textColor = '#111827',
        backgroundColor = '#ffffff',
    },
    ref
) {
    const data = useMemo(() => sale ?? invoice ?? {}, [sale, invoice]);

    const items = useMemo(() => normalizeItems(data), [data]);

    const total = Number(
        data.total ??
        data.total_amount ??
        data.totalAmount ??
        items.reduce((sum, item) => sum + item.total, 0)
    );

    const invoiceNumber =
        data.invoice_number ??
        data.invoiceNumber ??
        data.id ??
        "—";

    const customerName =
        data.customer_name ??
        data.customerName ??
        "عميل نقدي";

    const date =
        toDate(data.created_at ?? data.created_date ?? data.createdAt) ??
        new Date();

    const paymentStatus =
        data.payment_status ??
        data.paymentStatus ??
        "";

    const paymentLabels = {
        paid: "مدفوعة",
        partial: "مدفوعة جزئيًا",
        unpaid: "غير مدفوعة",
        refunded: "مرتجع",
    };

    return (
        <div
            ref={ref}
            className={`w-[80mm] rounded-3xl border border-slate-300 p-4 ${className}`}
            dir="rtl"
            style={{
                fontFamily: "Arial, Tahoma, sans-serif",
                boxSizing: "border-box",
                backgroundColor,
                color: textColor,
            }}
        >
            <div
                className="mb-4 rounded-2xl px-4 py-3"
                style={{ backgroundColor: headerColor, color: '#ffffff' }}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                        <h1 className="text-xl font-black tracking-wide" style={{ color: '#ffffff' }}>
                            {companyName}
                        </h1>
                        <p className="mt-1 text-[10px] text-slate-100">{companySubtitle}</p>
                    </div>
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain" />
                    )}
                </div>
            </div>

            <div className="mb-4 space-y-1 text-[11px]">
                <div className="flex justify-between gap-2">
                    <span>الفاتورة:</span>
                    <strong>{invoiceNumber}</strong>
                </div>

                <div className="flex justify-between gap-2">
                    <span>التاريخ:</span>
                    <span>{date.toLocaleString("ar-EG")}</span>
                </div>

                <div className="flex justify-between gap-2">
                    <span>العميل:</span>
                    <strong>{customerName}</strong>
                </div>

                {paymentStatus && (
                    <div className="flex justify-between gap-2">
                        <span>حالة الدفع:</span>
                        <strong>
                            {paymentLabels[paymentStatus] ?? paymentStatus}
                        </strong>
                    </div>
                )}
            </div>

            <table className="mb-4 w-full border-collapse text-[10px]">
                <thead>
                    <tr className="border-b border-black">
                        <th className="py-2 text-right">الصنف</th>
                        <th className="px-1 text-center">كمية</th>
                        <th className="px-1 text-left">الإجمالي</th>
                    </tr>
                </thead>

                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td
                                colSpan={3}
                                className="py-4 text-center text-slate-500"
                            >
                                لا توجد أصناف
                            </td>
                        </tr>
                    ) : (
                        items.map((item, index) => (
                            <tr
                                key={`${item.product_name}-${index}`}
                                className="border-b border-dotted border-slate-300"
                            >
                                <td className="py-2 align-top">
                                    <div className="font-semibold">
                                        {item.product_name}
                                    </div>

                                    {showBarcode && item.barcode && (
                                        <div className="mt-0.5 text-[8px] text-slate-500">
                                            {item.barcode}
                                        </div>
                                    )}
                                </td>

                                <td className="px-1 text-center align-top">
                                    {item.quantity}
                                </td>

                                <td className="px-1 text-left align-top font-bold">
                                    {Number(item.total).toLocaleString("ar-EG")}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <div className="border-t-2 border-black pt-2">
                <div className="flex justify-between text-base font-black" style={{ color: accentColor }}>
                    <span>الإجمالي:</span>
                    <span>{formatCurrency(total, currency)}</span>
                </div>
            </div>

            <div className="mt-6 border-t border-dashed border-black pt-3 text-center">
                <p className="text-[10px]">{footer}</p>
                <p className="mt-1 text-[8px] italic">
                    Powered by Nexora ERP
                </p>
            </div>
        </div>
    );
});

PrintTemplate.displayName = "PrintTemplate";

export default PrintTemplate;
export { PrintTemplate };