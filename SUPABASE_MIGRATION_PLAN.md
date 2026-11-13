# خطة نقل Nexora ERP من Firebase إلى Supabase

> الحالة: مسودة للمراجعة — لم يتم تنفيذ أي تغيير في الكود بعد.

## 0. الوضع الحالي (نتيجة فحص المشروع)

| المكوّن في Firebase | الحجم | البديل في Supabase |
|---|---|---|
| Firestore | ~43 collection في `firestore.rules`، ~30 ملف في `src/firebase/collections`، ~100 ملف يستورد Firebase | Postgres (جداول) |
| `firestore.rules` | 523 سطر (tenant بـ `company_id`، أدوار، super_admin، platform_staff) | Row Level Security (RLS) policies |
| `runTransaction` / `writeBatch` | 14 ملف (المبيعات، المشتريات، المرتجعات، المخزون، التحصيل، التصنيع، عربية المندوب...) | Postgres functions (RPC) |
| `increment()` | 67 استخدام | `update ... set x = x + n` داخل RPC |
| `serverTimestamp` / `Timestamp` | 216 / 19 | `default now()` + trigger لـ `updated_at`، والتواريخ تبقى ISO strings |
| `onSnapshot` (realtime) | 13 ملف في `src` + `ticketsService.ts` | Supabase Realtime (`postgres_changes`) |
| Firebase Auth + custom claims | email/password، `setCustomUserClaims` (role, company_id) | Supabase Auth + جدول `users` (profiles) + `app_metadata` |
| Cloud Functions | 17 دالة `onCall` في `functions/index.js` (850 سطر) | Edge Functions (Deno) + جزء منها Postgres RPC |
| Storage + `storage.rules` | لوجو الشركة (settings)، مرفقات الدعم الفني | Supabase Storage + storage policies |
| Firebase AI Logic + App Check | `geminiService.js` | Edge Function `ai-proxy` يحتفظ بمفتاح Gemini |
| Hosting | `dist` + SPA rewrite | ممكن يفضل على Firebase Hosting، أو Vercel/Netlify/Cloudflare Pages |
| `crm-admin` | 11 ملف (شركات، فواتير المنصة، فريق، تذاكر، مهام، audit) | نفس قاعدة Supabase، بأدوار platform |

**ميزة موجودة:** الوصول للبيانات متجمّع في `src/lib/tenantFirestore.js` و`src/services/GenericService.js` و`src/firebase/collections/*`. لو بدّلنا الطبقة دي بنفس الواجهة (API)، أغلب الصفحات هتتغير تغيير بسيط.

---

## 1. قرارات تصميم أساسية

1. **الـ IDs:** نحتفظ بـ IDs بتاعة Firestore كـ `text primary key` في جداول البيانات، عشان الإشارات بين الجداول (`customer_id`, `product_id`, `sale_id`...) تفضل سليمة وقت نقل البيانات. السجلات الجديدة تاخد `gen_random_uuid()::text`.
2. **المستخدمين:** `auth.users.id` في Supabase لازم يكون `uuid`، وFirebase UID مش uuid. فهنعمل جدول mapping (`firebase_uid → uuid`) ونعيد كتابة كل الحقول اللي بتشاور على مستخدم (`created_by`, `user_id`, `rep_id`, `employee.user_id`...) وقت النقل. ونحتفظ بعمود `firebase_uid` في `users` للمراجعة.
3. **الحقول المتداخلة:** بنود الفاتورة (`items`) والحاجات المتغيرة الشكل تفضل `jsonb` في المرحلة الأولى عشان نحافظ على نفس السلوك. ممكن نفصلها بعدين لجداول (`sale_items`...) لو احتجنا تقارير SQL أعمق.
4. **Multi-tenant:** كل جدول tenant فيه `company_id text not null references companies(id)` + index على `(company_id, created_at)`. الـ RLS هي اللي بتفرض العزل، مش الفرونت.
5. **دوال مساعدة للـ RLS** (security definer، بتقرا من جدول `users` زي `userData()` في الـ rules الحالية):
   `current_company_id()`, `current_app_role()`, `is_super_admin()`, `is_active_user()`, `is_platform_staff()`, `has_permission(text)`.
6. **العمليات المالية والمخزنية** كلها تبقى RPC في Postgres (transaction حقيقية على السيرفر) بدل ما الفرونت يعدّل المخزون والأرصدة بنفسه. ده كمان أأمن من الوضع الحالي.

---

## 2. المراحل

### المرحلة 0 — تجهيز (1–2 يوم)
- عمل commit للتغييرات الحالية غير المحفوظة في الفرع.
- إنشاء مشروع Supabase (أقرب region لمصر، مثلاً Frankfurt) + تثبيت Supabase CLI وتشغيل نسخة local بـ Docker.
- فولدر `supabase/` في الريبو: `migrations/`, `functions/`, `seed.sql`, `tests/`.
- `src/api/supabase.js` + متغيرات `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- feature flag مؤقت `VITE_BACKEND=firebase|supabase` لو عايزين نشغّل الاتنين جنب بعض أثناء التطوير.

### المرحلة 1 — الـ Schema (3–5 أيام)
- migration لكل collection: الأعمدة المستخدمة فعلاً في الكود + `extra jsonb` للحقول النادرة.
- ترتيب الجداول حسب الاعتماد: `companies` → `users` → `employees`, `customers`, `suppliers`, `products`, `accounts` → `sales`, `purchases`, `returns`, `debts`, `receipts`, `expenses`, `inventory_*`, `van_inventory`, `production_orders` → `visits`, `attendance`, `field_*`, `daily_reconciliations`, `payroll_adjustments`, `salary_payments` → `notifications`, `activity_logs`, `audit_logs`, `support_tickets`, `messages` → جداول `platform_*` و`invitations`.
- تحويل `firestore.indexes.json` لـ indexes في Postgres.
- trigger عام لـ `updated_at`، و`created_at default now()`.
- توليد types (`supabase gen types`) للاستخدام في `crm-admin` (TypeScript).

### المرحلة 2 — RLS والصلاحيات (4–6 أيام) ⚠️ أهم مرحلة أمنياً
- ترجمة الـ 523 سطر rules لـ policies، collection بـ collection، مع نفس منطق: المستخدم النشط، الأدوار، `permission_overrides`، super_admin، فصل platform_staff عن مستخدمي الشركات.
- `storage.rules` → policies على buckets: `company-assets`، `support-attachments`، والمسار يبدأ بـ `company_id/`.
- **اختبارات pgTAP إجبارية:** مستخدم شركة A ما يقدرش يقرا/يكتب بيانات شركة B، المندوب ما يقدرش يوصل لصلاحيات المدير، المستخدم الموقوف ممنوع، إلخ.

### المرحلة 3 — Auth (3–4 أيام)
- `AuthContext.jsx`: `onAuthStateChanged` → `supabase.auth.onAuthStateChange`، و`signInWithEmailAndPassword` → `signInWithPassword`، و`updatePassword` → `auth.updateUser`.
- `Login.jsx`, `ProtectedRoute.jsx`, `UserNotRegisteredError.jsx`, `TopBar.jsx`, `AcceptInvitation.jsx`, و`crm-admin/src/contexts/AuthContext.tsx`.
- custom claims → `app_metadata` (role, company_id) بتتحط من Edge Function بمفتاح service role. والـ RLS يعتمد على جدول `users` كمصدر أساسي عشان التغيير في الصلاحيات يسري فوراً.
- إعداد SMTP في Supabase لإيميلات reset والدعوات.

### المرحلة 4 — طبقة البيانات (8–12 يوم) — أكبر مرحلة
- `tenantFirestore.js` → `tenantDb.js` بنفس الدوال (`withTenant`, `fetchTenantDocs`, `addTenantDoc`, ...) فوق `supabase.from(...)`.
- `GenericService.js` يتعدل على الطبقة الجديدة.
- كل ملف في `src/firebase/collections/*` يتنقل لـ `src/data/*` (أو نفس الاسم) بنفس التوقيعات.
- **RPC functions** بدل الـ transactions (أهمها):
  `create_sale`, `cancel_sale` / `update_sale`, `create_purchase`, `create_return`, `record_receipt` / `pay_debt`, `apply_inventory_adjustment`, `complete_production_order`, `transfer_to_van` / `deduct_van_inventory`, `approve_field_expense`, `apply_payroll_adjustment`, `create_expense`, `mark_notifications_read`، ودوال `assistantInvoiceService`.
  كل دالة: تتأكد من الشركة والصلاحية، تقفل الصفوف (`for update`)، تتحقق من المخزون، وتكتب الحركة في `inventory_movements` و`activity_logs`.
- الصفحات اللي بتستورد Firestore مباشرة (مثلاً `Attendance.jsx`, `DailyMonitoring.jsx`, `FinancialOverview.jsx`, `Purchases.jsx`, `StockDisbursement.jsx`, `ActivityLog.jsx`...) تتعدل عشان تستخدم طبقة البيانات بدل الاستيراد المباشر.
- التواريخ: تعديل `parseTimestampDate` وأي `.toDate()` يتعامل مع ISO strings.
- **Realtime:** الـ 14 ملف اللي فيهم `onSnapshot` → `supabase.channel(...).on('postgres_changes', { filter: 'company_id=eq.X' })` مع تفعيل publication للجداول دي بس.
- `crm-admin/src/services/*` (11 ملف).

### المرحلة 5 — Cloud Functions → Edge Functions (5–7 أيام)
| الدالة الحالية | البديل |
|---|---|
| `createManagedUser`, `updateManagedUser`, `updateManagedUserSecure`, `deleteManagedUser` | Edge Function `manage-users` (service role + `auth.admin`) |
| `createInvitation`, `resendInvitation`, `revokeInvitation`, `listManagedInvitations` | Edge Function `invitations` (+ إرسال الإيميل SMTP/Resend) |
| `verifyInvitation`, `acceptInvitation` | Edge Function (لأنها بتنشئ مستخدم Auth) |
| `sendWhatsappMessage`, `checkWhatsappConnection` | Edge Function `whatsapp` (UltraMsg) + secrets |
| `recordAuthenticationEvent` | RPC بسيطة أو insert مع RLS |
| `provisionPlatformStaff`, `updatePlatformStaff`, `suspendPlatformStaff`, `provisionCompany` | Edge Function `platform-admin` |
- الفرونت: `httpsCallable(functions, 'x')` → `supabase.functions.invoke('x')`.
- `geminiService.js`: Firebase AI Logic → Edge Function `ai-proxy` (المفتاح على السيرفر، مع rate limit لكل مستخدم/شركة). App Check مالوش بديل مباشر، والحماية هتبقى بالـ JWT والـ rate limit.

### المرحلة 6 — نقل البيانات (3–5 أيام، شاملة التجارب)
- سكربت Node في `scripts/migrate-firebase-to-supabase/`:
  1. Export من Firestore بـ `firebase-admin` (كل collection → JSON).
  2. Export مستخدمين Auth (`firebase auth:export` مع الـ password hashes).
  3. إنشاء المستخدمين في Supabase وبناء جدول mapping للـ UIDs.
  4. تحويل: Timestamps → `timestamptz`، UIDs → uuid، الحقول → أعمدة/`extra`.
  5. Insert بالترتيب حسب الـ foreign keys، بمفتاح service role.
  6. نقل ملفات Storage بنفس المسارات.
- **كلمات السر:** نجرب استيراد hashes بتاعة Firebase (scrypt) في Supabase Auth. لو ما نفعش، نبعت لكل المستخدمين إيميل reset قبل التحويل. القرار ده لازم يتحسم بتجربة في المرحلة 0.
- **التحقق:** مقارنة عدد السجلات لكل جدول، ومجاميع (إجمالي المبيعات، الديون، أرصدة المخزون لكل منتج) بين المصدر والهدف، لكل شركة.
- عمل dry-run كامل أكتر من مرة على بيئة staging.

### المرحلة 7 — اختبار وتحويل نهائي (3–5 أيام)
- اختبار يدوي لكل موديول بالأدوار المختلفة (مدير، محاسب، مندوب، super_admin، platform staff).
- **Cutover:**
  1. إعلان فترة توقف قصيرة (ساعة إلى ساعتين).
  2. وقف الكتابة على Firebase (rules read-only).
  3. تشغيل النقل النهائي + التحقق.
  4. نشر الفرونت على Supabase.
- Firebase يفضل read-only أسبوعين كخطة رجوع.
- بعد الاستقرار: حذف `firebase` و`functions/` و`firestore.rules` من الريبو.

---

## 3. التقدير الإجمالي
تقريباً **6–9 أسابيع لمطوّر واحد**. المراحل 4 و2 هم أكتر حاجة ممكن تزوّد الوقت. ده تقدير مبدئي ويتظبط بعد المرحلة 1.

## 4. المخاطر
- **ثغرات في RLS** = تسريب بيانات بين الشركات → اختبارات pgTAP شرط قبل أي نشر.
- **أخطاء في منطق المخزون/الحسابات** أثناء نقل الـ transactions لـ RPC → اختبارات على كل RPC بسيناريوهات حقيقية.
- **إعادة ربط الـ UIDs** لو فات حقل بيشاور على مستخدم، البيانات هتبان من غير صاحبها → جرد كامل لحقول المستخدمين قبل كتابة السكربت.
- **كلمات السر** (شوف المرحلة 6).
- **التغييرات الجارية في الفرع ده:** لازم تستقر قبل البدء عشان ما نحوّلش كود بيتغير.

## 5. قرارات مطلوبة منك
1. الاستضافة: نفضل على Firebase Hosting ولا ننقل (Vercel/Netlify/Cloudflare)؟
2. بنود الفواتير: `jsonb` الأول (أسرع) ولا جداول منفصلة من البداية (أحسن للتقارير)؟
3. لو استيراد كلمات السر ما نفعش: مقبول نبعت reset لكل المستخدمين؟
4. مدة التوقف المقبولة وقت التحويل النهائي؟
5. فيه بيانات production حقيقية دلوقتي ولا لسه بيانات تجريبية؟ (لو تجريبية، المرحلة 6 بتتبسط جداً.)
