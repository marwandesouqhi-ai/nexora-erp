import { useEffect, useState, useRef } from 'react';
import { db } from '@/api/firebase';
import {
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    limit,
    writeBatch
} from 'firebase/firestore';
import { sendStockAlert } from '@/services/whatsappService';
import { useToast } from '@/components/ui/use-toast';
import { createTenantQuery } from '@/lib/tenantFirestore';

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const { toast } = useToast();
    const isFirstRender = useRef(true);

    // 1. مراقبة المنتجات التي قاربت على النفاد (المخزون <= 5)
    useEffect(() => {
        const q = createTenantQuery('products', where('current_stock', '<=', 5));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'added') {
                    if (!isFirstRender.current) {
                        const product = change.doc.data();
                        toast({
                            variant: 'destructive',
                            title: '⚠️ تنبيه مخزون منخفض',
                            description: `المنتج ${product.name} وصل لـ ${product.quantity} قطعة فقط!`,
                        });
                        sendStockAlert(product.name, product.quantity);
                    }
                }
            });

            const items = snapshot.docs.map((docItem) => ({
                id: `stock-${docItem.id}`,
                name: docItem.data().name,
                quantity: docItem.data().quantity,
                type: 'stock',
                is_read: false,
            }));
            setLowStockItems(items);
        });

        return () => unsubscribe();
    }, [toast]);

    // 2. مراقبة التنبيهات الفورية من مجموعة notifications في Firestore
    useEffect(() => {
        const notifQuery = createTenantQuery(
            'notifications',
            where('is_read', '==', false),
            orderBy('created_at', 'desc'),
            limit(30)
        );

        const unsubscribe = onSnapshot(
            notifQuery,
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' && !isFirstRender.current) {
                        const data = change.doc.data();
                        let variant = 'default';
                        if (data.severity === 'destructive') variant = 'destructive';
                        else if (data.severity === 'success') variant = 'success';

                        toast({
                            variant,
                            title: data.title || 'إشعار جديد',
                            description: data.message || '',
                        });
                    }
                });

                const notifItems = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                setNotifications(notifItems);
                isFirstRender.current = false;
            },
            (err) => {
                console.warn('Notifications onSnapshot fallback: ', err);
                // Fallback without orderBy if index is still building
                const fallbackQ = createTenantQuery(
                    'notifications',
                    where('is_read', '==', false),
                    limit(20)
                );
                return onSnapshot(fallbackQ, (snap) => {
                    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    items.sort((a, b) => {
                        const timeA = a.created_at?.toMillis?.() || 0;
                        const timeB = b.created_at?.toMillis?.() || 0;
                        return timeB - timeA;
                    });
                    setNotifications(items);
                    isFirstRender.current = false;
                });
            }
        );

        return () => unsubscribe();
    }, [toast]);

    // دالة تحديد إشعار كمقروء
    const markAsRead = async (id) => {
        if (String(id).startsWith('stock-')) return;
        try {
            await updateDoc(doc(db, 'notifications', id), { is_read: true });
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    // دالة تحديد الكل كمقروء
    const markAllAsRead = async () => {
        try {
            const batch = writeBatch(db);
            notifications.forEach((item) => {
                if (!String(item.id).startsWith('stock-')) {
                    batch.update(doc(db, 'notifications', item.id), { is_read: true });
                }
            });
            await batch.commit();
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const combinedList = [...notifications, ...lowStockItems];

    return {
        notifications: combinedList,
        count: combinedList.length,
        markAsRead,
        markAllAsRead,
    };
}
