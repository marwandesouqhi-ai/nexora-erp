# تقرير التدقيق الشامل للمشاكل والخلل البرمجي — Nexora ERP

تاريخ التقرير: 15 سبتمبر 2026  
نطاق الفحص: مساعد الذكاء الاصطناعي (AI Assistant)، تكامل Firebase AI Logic (Gemini API)، محرك النوايا (Intent Engine)، العمليات المالية والمخزنية، وإدارة الصلاحيات وقواعد البيانات.

---

## 📌 الفهرس
1. [الملخص التنفيذي](#-الملخص-التنفيذي)
2. [المشاكل الحرجة (P0) — تهدد التوفر وسلامة البيانات](#-المشاكل-الحرجة-p0--تهدد-التوفر-وسلامة-البيانات)
3. [المشاكل العالية (P1) — أخطاء وظيفية وتضارب منطقي](#-المشاكل-العالية-p1--أخطاء-وظيفية-وتضارب-منطقي)
4. [المشاكل المتوسطة (P2) — أداء وكفاءة الاستعلامات](#-المشاكل-المتوسطة-p2--أداء-وكفاءة-الاستعلامات)
5. [المشاكل الطفيفة والتحسينات (P3) — تجربة المستخدم والتوثيق](#-المشاكل-الطفيفة-والتحسينات-p3--تجربة-المستخدم-والتوثيق)
6. [خطة المعالجة والإصلاح المقترحة](#-خطة-المعالجة-والإصلاح-المقترحة)

---

## 📋 الملخص التنفيذي

أظهر الفحص الدقيق للشفرة المصدرية وجود عدة مشاكل جذرية تتراوح بين **تعطل كامل لخدمة الذكاء الاصطناعي** بسبب أسماء نماذج غير صالحة وأخطاء السعة (503 Capacity Errors)، و**إخفاء أخطاء الاتصال** بـ Firestore وإيهام المستخدم ببيانات مالية صفرية، بالإضافة إلى **تضارب بين الميزات المعلنة في واجهة المساعد وبين التنفيذ الفعلي**، وحالات سباق (Race Conditions) وتكرار في تسوية المخزون والديون عند تعديل أو حذف الفواتير عبر المساعد.

---

## 🚨 المشاكل الحرجة (P0) — تهدد التوفر وسلامة البيانات

### 1. تسمية نموذج Gemini غير صحيحة وجمود التهيئة (Invalid Model Name & Hardcoding)
- **الموقع:** [`src/services/geminiService.js:23`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js#L23)
- **وصف المشكلة:** 
  تم تثبيت اسم النموذج كنص ثابت:
  ```javascript
  const GEMINI_MODEL = 'gemini-3.8-flash';
  ```
  في واجهات برمجة تطبيقات Google AI وFirebase AI Logic، لا يوجد نموذج رسمي بهذا الاسم (النماذج الرسمية هي `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`). هذا يؤدي مباشرة إلى أخطاء استدعاء مثل `404 Not Found` أو أخطاء السعة `503 Unavailable: No capacity available`.
- **الأثر:**
  فشل كامل لجميع استدعاءات الذكاء الاصطناعي، وتحول المساعد فوراً إلى الوضع المحلي المحدود (Fallback)، أو ظهور رسائل أخطاء منفرة للمستخدم.
- **الحل الجذري:**
  1. جعل اسم النموذج يقرأ من متغيرات البيئة مع قيمة افتراضية مستقرة:
     ```javascript
     const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
     ```
  2. توفير آلية Model Fallback تلقائية (Fallback Chain): إذا فشل النموذج الأساسي برمز 503 أو 404، يتم تجربة نموذج رديف تلقائياً قبل التحول للردود الثابتة.

---

### 2. ضعف التعامل مع أخطاء السعة والضغط (503 UNAVAILABLE & Retry Storm)
- **الموقع:** [`src/services/geminiService.js:137-185`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js#L137-L185)
- **وصف المشكلة:** 
  عند حدوث خطأ سعة (`503 No capacity available`)، يقوم الكود بمحاولة إعادة واحدة فقط بعد تأخير ثابت قدره 1.2 ثانية (`await sleep(1200)`). وإذا فشلت المحاولة، ينتقل فوراً إلى `catch` حيث يحاول استدعاء `_model.generateContent` لنفس النموذج المشغول وبنفس اللحظة!
- **الأثر:**
  استدعاء مزدوج لنموذج غير متاح يفاقم الضغط ويؤخر ظهور الرد الاحتياطي للمستخدم دون أي فائدة.
- **الحل الجذري:**
  - تطبيق تراجع أسي (Exponential Backoff with Jitter).
  - عند اكتشاف خطأ 503، التبديل مباشرة لنموذج بديل أو إرجاع رسالة إرشادية واضحة فوراً دون تكرار الاستدعاء الفاشل.

---

### 3. إخفاء أخطاء Firestore وإظهارها كبيانات فارغة (Silent Data Masking)
- **الموقع:** [`src/services/assistantDataService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantDataService.js)
  - `getLowStockProducts` (الأسطر 67-70)
  - `getPendingDebts` (الأسطر 125-128)
  - `getSalesSummary` (الأسطر 194-197)
  - `getExpensesSummary` (الأسطر 253-256)
  - `getCashflowSummary` (الأسطر 282-285)
- **وصف المشكلة:**
  كافة دوال الاستعلام داخل `assistantDataService` تلتقط أي خطأ (`catch (err)`) وتعيد مصفوفات فارغة `[]` أو أرقاماً صفرية `{ count: 0, total: 0 }` دون إشعار الطبقة العليا بحدوث خلل.
- **الأثر:**
  إذا حدث انقطاع في الاتصال بالإنترنت، أو انتهت جلسة تسجيل الدخول، أو رفضت قواعد Firestore (Security Rules) الاستعلام بسبب الصلاحيات، سيخبر المساعد صاحب العمل: **"لا توجد أصناف منخفضة المخزون حالياً"** أو **"لا توجد ديون مستحقة"** أو **"المبيعات اليوم: 0"**، وهو تضليل محاسبي وإداري جسيم قد يسبب خسائر للمنشأة.
- **الحل الجذري:**
  إرجاع كائن يحتوي على حالة النجاح والخطأ:
  ```javascript
  return { success: false, error: err.message, data: [] };
  ```
  بحيث تُميز طبقة المساعد بين "لا توجد ديون فعلاً" وبين "تعذر الاتصال بقاعدة البيانات لجلب الديون".

---

### 4. خلل مضاعفة المخزون وفقدان القيود في حذف وتعديل الفواتير
- **الموقع:** [`src/services/assistantInvoiceService.js:107-158`](file:///c:/Users/Glory/nexora-erp/src/services/assistantInvoiceService.js#L107-L158)
- **وصف المشكلة:**
  1. **حذف فاتورة مسترجعة:** عند استدعاء `deleteSaleByInvoiceNumber`، يتم إعادة كميات أصناف الفاتورة إلى المخزون دون التحقق مما إذا كانت الفاتورة قد أُرجع جزء منها أو كلها مسبقاً (`returned_amount > 0`). في حال كانت مسترجعة وتم حذفها، ستتم إضافة البضاعة مرتين للمخزون!
  2. **تحديث مبالغ الديون:** في `updateSaleByInvoiceNumber` (الأسطر 83-88)، عند تعديل `paid_amount`، يتم تحديث كافة مستندات `debts` المرتبطة بـ `source_id` بنفس القيمة الجديدة دفعة واحدة دون مراعاة ما إذا كان هناك أقساط أو سجلات متعددة لنفس المعاملة.
- **الأثر:**
  تلف في أرصدة المخزون والدفاتر المحاسبية للعملاء والديون.
- **الحل الجذري:**
  - التحقق من `returned_amount === 0` قبل السماح بالحذف، أو خصم الكميات المسترجعة فقط.
  - إيقاف إمكانية الحذف الكامل للفواتير بعد الترحيل، واستبدالها بنظام قيود الإلغاء (Void/Reversal) المحاسبية المعتمدة.

---

## ⚠️ المشاكل العالية (P1) — أخطاء وظيفية وتضارب منطقي

### 5. تضارب الميزات المعلنة للمساعد مع النوايا المحظورة
- **الموقع:** 
  - [`src/services/aiAssistantService.js:267-272`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js#L267-L272)
  - [`src/services/aiAssistantService.js:416-417`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js#L416-L417)
- **وصف المشكلة:**
  في دالة المساعدة `buildHelpText`، يعلن المساعد للمستخدم صراحة:
  - `➕ إضافة عميل جديد`
  - `📝 تسجيل مصروف`
  بينما في دالة `executeIntent` يتم اعتراض هاتين النيتين وإلغاؤهما تماماً:
  ```javascript
  case INTENTS.ADD_CUSTOMER:
  case INTENTS.RECORD_EXPENSE:
      return {
          directReply: 'عمليات الكتابة من خلال المساعد غير مفعلة حاليًا. لم يتم إجراء أي تغيير على البيانات.',
      };
  ```
- **الأثر:**
  إحباط المستخدم وتناقض التجربة، حيث يعد المساعد بإمكانية تنفيذ أوامر ثم يرفضها بمجرد كتابتها.
- **الحل الجذري:**
  إما تنفيذ العمليتين بصورة آمنة مع طلب التأكيد عبر `buildGuardrailDecision`، أو حذفها نهائياً من رسالة المساعدة واقتراحات الواجهة حتى اكتمال تطويرهما.

---

### 6. انفصال نظام الحواجز الأمنية (Guardrails) عن مسار المحادثة الفعلي
- **الموقع:** [`src/services/aiAssistantService.js:42-60`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js#L42-L60) و [`src/services/aiAssistantService.js:309-355`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js#L309-L355)
- **وصف المشكلة:**
  تم بناء دوال للحراسة وتأكيد الأفعال `buildGuardrailDecision` و `runAssistantAction`، لكن المسار الرئيسي الذي تستخدمه الواجهة `runAssistantMessage` لا يمرر النوايا عبر هذا النظام. بدلاً من ذلك، تم وضع تحقق سطحي باستخدام تعبير نمطي للبحث عن كلمة "تأكيد" (`/(?:تأكيد|أكد|موافق|confirm)/i`).
- **الأثر:**
  إذا احتوت رسالة المستخدم صدفة على كلمة "موافق" أو "أكد" أثناء استفساره العادي عن تعديل فاتورة، فقد يُعتبر ذلك تأكيداً تلقائياً وينفذ الإجراء فوراً دون معاينة مسبقة.
- **الحل الجذري:**
  ربط `runAssistantMessage` بنظام حوار تفاعلي ذو مرحلتين (Stateful Confirmation Step) يتم تخزينه في الـ state أو مرجعية الرسالة.

---

### 7. غياب التحقق من صلاحيات تفصيلية في إنشاء وتعديل الفواتير عبر المساعد
- **الموقع:** [`src/services/aiAssistantService.js:171`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js#L171) و [`src/services/assistantInvoiceService.js:188`](file:///c:/Users/Glory/nexora-erp/src/services/assistantInvoiceService.js#L188)
- **وصف المشكلة:**
  في `createInvoiceFromCommand`، يتم إنشاء فاتورة مبيعات بدون تحديد `customer_id` (يُعين دائماً `null`) وبطريقة دفع نقدية `cash` دون تحديد الخزينة/الحساب المستلم (`account_id = null`).
- **الأثر:**
  إنشاء فواتير معلقة لا ترتبط بحساب مالي في جدول الحسابات (`accounts`) ولا تسجل تدفقاً نقدياً دقيقاً في الـ `cashflow`، مما يؤدي إلى عدم توازن ميزان المراجعة وحسابات الخزينة.
- **الحل الجذري:**
  طلب اختيار الحساب أو الخزينة الافتراضية، وربط الفاتورة بالعميل المحدد من قاعدة البيانات إن وجد.

---

## ⚡ المشاكل المتوسطة (P2) — أداء وكفاءة الاستعلامات

### 8. استعلامات كاملة وجلب غير محدود من Firestore إلى ذاكرة المتصفح
- **الموقع:** [`src/services/assistantDataService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantDataService.js)
  - `getPendingDebts`:
    ```javascript
    const snap = await getDocs(collection(db, 'debts'));
    ```
    يتم جلب **كامل مجموعة الديون** للمتصفح ثم تصفيتها بالـ JavaScript!
  - `getLowStockProducts`: يجلب حتى 200 منتج في كل مرة يُفتح فيها المساعد.
  - `getSalesSummary`: يجلب حتى 500 فاتورة مبيعات في الذاكرة لحساب الإجمالي.
- **الأثر:**
  1. استهلاك ضخم لحصص القراءة في Firebase (Firestore Reads Billing).
  2. بطء شديد في فتح المساعد واستهلاك الذاكرة للأجهزة الضعيفة عند نمو البيانات لآلاف السجلات.
- **الحل الجذري:**
  - استخدام استعلامات محددة بالفهارس: `query(collection(db, 'debts'), where('remaining_amount', '>', 0), orderBy('remaining_amount', 'desc'), limit(15))`.
  - الاعتماد على وثائق التجميع الإحصائي المسبق (`dashboard_stats` أو `daily_summaries`) بدلاً من قراءة مئات الفواتير لحساب المجموع يدوياً.

---

### 9. غياب حماية طول المدخلات وتكرار الطلبات (Rate Limiting & Token Overflow)
- **الموقع:** [`src/components/shared/AiAssistantPanel.jsx:110-188`](file:///c:/Users/Glory/nexora-erp/src/components/shared/AiAssistantPanel.jsx#L110-L188)
- **وصف المشكلة:**
  لا يوجد أي تقييد لطول نص الرسالة المدخلة في حقل المحادثة (`textarea`). كما يتم إرسال تاريخ المحادثة بالكامل دون حساب لعدد الرموز (Token Count).
- **الأثر:**
  إمكانية قيام المستخدم بنسخ نصوص ضخمة تؤدي إلى تجاوز حد نافذة السياق (Context Window) أو استنزاف حصة الـ API وتكلفة إضافية غير مبررة.
- **الحل الجذري:**
  وضع حد أقصى للحقل (مثلاً 1,000 حرف)، وتقلييم تاريخ المحادثة تلقائياً (Trimming & Pruning).

---

### 10. عدم تحديث بيانات المساعد تلقائياً مع العمليات الخارجية (Stale Context)
- **الموقع:** [`src/components/shared/AiAssistantPanel.jsx:70-100`](file:///c:/Users/Glory/nexora-erp/src/components/shared/AiAssistantPanel.jsx#L70-L100)
- **وصف المشكلة:**
  يتم جلب بيانات ملخص اليوم (`getDailySummaryReport`) لمرة واحدة فقط عند فتح المساعد (`useEffect` أولي). إذا تمت عملية بيع أو تسجيل مصروف أو توريد في صفحة أخرى، تظل بيانات المساعد قديمة حتى يضغط المستخدم يدوياً على زر التحديث أو إعادة فتح الصفحة.
- **الأثر:**
  ردود المساعد والبطاقات العلوية تعرض أرقاماً قديمة لا تعكس الواقع الفوري.
- **الحل الجذري:**
  ربط المساعد بـ Listener عبر `onSnapshot` للملخصات الحيوية، أو إضافة مؤقت زمني خفيف لإعادة التحديث.

---

## 🔍 المشاكل الطفيفة والتحسينات (P3) — تجربة المستخدم والتوثيق

### 11. محرك النوايا المحلي يعتمد على مطابقة الأنماط (Regex) فقط
- **الموقع:** [`src/services/intentEngine.js:39-165`](file:///c:/Users/Glory/nexora-erp/src/services/intentEngine.js#L39-L165)
- **وصف المشكلة:**
  الاعتماد فقط على Regex قد يفشل مع اللهجات المتنوعة أو الأخطاء الإملائية الشائعة (مثل التبديل بين "ة" و "ه" أو "ي" و "ى").
- **الحل الجذري:**
  تطبيع النصوص العربية (Arabic Text Normalization: إزالة التشكيل، توحيد الهمزات والياءات) قبل الفحص بالأنماط.

### 12. عدم وجود واجهة إرشادية عند غياب إعداد App Check
- **الموقع:** [`src/services/geminiService.js:35-40`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js#L35-L40)
- **وصف المشكلة:**
  عندما لا يتم ضبط `appCheck`، تكتفي الخدمة بطباعة تحذير في وحدة التحكم `console.warn`، بينما يرى المستخدم العادي فقط شارة "Gemini غير متاح" دون معرفة كيفية تفعيل الخدمة أو المتغير المطلوب في `.env`.
- **الحل الجذري:**
  إظهار تنبيه توجيهي مخصص للمشرفين (Admins) يوضح الحاجة لضبط مفتاح `VITE_FIREBASE_APPCHECK_SITE_KEY`.

---

## 🛠️ جدول ملخص المشاكل والأولويات

| رقم | المشكلة | الملف المعني | الأولوية | الحالة |
|:---|:---|:---|:---:|:---:|
| 1 | اسم النموذج `gemini-3.8-flash` غير موجود في API | [`geminiService.js`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js) | **P0** | بحاجة لإصلاح فوري |
| 2 | تكرار فاشل لأخطاء السعة 503 وإجهاد النموذج | [`geminiService.js`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js) | **P0** | بحاجة لإصلاح فوري |
| 3 | إخفاء أخطاء قراءة Firestore وعرض بيانات صفرية | [`assistantDataService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantDataService.js) | **P0** | بحاجة لإصلاح فوري |
| 4 | مخاطر حذف فواتير مرتجعة وتعديل مبالغ الديون | [`assistantInvoiceService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantInvoiceService.js) | **P0** | بحاجة لإصلاح فوري |
| 5 | الإعلان عن إضافة عميل ومصروف مع حظرها بالكود | [`aiAssistantService.js`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js) | **P1** | بحاجة لمطابقة وتصحيح |
| 6 | الحواجز الأمنية (Guardrails) غير مفعلة في مسار الشات | [`aiAssistantService.js`](file:///c:/Users/Glory/nexora-erp/src/services/aiAssistantService.js) | **P1** | بحاجة لربط منطقي |
| 7 | غياب ربط الخزينة والعميل في فواتير المساعد | [`assistantInvoiceService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantInvoiceService.js) | **P1** | بحاجة لضبط مالي |
| 8 | استعلامات تقرأ آلاف المستندات للذاكرة (Debts/Products) | [`assistantDataService.js`](file:///c:/Users/Glory/nexora-erp/src/services/assistantDataService.js) | **P2** | تحسين أداء |
| 9 | غياب حد أقصى لطول الرسائل وعدد الطلبات | [`AiAssistantPanel.jsx`](file:///c:/Users/Glory/nexora-erp/src/components/shared/AiAssistantPanel.jsx) | **P2** | تحسين حماية |
| 10 | البيانات اللحظية تصبح قديمة (Stale Context) | [`AiAssistantPanel.jsx`](file:///c:/Users/Glory/nexora-erp/src/components/shared/AiAssistantPanel.jsx) | **P2** | تحسين تحديث |
| 11 | حساسية Regex للأخطاء الإملائية العربية | [`intentEngine.js`](file:///c:/Users/Glory/nexora-erp/src/services/intentEngine.js) | **P3** | تحسين لغوي |
| 12 | غياب إرشاد واجهة المشرف عند نقص App Check | [`geminiService.js`](file:///c:/Users/Glory/nexora-erp/src/services/geminiService.js) | **P3** | تحسين تجربة |

---

## 🎯 خطة العمل المقترحة للمعالجة

1. **المرحلة الأولى: إصلاح توفر نموذج الذكاء الاصطناعي (P0)**
   - استبدال الاسم الثابت بنموذج قياسي معتمد مثل `gemini-1.5-flash` أو قراءته من `VITE_GEMINI_MODEL`.
   - إصلاح معالجة أخطاء 503 لتقديم رسالة اعتذار سريعة ومباشرة دون إجهاد السيرفر بمحاولات تكرار متطابقة.
2. **المرحلة الثانية: دقة وأمان البيانات (P0 & P1)**
   - تعديل `assistantDataService` ليُفرّق بين الأخطاء وبين البيانات الفارغة.
   - حماية حذف الفواتير والتأكد من عدم مضاعفة المخزون عند وجود مرتجعات.
   - مزامنة نص المساعدة مع الوظائف المفعلة فعلياً لمنع تضليل المستخدم.
3. **المرحلة الثالثة: تحسين الاستعلامات والأداء (P2)**
   - تفعيل فهارس وتحديد قيود الاستعلامات في `debts` والمخزون بدلاً من القراءة العشوائية.
   - إضافة قيود الإدخال والـ Validation في واجهة المستخدم.
