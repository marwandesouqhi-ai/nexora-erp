import { useEffect, useState } from 'react';
import { db } from '@/api/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { sendStockAlert } from '@/services/whatsappService';
import { useToast } from './use-toast'; // مكتبة التنبيهات اللي ضفناها في الهيكل

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const { toast } = useToast();

    useEffect(() => {
        // 1. مراقبة المنتجات التي قاربت على النفاد (المخزون < حد الأمان)
        // نفترض أن كل منتج عنده حقل اسمه 'minQuantity' هو ده حد الأمان
        const q = query(collection(db, 'products'), where('quantity', '<=', 5));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'added') {
                    const product = change.doc.data();

                    // إرسال تنبيه داخل التطبيق (Toast)
                    toast({
                        variant: "destructive",
                        title: "⚠️ تنبيه مخزون منخفض",
                        description: `المنتج ${product.name} وصل لـ ${product.quantity} قطعة فقط!`,
                    });

                    // إرسال رسالة واتساب (الميزة اللي طلبتها)
                    sendStockAlert(product.name, product.quantity);
                }
            });

            const lowStockItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(lowStockItems);
        });

        return () => unsubscribe();
    }, [toast]);

    return { notifications, count: notifications.length };
}