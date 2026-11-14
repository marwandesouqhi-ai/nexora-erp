/**
 * Sales helpers
 *
 * Supports the current Nexora ERP sales schema
 * and older sales documents.
 */

/* =========================================================
   PAYMENT STATUS
========================================================= */

export const PAYMENT_STATUS_LABELS = {
    paid: 'مدفوعة',
    partial: 'مدفوعة جزئيًا',
    unpaid: 'غير مدفوعة',
};

export const PAYMENT_STATUS_COLORS = {
    paid: 'bg-emerald-500/15 text-emerald-500',
    partial: 'bg-amber-500/15 text-amber-500',
    unpaid: 'bg-rose-500/15 text-rose-500',
};

/* =========================================================
   BASIC HELPERS
========================================================= */

export const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
};

/* =========================================================
   SALE TOTAL
========================================================= */

/**
 * Get sale total.
 *
 * Supports:
 * - total_amount
 * - total
 */
export const getSaleTotal = (sale = {}) => {
    return toNumber(
        sale?.total_amount ??
        sale?.total ??
        0
    );
};

/**
 * Calculate total from sale items.
 */
export const calculateSaleTotal = (items = []) => {
    if (!Array.isArray(items)) {
        return 0;
    }

    return items.reduce((sum, item) => {
        const quantity = toNumber(
            item?.quantity
        );

        const price = toNumber(
            item?.price ??
            item?.selling_price ??
            0
        );

        const itemTotal =
            item?.total !== undefined &&
                item?.total !== null
                ? toNumber(item.total)
                : quantity * price;

        return sum + itemTotal;
    }, 0);
};

/* =========================================================
   PAID / REMAINING
========================================================= */

/**
 * Get paid amount.
 *
 * Supports:
 * - paid_amount
 * - paid
 * - payment_status === paid
 */
export const getSalePaid = (sale = {}) => {
    const total = getSaleTotal(sale);

    if (
        sale?.paid_amount !== undefined &&
        sale?.paid_amount !== null &&
        sale?.paid_amount !== ''
    ) {
        return Math.min(
            Math.max(
                toNumber(sale.paid_amount),
                0
            ),
            total
        );
    }

    if (
        sale?.paid !== undefined &&
        sale?.paid !== null &&
        sale?.paid !== ''
    ) {
        return Math.min(
            Math.max(
                toNumber(sale.paid),
                0
            ),
            total
        );
    }

    if (sale?.payment_status === 'paid') {
        return total;
    }

    return 0;
};

/**
 * Get remaining amount.
 *
 * Supports:
 * - remaining_amount
 * - calculated from total - paid
 */
export const getSaleRemaining = (sale = {}) => {
    if (
        sale?.remaining_amount !== undefined &&
        sale?.remaining_amount !== null &&
        sale?.remaining_amount !== ''
    ) {
        return Math.max(
            toNumber(sale.remaining_amount),
            0
        );
    }

    const total = getSaleTotal(sale);
    const paid = getSalePaid(sale);

    return Math.max(
        total - paid,
        0
    );
};

/* =========================================================
   GENERIC CALCULATIONS
========================================================= */

export const calculatePaidAmount = (
    total,
    paymentStatus,
    paidAmount
) => {
    const normalizedTotal =
        toNumber(total);

    if (
        paidAmount !== undefined &&
        paidAmount !== null &&
        paidAmount !== ''
    ) {
        return Math.min(
            Math.max(
                toNumber(paidAmount),
                0
            ),
            normalizedTotal
        );
    }

    if (paymentStatus === 'paid') {
        return normalizedTotal;
    }

    return 0;
};

export const calculateRemainingAmount = (
    total,
    paidAmount
) => {
    return Math.max(
        toNumber(total) -
        toNumber(paidAmount),
        0
    );
};

/* =========================================================
   INVOICE
========================================================= */

/**
 * Get invoice number.
 *
 * Supports:
 * - invoice_number
 * - invoiceNumber
 */
export const getSaleInvoiceLabel = (
    sale = {}
) => {
    return String(
        sale?.invoice_number ??
        sale?.invoiceNumber ??
        sale?.id ??
        'بدون رقم'
    );
};

/* =========================================================
   DATE
========================================================= */

/**
 * Convert Firebase Timestamp / Date / string
 * to a JavaScript Date.
 */
export const getSaleDate = (sale = {}) => {
    const value =
        sale?.created_at ??
        sale?.created_date ??
        sale?.date ??
        null;

    if (!value) {
        return null;
    }

    if (
        typeof value?.toDate === 'function'
    ) {
        const date = value.toDate();

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    if (value instanceof Date) {
        return Number.isNaN(
            value.getTime()
        )
            ? null
            : value;
    }

    const date = new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
};

/* =========================================================
   SALE NORMALIZATION
========================================================= */

/**
 * Normalize sale data.
 *
 * Supports old and new fields.
 */
export const normalizeSale = (
    sale = {}
) => {
    const total =
        getSaleTotal(sale);

    const paid =
        getSalePaid({
            ...sale,
            total_amount: total,
        });

    const remaining =
        getSaleRemaining({
            ...sale,
            total_amount: total,
            paid_amount: paid,
        });

    let paymentStatus =
        sale?.payment_status;

    if (!paymentStatus) {
        if (remaining <= 0) {
            paymentStatus = 'paid';
        } else if (paid > 0) {
            paymentStatus = 'partial';
        } else {
            paymentStatus = 'unpaid';
        }
    }

    return {
        ...sale,

        invoice_number:
            sale?.invoice_number ??
            sale?.invoiceNumber ??
            '',

        customer_name:
            sale?.customer_name ??
            sale?.customerName ??
            'عميل نقدي',

        items: Array.isArray(
            sale?.items
        )
            ? sale.items
            : [],

        total,

        total_amount: total,

        paid_amount: paid,

        remaining_amount:
            remaining,

        payment_status:
            paymentStatus,

        created_at:
            sale?.created_at ??
            sale?.created_date ??
            null,

        created_date:
            sale?.created_date ??
            sale?.created_at ??
            null,
    };
};

/* =========================================================
   FORMATTING
========================================================= */

export const formatEGP = (
    value
) => {
    return `${toNumber(
        value
    ).toLocaleString('ar-EG')} ج.م`;
};

export const getPaymentStatusLabel = (
    status
) => {
    return (
        PAYMENT_STATUS_LABELS[status] ??
        'غير محددة'
    );
};

export const getPaymentStatusColor = (
    status
) => {
    return (
        PAYMENT_STATUS_COLORS[status] ??
        'bg-muted text-muted-foreground'
    );
};

export const formatSaleDate = (
    sale
) => {
    const date =
        getSaleDate(sale);

    if (!date) {
        return '—';
    }

    return date.toLocaleString(
        'ar-EG'
    );
};