import { useState } from 'react';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addDays, format, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './button';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/**
 * تقويم شهري بسيط (بديل خفيف لـ react-day-picker غير المتوفرة).
 * Props: selected (Date), onSelect(date), className
 */
function Calendar({ selected, onSelect, className }) {
    const [month, setMonth] = useState(selected || new Date());

    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 6 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 6 });

    const days = [];
    let cursor = start;
    while (cursor <= end) {
        days.push(cursor);
        cursor = addDays(cursor, 1);
    }

    const weekDays = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

    return (
        <div className={cn('rounded-md border border-border bg-card p-3 ', className)}>
            <div className="mb-3 flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="الشهر السابق">
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold text-foreground ">
                    {format(month, 'MMMM yyyy', { locale: ar })}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="الشهر التالي">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
                {weekDays.map((d) => <div key={d}>{d}</div>)}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const inMonth = isSameMonth(day, month);
                    const isSelected = selected && isSameDay(day, selected);
                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => onSelect?.(day)}
                            className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors',
                                inMonth ? 'text-secondary-text ' : 'text-muted-foreground/60 ',
                                isSelected ? 'bg-primary font-bold text-white' : 'hover:bg-card-muted '
                            )}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export { Calendar };