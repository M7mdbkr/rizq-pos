# رزق — Rizq POS

> 📘 لخطوات التحميل والتشغيل على أي جهاز: راجع **[دليل التشغيل](دليل-التشغيل.md)**.

نظام الكاشير الفاخر للمطاعم السعودية. تطبيق ويب محلي يعمل دون اتصال (offline-first) باستخدام قاعدة بيانات SQLite داخل المتصفح.

A luxury, offline-first POS for Saudi restaurants. Arabic RTL, dark/gold theme, zero external services.

## المزايا / Features

- **شاشة دخول** برمز PIN من 8 أرقام (مالك / كاشير).
- **واجهة الكاشير:** شبكة أصناف بالفئات، سلة طلب، تعديل الأسطر (كمية/ملاحظة/سعر)، صنف مخصص، نوع الطلب (محلي/سفري/توصيل)، أكواد خصم، طرق دفع قابلة للتسمية (نقدًا/كيتا/مرسول/نينجا)، احتساب الضريبة، وطباعة فاتورة + تذكرة مطبخ.
- **المساعد الذكي (المالك):** يجيب على الأسئلة وينفّذ أوامر بصلاحيات كاملة (تعديل الأسعار، التخزين، إعادة التسمية، إنشاء الخصومات، ضبط الضريبة…).
- **إعدادات قابلة للتعديل بالكامل:** بيانات المتجر، الشعار، نسبة الضريبة، أسماء طرق الدفع، حجم ورق الطابعة الحرارية وعدد نسخ الفاتورة.
- **لوحة تحكم المالك:** ملخص اليوم، مبيعات بالساعة، توزيع طرق الدفع، تنبيهات المخزون.
- **التحليلات:** رسوم بيانية أسبوعية، الأكثر مبيعًا، هوامش الربح، بيانات العملاء، ورؤى ذكية مشتقة من البيانات.
- **إدارة المخزون:** إضافة/تعديل/حذف أصناف وفئات، إعادة تخزين، تنبيهات الحد الأدنى.
- **الخصومات:** أكواد نسبة مئوية أو مبلغ ثابت مع صلاحية وحد استخدام.
- **المحاسبة:** دفتر يومية، تقارير ضريبية، وتصدير إلى Excel.
- **الإعدادات:** إدارة الموظفين، تفعيل طرق الدفع، الوضع الداكن/الفاتح، إعادة تهيئة البيانات.

## التقنيات / Stack

React 18 + TypeScript · Tailwind CSS (RTL) · sql.js (SQLite in-browser, persisted to IndexedDB) · Recharts · SheetJS (xlsx).

## التشغيل / Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

### بيانات الدخول التجريبية / Demo logins

| الدور | الرمز |
|------|------|
| مالك (Owner) | `12345678` |
| كاشير (Staff) | `11112222` |
| كاشير (Staff) | `33334444` |

> البيانات التجريبية (أصناف + 30 يومًا من الطلبات) تُزرع تلقائيًا عند أول تشغيل، وتُحفظ في IndexedDB. لإعادة التهيئة: الإعدادات ← إعادة تهيئة جميع البيانات.

## ملاحظة بيئة البناء / Build environment note

This machine has no system-wide `node`/`npm` on PATH. The dev/build commands here were run with the Node runtime bundled in `Kimi.app` (it can load the native Rollup/Rolldown addon that Vite 8 needs). The Codex.app node is hardened-signed and **cannot** dlopen native addons, so it fails the build. `.claude/launch.json` points the preview server at the Kimi node. If you install a normal Node.js (≥ 20), the standard `npm run dev` / `npm run build` will work directly.

## الطباعة / Printing

عند تأكيد الطلب تظهر الفاتورة؛ زر «طباعة الفاتورة» يستخدم طباعة المتصفح (`window.print()`) مع تنسيق مخصص للإيصال. لطباعة شبكة محلية بين iPad و PC، وجّه الجهازين إلى نفس عنوان IP المحلي لخادم Vite (`--host`).

## المراحل القادمة / Roadmap

Phase 2: مزامنة سحابية (Railway) · Phase 3: بوت Telegram للتقارير · Phase 4: بوت WhatsApp للطلبات.
