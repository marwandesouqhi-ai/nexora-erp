import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import '@/styles/leaflet-modern.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Navigation,
    Route,
    Clock,
    MapPin,
    Compass,
    CheckCircle2,
    Users,
    Layers,
    Maximize2
} from 'lucide-react';

/**
 * حساب المسافة بالكيلومتر بين نقطتين جغرافيتين باستخدام خوارزمية Haversine
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * خوارزمية الجار الأقرب (Nearest-Neighbor Heuristic)
 * لترتيب العملاء للحصول على أقصر مسار زمني ومكاني لليومية
 */
function solveNearestNeighborRoute(stops, startPoint = null) {
    if (!stops || stops.length === 0) return [];
    if (stops.length === 1) return [{ ...stops[0], stopNumber: 1, legDistanceKm: 0 }];

    const unvisited = [...stops];
    const route = [];

    // نقطة البداية: موقع المندوب أو أول محطة
    let currentPoint = startPoint || unvisited.shift();
    if (startPoint) {
        // إذا كان هناك نقطة بداية خارجية (المندوب)
    } else {
        route.push({ ...currentPoint, stopNumber: 1, legDistanceKm: 0 });
    }

    let stopCounter = route.length + 1;

    while (unvisited.length > 0) {
        let nearestIndex = 0;
        let shortestDist = Infinity;

        const curLat = currentPoint.lat || currentPoint.latitude;
        const curLng = currentPoint.lng || currentPoint.longitude;

        for (let i = 0; i < unvisited.length; i++) {
            const stop = unvisited[i];
            const sLat = stop.lat || stop.latitude;
            const sLng = stop.lng || stop.longitude;
            const dist = calculateDistanceKm(curLat, curLng, sLat, sLng);

            if (dist < shortestDist) {
                shortestDist = dist;
                nearestIndex = i;
            }
        }

        const nextStop = unvisited.splice(nearestIndex, 1)[0];
        route.push({
            ...nextStop,
            stopNumber: stopCounter++,
            legDistanceKm: Number(shortestDist.toFixed(2)),
        });
        currentPoint = nextStop;
    }

    return route;
}

export default function RouteOptimizerMap({
    customers = [],
    visits = [],
    selectedRep = null,
    repLocation = null,
    className = ""
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersLayerRef = useRef(null);
    const routeLayerRef = useRef(null);

    const [viewMode, setViewMode] = useState('optimized'); // 'optimized' | 'actual' | 'both'

    // فلترة نقاط العملاء أو الزيارات الصالحة جغرافياً
    const validStops = useMemo(() => {
        // نبحث عن العملاء أو الزيارات التي تحتوي على إحداثيات خط العرض والطول
        const list = [];
        const seen = new Set();

        // 1. من الزيارات
        visits.forEach(v => {
            const lat = Number(v.customer_lat || v.latitude || v.lat || v.check_in_lat);
            const lng = Number(v.customer_lng || v.longitude || v.lng || v.check_in_lng);
            if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
                const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        id: v.id || v.customer_id,
                        name: v.customer_name || 'عميل في خط السير',
                        address: v.customer_address || v.address || '',
                        lat,
                        lng,
                        isCompleted: Boolean(v.checkOutTime || v.completed_at || v.status === 'completed'),
                        visitTime: v.checkInTime || v.date || '',
                        type: 'visit',
                    });
                }
            }
        });

        // 2. من جدول العملاء إن كان فارغاً
        if (list.length === 0) {
            customers.forEach(c => {
                const lat = Number(c.lat || c.latitude);
                const lng = Number(c.lng || c.longitude);
                if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
                    list.push({
                        id: c.id,
                        name: c.name,
                        address: c.address || '',
                        lat,
                        lng,
                        isCompleted: false,
                        type: 'customer',
                    });
                }
            });
        }

        // عينات توضيحية جغرافية إذا لم تكن الإحداثيات مسجلة لعمل تجربة حية ممتازة
        if (list.length === 0) {
            const demoCenter = { lat: 30.0444, lng: 31.2357 }; // القاهرة
            const sampleNames = ["صيدلية الأمل", "مستشفى السلام", "صيدلية النور", "موزع المتحدة", "صيدلية الفؤاد"];
            return sampleNames.map((name, idx) => ({
                id: `demo_${idx}`,
                name,
                address: `شارع ${idx + 1}، المنطقة المركزية`,
                lat: demoCenter.lat + (Math.sin(idx) * 0.035),
                lng: demoCenter.lng + (Math.cos(idx) * 0.045),
                isCompleted: idx < 2,
                type: 'demo',
            }));
        }

        return list;
    }, [customers, visits]);

    // حساب المسار الأمثل
    const optimizedRoute = useMemo(() => {
        return solveNearestNeighborRoute(validStops, repLocation);
    }, [validStops, repLocation]);

    // حساب إجمالي المسافة والزمن المقدر
    const metrics = useMemo(() => {
        let totalKm = 0;
        for (let i = 1; i < optimizedRoute.length; i++) {
            const prev = optimizedRoute[i - 1];
            const cur = optimizedRoute[i];
            totalKm += calculateDistanceKm(prev.lat, prev.lng, cur.lat, cur.lng);
        }

        // تقدير الزمن: متوسط سرعة التنقل بالمدينة 30 كم/ساعة + 15 دقيقة لكل زيارة
        const travelMinutes = (totalKm / 30) * 60;
        const serviceMinutes = optimizedRoute.length * 15;
        const totalMinutes = Math.round(travelMinutes + serviceMinutes);

        const completedCount = optimizedRoute.filter(s => s.isCompleted).length;

        return {
            totalDistanceKm: Number(totalKm.toFixed(1)),
            estimatedTimeMinutes: totalMinutes,
            totalStops: optimizedRoute.length,
            completedStops: completedCount,
            progressPercent: optimizedRoute.length > 0 ? Math.round((completedCount / optimizedRoute.length) * 100) : 0,
        };
    }, [optimizedRoute]);

    // تهيئة خريطة Leaflet
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
            // موقع مبدئي
            const initialCenter = validStops.length > 0
                ? [validStops[0].lat, validStops[0].lng]
                : [30.0444, 31.2357];

            const map = L.map(mapContainerRef.current, {
                center: initialCenter,
                zoom: 13,
                zoomControl: true,
                attributionControl: true,
            });

            // خريطة OpenStreetMap النظيفة
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors | Nexora ERP',
            }).addTo(map);

            markersLayerRef.current = L.layerGroup().addTo(map);
            routeLayerRef.current = L.layerGroup().addTo(map);

            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // تحديث المحطات ورسم خط المسار الملاحي Polyline
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !markersLayerRef.current || !routeLayerRef.current) return;

        markersLayerRef.current.clearLayers();
        routeLayerRef.current.clearLayers();

        if (optimizedRoute.length === 0) return;

        const latLngs = [];

        // 1. إضافة علامات العملاء المرقمة تسلسلياً (1، 2، 3...)
        optimizedRoute.forEach((stop) => {
            const latLng = [stop.lat, stop.lng];
            latLngs.push(latLng);

            const isDone = stop.isCompleted;
            const statusClass = isDone ? 'completed' : 'pending';

            // إنشاء أيقونة مخصصة دائرية مع رقم التوقف
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="custom-route-marker ${statusClass}" style="width: 28px; height: 28px;">
                    ${isDone ? '✓' : stop.stopNumber}
                </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14],
            });

            const marker = L.marker(latLng, { icon: customIcon });

            const popupContent = `
                <div style="font-family: inherit;">
                    <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">
                        #${stop.stopNumber} ${stop.name}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
                        ${stop.address || 'عنوان العميل'}
                    </div>
                    <div style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${
                        isDone ? 'background: #d1fae5; color: #065f46;' : 'background: #e0e7ff; color: #3730a3;'
                    }">
                        ${isDone ? 'تمت الزيارة بنجاح ✅' : 'بانتظار الزيارة ⏳'}
                    </div>
                    ${stop.legDistanceKm ? `<div style="font-size: 11px; margin-top: 4px; color: #4f46e5; font-weight: bold;">المسافة من النقطة السابقة: ${stop.legDistanceKm} كم</div>` : ''}
                </div>
            `;

            marker.bindPopup(popupContent);
            markersLayerRef.current.addLayer(marker);
        });

        // 2. إضافة علامة المندوب الحالية إذا توفرت
        if (repLocation && repLocation.lat && repLocation.lng) {
            const repIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="custom-route-marker rep" style="width: 32px; height: 32px;">
                    📍
                </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });
            const repMarker = L.marker([repLocation.lat, repLocation.lng], { icon: repIcon })
                .bindPopup(`<div style="font-weight: bold;">موقع المندوب الحالي 🟢</div>`);
            markersLayerRef.current.addLayer(repMarker);
        }

        // 3. رسم خط المسار الملاحي (Polyline)
        if (latLngs.length > 1) {
            const polyline = L.polyline(latLngs, {
                color: '#4f46e5', // Indigo
                weight: 4,
                opacity: 0.85,
                dashArray: '8, 8',
                lineJoin: 'round',
            });
            routeLayerRef.current.addLayer(polyline);

            // ضبط إطار الخريطة لاحتواء كل النقاط
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        }
    }, [optimizedRoute, repLocation]);

    return (
        <Card className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
            <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base font-black text-foreground">
                                محرك المسارات الذكية على الخريطة (Route Optimization)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                حساب أقصر مسار لزيارات اليوم بخوارزمية Nearest-Neighbor وترقيم العملاء تسلسلياً (1، 2، 3...).
                            </p>
                        </div>
                    </div>

                    {/* Trip Metrics Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold">
                            <Navigation className="h-3.5 w-3.5 text-primary" />
                            <span>المسافة:</span>
                            <span className="font-mono text-foreground">{metrics.totalDistanceKm} كم</span>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span>الزمن المقدر:</span>
                            <span className="font-mono text-foreground">{metrics.estimatedTimeMinutes} دقيقة</span>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>الإنجاز:</span>
                            <span className="font-mono text-foreground">{metrics.completedStops} / {metrics.totalStops} ({metrics.progressPercent}%)</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 relative">
                {/* Map Container */}
                <div
                    ref={mapContainerRef}
                    className="w-full h-[460px] z-10"
                    style={{ minHeight: '420px' }}
                />

                {/* Legend Overlay */}
                <div className="absolute bottom-4 right-4 z-20 rounded-2xl border border-border/80 bg-background/90 p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5">
                    <div className="font-black text-foreground mb-1">دليل خريطة السير:</div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-muted-foreground">زيارة مكتملة تم تنفيذها</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-indigo-500 inline-block" />
                        <span className="text-muted-foreground">محطة مجدولة حسب أقصر مسار (1، 2..)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-0.5 w-4 bg-indigo-500 border-t border-dashed border-white inline-block" />
                        <span className="text-muted-foreground">خط الرحلة الملاحي المحسوب</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
