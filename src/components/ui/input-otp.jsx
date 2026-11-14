import { useRef, useState, forwardRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/**
 * مُدخل رمز تحقق (OTP) — بديل خفيف لمكتبة input-otp غير المثبتة.
 * Props: length, value, onChange(value), className
 */
const InputOTP = forwardRef(({ length = 6, value = '', onChange, className }, ref) => {
    const [digits, setDigits] = useState(() => value.padEnd(length, ' ').split('').slice(0, length));
    const refs = useRef([]);

    useEffect(() => {
        setDigits(value.padEnd(length, ' ').split('').slice(0, length));
    }, [value, length]);

    const updateDigit = (index, char) => {
        const next = [...digits];
        next[index] = char;
        setDigits(next);
        onChange?.(next.join('').trimEnd());
        if (char && index < length - 1) refs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            refs.current[index - 1]?.focus();
        }
    };

    return (
        <div ref={ref} className={cn('flex items-center gap-2', className)} dir="ltr">
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={(node) => (refs.current[i] = node)}
                    value={digits[i]?.trim() || ''}
                    onChange={(e) => updateDigit(i, e.target.value.slice(-1))}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    aria-label={`رقم ${i + 1} من رمز التحقق`}
                    className="h-11 w-10 rounded-xl border border-transparent bg-input text-center text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
            ))}
        </div>
    );
});
InputOTP.displayName = 'InputOTP';

export { InputOTP };