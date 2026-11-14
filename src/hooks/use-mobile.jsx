import * as React from "react"
import { db } from "@/api/firebase"
import { doc, updateDoc } from '@/data/firestoreCompat'
import { useAuth } from "@/lib/AuthContext"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    )
    const { user } = useAuth()

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

        const updateDeviceStatus = async (mobileStatus) => {
            setIsMobile(mobileStatus)

            // لو فيه مستخدم سجل دخول، نحدث حالته في فايرستور
            if (user?.uid) {
                try {
                    const userDoc = doc(db, "users", user.uid)
                    await updateDoc(userDoc, {
                        last_device: mobileStatus ? "Mobile" : "Desktop",
                        last_active: new Date().toISOString()
                    })
                } catch (error) {
                    console.error("Error syncing device status:", error)
                }
            }
        }

        const onChange = () => {
            updateDeviceStatus(window.innerWidth < MOBILE_BREAKPOINT)
        }

        mql.addEventListener("change", onChange)

        return () => mql.removeEventListener("change", onChange)
    }, [user?.uid]) // نراقب الـ UID عشان لو سجل دخول نحدث البيانات

    return isMobile
}