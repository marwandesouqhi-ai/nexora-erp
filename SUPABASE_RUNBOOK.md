# دليل التشغيل: نشر Nexora على Supabase ونقل البيانات

> يكمل `SUPABASE_MIGRATION_PLAN.md`. المشروع المستهدف: `nexora-erp` — ref `lejtflygvbakfbiwwhea`.
> الكود يعمل على Firebase افتراضيًا. التحويل إلى Supabase يتم بمتغير واحد: `VITE_BACKEND=supabase`.

## 0. ما تم وما لم يتم

| الجزء | الحالة |
|---|---|
| قاعدة البيانات (42 جدولاً + RLS + دوال RPC) | موجودة في المشروع |
| جداول التذاكر + bucket المرفقات + RLS + triggers | **طُبّقت** (`supabase/migrations/20261114000000_support_tickets.sql`) |
| Auth + طبقة البيانات + العمليات المالية + Realtime | مكتوبة خلف الـ flag |
| Edge Functions | منشورة أصلاً في المشروع (4 دوال) والتطبيقان مربوطان بعقودها |
| سكربت نقل البيانات | **مكتوب وغير مُشغَّل** — يحتاج مفاتيح Firebase (قسم 4) |
| اختبار بمستخدم حقيقي | **لم يُجرَ** |

## 1. ربط الـ CLI بمشروعك

الـ CLI على هذا الجهاز مسجَّل بحساب آخر، لذلك سجّل الدخول بحسابك:

```bash
npx supabase login
npx supabase link --project-ref lejtflygvbakfbiwwhea
```

## 2. الـ Edge Functions

المشروع فيه 4 دوال **منشورة أصلاً** (`company-invitations` و`erp-integrations` و`platform-admin` و`owner-bootstrap`). التطبيقان يستدعيانها عبر `callFunction()` وفق عقودها الفعلية. التفاصيل وطريقة تنزيل الكود في `supabase/functions/README.md`.

- لا تنشر دالة بنفس هذه الأسماء إلا إن أردت استبدال الدالة العاملة.
- الأسرار (`GEMINI_API_KEY` و`GEMINI_MODEL` و`ULTRAMSG_*` و`ERP_APP_URL` و`CRM_APP_URL`) تُضبط من لوحة Supabase > Edge Functions > Secrets.
- الدعوات: `company-invitations` يرجع رمزًا لمرة واحدة (`delivery: manual`) ويبني التطبيق رابط القبول؛ دعوات المالك وفريق المنصة تُرسل بالبريد عبر SMTP المضبوط في Supabase.
- غير مدعوم على Supabase حاليًا: إضافة مستخدم بكلمة مرور مباشرة وحذف مستخدم (استخدم الدعوة وإيقاف الحساب).
- الذكاء الاصطناعي عبر `erp-integrations` يرسل الرسالة الأخيرة فقط (بدون سجل المحادثة).

## 3. التشغيل المحلي للتجربة

في `.env.local` (للتطبيق وللـ `crm-admin`):

```
VITE_SUPABASE_URL=https://lejtflygvbakfbiwwhea.supabase.co
VITE_SUPABASE_ANON_KEY=<المفتاح العام publishable>
VITE_BACKEND=supabase
```

اختبر بالترتيب: تسجيل الدخول ← إنشاء عميل ومنتج ← بيع نقدي وآجل ← مرتجع ← تحصيل ← تذكرة دعم برفق ملف ← دعوة مستخدم.
قبل ذلك أنشئ في `profiles` مستخدمًا بصلاحية `owner` لشركة تجريبية.

## 4. نقل بيانات Firebase

```bash
cd scripts/migrate-firebase-to-supabase
npm install
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\service-account.json
set SUPABASE_URL=https://lejtflygvbakfbiwwhea.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=<service role>
npm run dry-run          # يقرأ فقط ويطبع الأعداد
npm run migrate          # يكتب (آمن للتكرار)
npm run verify           # يقارن الأعداد ومجاميع المبيعات والمخزون والأرصدة
```

- **منع التكرار:** السكربت يقرأ Supabase أولاً ويطابق الصفوف الموجودة بـ `legacy_firebase_id` (والشركات بـ `legacy_source_id`)، فيعيد استخدام معرّفاتها في الإشارات ويتخطى الصفوف الموجودة. `--update-existing` يكتب فوقها بقيم Firebase. ويتوقف السكربت إن وجد صفوفاً للشركة في الجدول لا تطابق أي معرّف قديم (`--allow-unmatched` يتجاوز الحماية). يحتاج مفتاح Supabase حقيقياً حتى في dry-run ليرى الموجود.
- المعرّفات الجديدة UUID حتمية (v5) من `collection:firestoreId`، والمعرّف القديم محفوظ في `legacy_firebase_id`.
- **كلمات المرور لا تُنقل** (Supabase لا يستورد hash فايربيس). يحصل كل مستخدم على كلمة مرور عشوائية؛ استخدم `--send-reset` أو «نسيت كلمة المرور».
- الحقول غير الموجودة كأعمدة تُحفظ في `metadata`.
- شغّل `dry-run` ثم `migrate` على نسخة تجريبية (مشروع منفصل) قبل الإنتاج، ولا تنتقل قبل أن ينجح `verify` (كود خروج 0).
- قد تحتاج تعديل `MAP` في `migrate.mjs` إن كانت لديك حقول Firestore غير مغطاة. النص الكامل للتحويل مُختبر على بيانات وهمية فقط.

## 5. قائمة التحويل النهائي (Cutover)

1. أوقف الكتابة على Firebase (قواعد read-only).
2. شغّل `migrate` ثم `verify`.
3. انشر الواجهة بـ `VITE_BACKEND=supabase` (ومتغيرات Supabase).
4. اترك Firebase قراءة فقط أسبوعين كخطة رجوع.
5. بعد الاستقرار: احذف `firebase` و`functions/` و`firestore.rules` و`storage.rules` ومتغيرات `VITE_FIREBASE_*` وملف `src/api/backend.js`.

## 6. فجوات معروفة

- `deductFromVanInventory` (بيع ميداني من عهدة المندوب): قراءة ثم تعديل غير atomic. يحتاج RPC.
- `increment()` عبر طبقة التوافق غير atomic؛ العمليات المالية كلها على RPC.
- `dashboard_stats` تُحسب عند القراءة من المبيعات والمصروفات (تقدير الربح من `cost_price`).
- لا توجد جداول لـ `messages` / `tasks` الخاصة بالـ ERP (غير مستخدمة في الكود الحالي).
- لم تُنشر الدوال ولم تُشغَّل الهجرة بعد؛ كل ما سبق لم يُختبر بمستخدم حقيقي.
