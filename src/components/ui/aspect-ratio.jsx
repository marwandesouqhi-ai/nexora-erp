/** حاوية تحافظ على نسبة عرض/ارتفاع ثابتة (مثلاً 16/9) بدون أي مكتبة خارجية */
function AspectRatio({ ratio = 1, className, style, children, ...props }) {
    return (
        <div className={className} style={{ position: 'relative', width: '100%', ...style }} {...props}>
            <div style={{ paddingBottom: `${100 / ratio}%` }} />
            <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
        </div>
    );
}

export { AspectRatio };