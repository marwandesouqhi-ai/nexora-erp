import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    where,
    onSnapshot,
    serverTimestamp
} from "@/data/firestoreCompat";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";

// تسجيل حضور موظف (Check-in)
export const clockIn = async ({
    employeeId,
    employeeName,
    method = "biometric",
    checkInLat = null,
    checkInLng = null,
    checkInAccuracy = null,
    status = "present",
}) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const ref = await addDoc(collection(db, "attendance"), withTenant({
            employee_id: employeeId,
            employee_name: employeeName,
            date: today,
            check_in: serverTimestamp(),
            check_out: null,
            status: status || "present", // present, late, absent, leave
            method: method || "biometric",
            check_in_lat: checkInLat !== null ? Number(checkInLat) : null,
            check_in_lng: checkInLng !== null ? Number(checkInLng) : null,
            check_in_accuracy: checkInAccuracy !== null ? Number(checkInAccuracy) : null,
            check_out_lat: null,
            check_out_lng: null,
            check_out_accuracy: null,
            created_at: serverTimestamp(),
        }));
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Attendance clockIn Error: ", error);
        return { success: false, error };
    }
};

// تسجيل انصراف موظف (Check-out) على سجل الحضور الحالي
export const clockOut = async (attendanceId, { checkOutLat = null, checkOutLng = null, checkOutAccuracy = null } = {}) => {
    try {
        const updateData = {
            check_out: serverTimestamp(),
        };
        if (checkOutLat !== null) updateData.check_out_lat = Number(checkOutLat);
        if (checkOutLng !== null) updateData.check_out_lng = Number(checkOutLng);
        if (checkOutAccuracy !== null) updateData.check_out_accuracy = Number(checkOutAccuracy);

        await updateDoc(doc(db, "attendance", attendanceId), updateData);
        return { success: true };
    } catch (error) {
        console.error("Attendance clockOut Error: ", error);
        return { success: false, error };
    }
};

// تسجيل غياب/إجازة يدويًا
export const recordAttendanceStatus = async ({ employeeId, employeeName, date, status, note }) => {
    try {
        const ref = await addDoc(collection(db, "attendance"), withTenant({
            employee_id: employeeId,
            employee_name: employeeName,
            date: date || new Date().toISOString().slice(0, 10),
            check_in: null,
            check_out: null,
            status: status || "absent", // present, absent, leave, late
            method: "manual",
            note: note || "",
            check_in_lat: null,
            check_in_lng: null,
            check_in_accuracy: null,
            check_out_lat: null,
            check_out_lng: null,
            check_out_accuracy: null,
            created_at: serverTimestamp(),
        }));
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Attendance status Error: ", error);
        return { success: false, error };
    }
};

// حذف سجل حضور
export const deleteAttendanceRecord = async (attendanceId) => {
    try {
        await deleteDoc(doc(db, "attendance", attendanceId));
        return { success: true };
    } catch (error) {
        console.error("Error deleting attendance record: ", error);
        return { success: false, error };
    }
};

// جلب كل سجلات الحضور
export const getAttendanceRecords = async (companyId = null) => {
    try {
        return await fetchTenantDocs("attendance", {
            companyId,
            sortFn: (a, b) => (b.date || "").localeCompare(a.date || ""),
        });
    } catch (error) {
        console.error("Error fetching attendance: ", error);
        return [];
    }
};

// جلب سجلات حضور يوم معين
export const getAttendanceByDate = async (date, companyId = null) => {
    try {
        return await fetchTenantDocs("attendance", {
            companyId,
            filterFn: (d) => d.date === date,
            sortFn: (a, b) => {
                const timeA = a.check_in?.toMillis ? a.check_in.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.check_in?.toMillis ? b.check_in.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching attendance by date: ", error);
        return [];
    }
};

// اشتراك لحظي (Real-Time Subscription) لسجلات حضور يوم معين عبر onSnapshot
export const subscribeAttendanceByDate = (date, onData, onError) => {
    try {
        const q = createTenantQuery("attendance", where("date", "==", date));
        return onSnapshot(
            q,
            (snap) => {
                const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                // فرز حسب وقت الحضور أو وقت الإنشاء
                records.sort((a, b) => {
                    const timeA = a.check_in?.toMillis?.() || a.created_at?.toMillis?.() || 0;
                    const timeB = b.check_in?.toMillis?.() || b.created_at?.toMillis?.() || 0;
                    return timeB - timeA;
                });
                onData(records);
            },
            (error) => {
                console.error("subscribeAttendanceByDate Error: ", error);
                if (onError) onError(error);
            }
        );
    } catch (err) {
        console.error("subscribeAttendanceByDate setup error: ", err);
        if (onError) onError(err);
        return () => {};
    }
};

// جلب سجلات الحضور ضمن نطاق زمني (مثلاً لشهر كامل لحساب الراتب وساعات العمل)
export const getAttendanceByMonth = async (monthStr, companyId = null) => {
    // monthStr بصيغة YYYY-MM
    try {
        const start = `${monthStr}-01`;
        const end = `${monthStr}-31`;
        return await fetchTenantDocs("attendance", {
            companyId,
            filterFn: (d) => d.date >= start && d.date <= end,
            sortFn: (a, b) => (b.date || "").localeCompare(a.date || ""),
        });
    } catch (error) {
        console.error("Error fetching attendance by month: ", error);
        return [];
    }
};

// تعديل سجل حضور يدويًا من قبل إدارة الموارد البشرية
export const updateAttendanceRecord = async (attendanceId, updateData) => {
    try {
        const ref = doc(db, "attendance", attendanceId);
        const payload = {
            ...updateData,
            updated_at: serverTimestamp(),
        };
        await updateDoc(ref, payload);
        return { success: true };
    } catch (error) {
        console.error("Error updating attendance record: ", error);
        return { success: false, error };
    }
};

// اعتماد سجل الحضور من قبل الموارد البشرية
export const approveAttendanceRecord = async (attendanceId, { approvedBy = "HR" } = {}) => {
    try {
        const ref = doc(db, "attendance", attendanceId);
        await updateDoc(ref, {
            approved_by_hr: true,
            hr_approval_status: "approved",
            approved_by: approvedBy,
            approved_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error approving attendance record: ", error);
        return { success: false, error };
    }
};

