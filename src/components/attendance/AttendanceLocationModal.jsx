import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, Navigation, CheckCircle2, LogOut, Compass } from 'lucide-react';

export default function AttendanceLocationModal({ record, open, onClose }) {
    if (!record) return null;

    const hasCheckInLocation = record.check_in_lat != null && record.check_in_lng != null;
    const hasCheckOutLocation = record.check_out_lat != null && record.check_out_lng != null;

    const getGoogleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                        <MapPin className="h-5 w-5 text-primary" />
                        الموقع الجغرافي للتبصيم الميداني
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        التحقق من إحداثيات وموقع المندوب <span className="font-bold text-foreground">{record.employee_name}</span> والتأكد من تواجده ضمن خط السير المعتمد.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    {/* موقع الحضور (Check-In) */}
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-foreground">موقع تسجيل الحضور</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {record.date} {record.check_in?.toDate ? record.check_in.toDate().toLocaleTimeString('ar-EG') : ''}
                                    </p>
                                </div>
                            </div>
                            <Badge variant={hasCheckInLocation ? 'secondary' : 'outline'} className="text-[10px]">
                                {hasCheckInLocation ? 'GPS متوفر' : 'غير مسجل'}
                            </Badge>
                        </div>

                        {hasCheckInLocation ? (
                            <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">الإحداثيات:</span>
                                    <span className="font-mono text-[11px] text-foreground font-semibold">
                                        {record.check_in_lat.toFixed(5)}, {record.check_in_lng.toFixed(5)}
                                    </span>
                                </div>

                                {record.check_in_accuracy && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                                            دقة الـ GPS:
                                        </span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            ± {Math.round(record.check_in_accuracy)} متر
                                        </span>
                                    </div>
                                )}

                                <Button
                                    asChild
                                    size="sm"
                                    className="w-full mt-2 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                                >
                                    <a
                                        href={getGoogleMapsUrl(record.check_in_lat, record.check_in_lng)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Navigation className="h-4 w-4" />
                                        فتح موقع الحضور في خرائط Google
                                        <ExternalLink className="h-3 w-3 mr-auto" />
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <p className="mt-2 text-xs text-muted-foreground italic">
                                لم يتم تسجيل إحداثيات GPS لتسجيل الحضور هذا.
                            </p>
                        )}
                    </div>

                    {/* موقع الانصراف (Check-Out) */}
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <LogOut className="h-4 w-4" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-foreground">موقع تسجيل الانصراف</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {record.check_out?.toDate ? record.check_out.toDate().toLocaleTimeString('ar-EG') : 'لم ينصرف بعد'}
                                    </p>
                                </div>
                            </div>
                            <Badge variant={hasCheckOutLocation ? 'secondary' : 'outline'} className="text-[10px]">
                                {hasCheckOutLocation ? 'GPS متوفر' : 'غير مسجل'}
                            </Badge>
                        </div>

                        {hasCheckOutLocation ? (
                            <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">الإحداثيات:</span>
                                    <span className="font-mono text-[11px] text-foreground font-semibold">
                                        {record.check_out_lat.toFixed(5)}, {record.check_out_lng.toFixed(5)}
                                    </span>
                                </div>

                                {record.check_out_accuracy && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                                            دقة الـ GPS:
                                        </span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400">
                                            ± {Math.round(record.check_out_accuracy)} متر
                                        </span>
                                    </div>
                                )}

                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-2 gap-2 rounded-xl"
                                >
                                    <a
                                        href={getGoogleMapsUrl(record.check_out_lat, record.check_out_lng)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Navigation className="h-4 w-4" />
                                        فتح موقع الانصراف في خرائط Google
                                        <ExternalLink className="h-3 w-3 mr-auto" />
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <p className="mt-2 text-xs text-muted-foreground italic">
                                {record.check_out ? 'تم تسجيل الانصراف بدون إحداثيات GPS.' : 'لم يتم تسجيل الانصراف حتى الآن.'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">
                        إغلاق
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
