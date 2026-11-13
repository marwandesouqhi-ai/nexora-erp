import { createContext, useContext, useRef, useState, useCallback, forwardRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const CarouselContext = createContext(null);

const Carousel = forwardRef(({ className, children, ...props }, ref) => {
    const containerRef = useRef(null);
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(true);

    const updateState = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        setCanPrev(el.scrollLeft > 4);
        setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }, []);

    const scrollBy = (dir) => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
    };

    const value = useMemo(() => ({ containerRef, canPrev, canNext, scrollBy, updateState }), [canPrev, canNext, updateState]);

    return (
        <CarouselContext.Provider value={value}>
            <div ref={ref} className={cn('relative', className)} role="region" aria-roledescription="carousel" {...props}>
                {children}
            </div>
        </CarouselContext.Provider>
    );
});
Carousel.displayName = 'Carousel';

const CarouselContent = forwardRef(({ className, ...props }, ref) => {
    const ctx = useContext(CarouselContext);
    const contentRef = useRef(null);

    const handleRef = (node) => {
        contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    };

    return (
        <div
            ref={handleRef}
            onScroll={ctx?.updateState}
            className={cn('flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth', className)}
            {...props}
        />
    );
});
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} role="group" aria-roledescription="slide" className={cn('min-w-0 shrink-0 grow-0 snap-start basis-full', className)} {...props} />
));
CarouselItem.displayName = 'CarouselItem';

const CarouselPrevious = ({ className }) => {
    const ctx = useContext(CarouselContext);
    return (
        <Button
            variant="outline"
            size="icon"
            disabled={!ctx.canPrev}
            onClick={() => ctx.scrollBy(-1)}
            aria-label="السابق"
            className={cn('absolute top-1/2 start-2 -translate-y-1/2 rounded-full', className)}
        >
            <ChevronRight className="h-4 w-4" />
        </Button>
    );
};

const CarouselNext = ({ className }) => {
    const ctx = useContext(CarouselContext);
    return (
        <Button
            variant="outline"
            size="icon"
            disabled={!ctx.canNext}
            onClick={() => ctx.scrollBy(1)}
            aria-label="التالي"
            className={cn('absolute top-1/2 end-2 -translate-y-1/2 rounded-full', className)}
        >
            <ChevronLeft className="h-4 w-4" />
        </Button>
    );
};

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext };