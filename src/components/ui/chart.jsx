import { createContext, useContext, useId } from 'react';
import { ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const ChartContext = createContext(null);

/**
 * غلاف عام لأي رسم بياني من recharts، مع تمرير config الألوان عبر CSS variables.
 * config: { seriesKey: { label, color } }
 */
function ChartContainer({ config = {}, className, children }) {
    const id = useId().replace(/:/g, '');
    const styleVars = Object.entries(config).reduce((acc, [key, val]) => {
        acc[`--color-${key}`] = val.color;
        return acc;
    }, {});

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-chart={id}
                style={styleVars}
                className={cn('flex aspect-video justify-center text-xs [&_.recharts-cartesian-grid_line]:stroke-border', className)}
            >
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

function ChartTooltipContent({ active, payload, label, className }) {
    const ctx = useContext(ChartContext);
    if (!active || !payload?.length) return null;

    return (
        <div className={cn('rounded-lg border border-border bg-card p-2.5 shadow-md ', className)}>
            {label && <p className="mb-1 text-xs font-bold text-muted-foreground ">{label}</p>}
            <div className="space-y-1">
                {payload.map((item) => (
                    <div key={item.dataKey} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-secondary-text ">
                            {ctx?.config?.[item.dataKey]?.label || item.name}:
                        </span>
                        <span className="font-bold text-foreground ">{item.value?.toLocaleString?.() ?? item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const ChartTooltip = Tooltip;
const ChartLegend = Legend;

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend };