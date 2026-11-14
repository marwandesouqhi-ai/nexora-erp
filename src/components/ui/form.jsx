import { createContext, useContext, forwardRef, useId } from 'react';
import { Label } from './label';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/**
 * ⚠️ ملحوظة هامة: shadcn الأصلي لهذا المكون يعتمد بالكامل على مكتبة
 * "react-hook-form" وهي غير موجودة في package.json ولا في node_modules.
 * الصفحات الحالية (Inventory, Sales...) لا تستخدم react-hook-form أصلاً —
 * كلها controlled forms عادية بـ useState (شوف ProductDialog.jsx و
 * CreateSaleDialog.jsx كأمثلة). لذلك بنيت هنا نسخة مبسطة "form primitives"
 * لا تعتمد على أي مكتبة خارجية، وتصلح للفورمات العادية الموجودة بالفعل.
 * لو احتجت لاحقًا فورمات معقدة بـ validation، يفضل تثبيت react-hook-form + zod
 * (zod نفسها متوفرة أصلاً في node_modules) — وهذا برة نطاقي (package.json).
 */

const FormFieldContext = createContext(null);

function FormItem({ className, children, ...props }) {
    const id = useId();
    return (
        <FormFieldContext.Provider value={{ id }}>
            <div className={cn('space-y-2', className)} {...props}>{children}</div>
        </FormFieldContext.Provider>
    );
}

const FormLabel = forwardRef(({ className, ...props }, ref) => {
    const ctx = useContext(FormFieldContext);
    return <Label ref={ref} htmlFor={ctx?.id} className={cn(className)} {...props} />;
});
FormLabel.displayName = 'FormLabel';

const FormControl = forwardRef(({ ...props }, ref) => {
    const ctx = useContext(FormFieldContext);
    return <div ref={ref} id={ctx?.id} {...props} />;
});
FormControl.displayName = 'FormControl';

function FormDescription({ className, ...props }) {
    return <p className={cn('text-[13px] text-muted-foreground ', className)} {...props} />;
}

function FormMessage({ className, children, ...props }) {
    if (!children) return null;
    return (
        <p role="alert" className={cn('text-[13px] font-medium text-danger', className)} {...props}>
            {children}
        </p>
    );
}

export { FormItem, FormLabel, FormControl, FormDescription, FormMessage };