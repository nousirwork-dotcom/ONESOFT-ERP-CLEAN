# ZATCA Simulation / Production Parity Matrix

هذا التقرير يراجع المتطلبات الواردة في
`attached_assets/Pasted--Fatoora-Simulation--1786091174331_1786091174332.txt`.

## الحالة العامة

Simulation وProduction يستخدمان نفس طبقات الهوية، السياق، النقل، وبناء XML
والتوقيع. اتصال Production الخارجي ما زال محجوبًا عمدًا، ولذلك فإن عمود
Production يميّز بين الجاهزية المحلية/Mock وبين التنفيذ الخارجي الفعلي.

| الإصلاح | Simulation | Production | الخدمة المشتركة | الاختبار |
|---|---|---|---|---|
| Schema 0083/0084/0085 | ✓ | ✓ نفس Drizzle schema والنسخة المطلوبة `0085_zatca_pos_unit_identity` | `schema.ts` + migrations | ✓ schema version/runtime check |
| POS identity | ✓ | ✓ Mock/local، مع حظر الاتصال الخارجي | `zatcaPosUnitIdentity` + `generatePosUnitCsr` | ✓ نفس CN وEGS Serial |
| Common Name | ✓ من `posUnit` | ✓ Mock/local من نفس `posUnit` | `getCsrIdentityForUnit` | ✓ `POS-001` في CSRين |
| EGS Serial | ✓ محفوظ وثابت | ✓ Mock/local نفس القيمة | `zatcaPosUnitIdentity` | ✓ لا تتغير بين البيئتين |
| إنشاء الوحدة وربط الدفاتر | ✓ | ✓ نفس mutation، لا تعتمد على البيئة | `createPosUnit` transaction | ✓ source/identity tests |
| إنشاء Device/CSR عند حفظ الوحدة | لا يُنشأ تلقائيًا | لا يُنشأ تلقائيًا | `createPosUnit` | ✓ المسار منفصل عن CSR |
| OTP | Simulation فقط حاليًا، في الذاكرة ولا يُسجل | لا يوجد endpoint Production | `postFatoora` يحمل البيئة صراحة | ✓ عدم تخزين/تسجيل OTP |
| CSR builder | ✓ فعلي | ✓ Mock/local فعلي | `generatePosUnitCsr` | ✓ CSR محليان متطابقا الهوية |
| Private Key | محفوظ مشفرًا ولا يعاد للواجهة | لا يوجد مسار Production خارجي | `zatcaKeys` + redaction | ✓ redaction tests |
| Compliance `body.requestID` | ✓ فقط | ✓ القاعدة مشتركة وجاهزة | `extractComplianceRequestId` | ✓ يرفض transport/body.requestId |
| Compliance CSID selection | ✓ CSR جديد `pending_otp` فقط؛ Operational CSID يختار `compliance_received` فقط | Production غير مفعّل خارجيًا | `zatcaCsrRequests` status guards + context/device/certificate joins | ✓ يمنع إعادة استخدام CSR من محاولة فاشلة |
| XML/Profile/InvoiceType | ✓ | ✓ Mock/local عبر نفس المحرك | `buildAndSignZatcaInvoice` | ✓ type-code/XML tests |
| seller/buyer address | ✓ | ✓ نفس builder عند فتح النقل | `zatcaInvoiceSubmission` | ✓ XML fixture tests |
| QR/signature/certificate match | ✓ | ✓ نفس builder محليًا | `buildAndSignZatcaInvoice` | ✓ signing tests |
| PIH / ICV | ✓ | ✓ نفس payload path عند فتح النقل | invoice transaction + builder | ✓ lifecycle/fixture tests |
| Reporting / Clearance | ✓ Simulation endpoints | Production route mapped but external submit blocked | `ZatcaOperation` + shared builder/transport | ✓ operation mapping |
| Official URLs | ✓ `/e-invoicing/simulation` | ✓ `/e-invoicing/core` mapping فقط | `getFatooraUrl` / `assertFatooraUrl` | ✓ allowlist tests |
| Journal → POS → Device → Credentials | ✓ | ✓ context resolver يطلب البيئة نفسها | `resolveZatcaContext` | ✓ environment mismatch tests |
| Unit/device lifecycle | ✓ | ✓ guards and cancellation records | `zatcaUnitLifecycle` | ✓ archived/revoked/paused tests |
| Revoke | لا يوجد revoke خارجي؛ تأكيد يدوي فقط | نفس السياسة | lifecycle mutations | ✓ no external revoke path |
| Pause/Resume | Super Admin داخلي فقط | Super Admin داخلي فقط | internal lifecycle procedures | ✓ role/source tests |
| Service Worker/cache | ✓ development disabled / build cache versioned | ✓ build cache versioned | Vite SW cache plugin | ✓ build/runtime logs |

## ما يزال Simulation-only أو محجوبًا قبل فتح Production

1. `saveConfig` يرفض حفظ إعدادات Production.
2. `submitInvoice` يرفض الاتصال الخارجي عند `environment = production`.
3. لا يوجد endpoint Production لتنفيذ OTP أو Compliance أو Operational CSID.
4. لا يوجد طلب إلى `/e-invoicing/core` أثناء الاختبارات الحالية.
5. لا يوجد Reporting أو Clearance حقيقي في Production.

هذه القيود مقصودة وليست نقصًا مخفيًا؛ يجب رفعها في تغيير مستقل بعد اعتماد
Secrets وOTP وCSR وCSID الخاصة بالإنتاج.

## قواعد ممنوعة

- لا تُقبل هوية CSR من العميل.
- لا يُستخدم `response.requestId` أو `body.requestId` كمرجع Compliance.
- لا يُستخدم CSID أو Certificate أو Secret من بيئة أخرى.
- لا يُستخدم URL من إعداد المستخدم.
- لا يُنشأ Device أو CSR بمجرد حفظ POS unit.
- لا يُرسل طلب `/core` في مرحلة Mock/local الحالية.