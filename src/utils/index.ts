/**
 * Shared utility helpers for Nexora ERP.
 */

/**
 * Merge class names safely.
 *
 * This intentionally does not require an extra package, so the utility
 * remains usable even when clsx/tailwind-merge are not installed.
 */
export function cn(...inputs: unknown[]): string {
    const result: string[] = [];

    const append = (value: unknown): void => {
        if (!value) return;

        if (typeof value === "string" || typeof value === "number") {
            result.push(String(value));
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(append);
            return;
        }

        if (typeof value === "object") {
            Object.entries(value as Record<string, unknown>).forEach(
                ([key, enabled]) => {
                    if (enabled) result.push(key);
                }
            );
        }
    };

    inputs.forEach(append);
    return result.join(" ");
}

/**
 * Convert a value to a finite number.
 */
export function toNumber(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * Format a number using the Egyptian locale.
 */
export function formatCurrency(
    value: unknown,
    currency = "ج.م"
): string {
    return `${toNumber(value).toLocaleString("ar-EG")} ${currency}`;
}

/**
 * Safely convert a Firestore Timestamp, Date, ISO string, or number to Date.
 */
export function toDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
        const date = (value as { toDate: () => Date }).toDate();
        return date instanceof Date && !Number.isNaN(date.getTime())
            ? date
            : null;
    }

    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
}