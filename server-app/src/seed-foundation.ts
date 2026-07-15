/**
 * seed-foundation.ts — بذر شجرة الحسابات الأساسية لأي مؤسسة جديدة
 *
 * القواعد:
 * - idempotent تماماً: يعمل على أي عدد من المرات دون تكرار.
 * - يُدرج الحساب فقط إذا لم يكن system_key الخاص به موجوداً.
 * - لا يُعدّل أي بيانات أضافها العميل.
 * - عند إضافة حساب جديد في إصدار لاحق يكفي إضافته للمصفوفة أدناه.
 */
import { db } from './db.js';
import { chartOfAccounts } from './schema.js';
import { and, eq, inArray } from 'drizzle-orm';
import { logger } from './logger.js';

// ─── أنواع السجلات ────────────────────────────────────────────────────────────
export type RecordType =
  | 'system_protected'   // نظامي محمي — لا تعديل، لا حذف
  | 'system_editable'    // نظامي قابل للتعديل — يمكن تغيير الاسم، لا حذف
  | 'system_flexible'    // نظامي مرن — يمكن تعديله وحذفه بشرط لا حركات
  | 'user';              // سجل مستخدم — يمكن تعديله وحذفه بشرط لا حركات

interface FoundationAccount {
  code: string;
  name: string;
  type: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  nature: 'debit' | 'credit';
  level: number;
  parentCode: string | null;
  isParent: boolean;
  allowPosting: boolean;
  recordType: RecordType;
}

// system_key = 'acct.' + code لكل حساب نظامي
const key = (code: string) => `acct.${code}`;

// ─── قالب شجرة الحسابات الأساسية ─────────────────────────────────────────────
// recordType:
//   system_protected  → المستويات الجذرية (1,2,3,4,5)
//   system_editable   → حسابات أب فرعية (تقبل تغيير الاسم فقط)
//   system_flexible   → حسابات ورقية (تقبل الترحيل — يمكن حذفها بلا حركات)
const FOUNDATION_ACCOUNTS: FoundationAccount[] = [

  // ══════ 1 ▸ الأصول ══════
  { code:'1',      name:'الأصول',                        type:'assets',      nature:'debit',  level:1, parentCode:null,   isParent:true,  allowPosting:false, recordType:'system_protected' },
  { code:'11',     name:'الأصول المتداولة',               type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'12',     name:'الأصول الثابتة',                 type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'13',     name:'أصول أخرى',                      type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false, recordType:'system_editable' },

  // 11 ─ أصول متداولة (آباء)
  { code:'1101',   name:'نقدية بالصندوق',                 type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1102',   name:'البنوك',                          type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1103',   name:'العملاء',                         type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1104',   name:'المخزون',                         type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1105',   name:'العهد والسلف',                    type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1106',   name:'أوراق القبض',                     type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1107',   name:'المصروفات المقدمة',               type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1108',   name:'ذمم مدينة أخرى',                  type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false, recordType:'system_editable' },

  // 11 ─ أصول متداولة (ورقية)
  { code:'110101', name:'نقدية بالصندوق فرع 1',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110102', name:'نقدية بالصندوق فرع 2',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110103', name:'نقدية بالصندوق فرع 3',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110201', name:'بنك 1',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110202', name:'بنك 2',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110203', name:'بنك 3',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110204', name:'شيكات تحت التحصيل',               type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110301', name:'العملاء',                         type:'assets',      nature:'debit',  level:4, parentCode:'1103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110401', name:'مخزون فرع 1',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110402', name:'مخزون فرع 2',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110403', name:'مخزون فرع 3',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110501', name:'عهد الموظفين',                   type:'assets',      nature:'debit',  level:4, parentCode:'1105', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110502', name:'سلف العاملين',                   type:'assets',      nature:'debit',  level:4, parentCode:'1105', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110601', name:'شيكات آجلة',                     type:'assets',      nature:'debit',  level:4, parentCode:'1106', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110602', name:'كمبيالات',                        type:'assets',      nature:'debit',  level:4, parentCode:'1106', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110701', name:'إيجارات مقدمة',                  type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110702', name:'تأمينات مقدمة',                  type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110703', name:'رسوم حكومية مقدمة',              type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110801', name:'تأمينات لدى الغير',              type:'assets',      nature:'debit',  level:4, parentCode:'1108', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'110802', name:'مدينون متنوعون',                 type:'assets',      nature:'debit',  level:4, parentCode:'1108', isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // 12 ─ أصول ثابتة
  { code:'1201',   name:'الأراضي',                         type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1202',   name:'المباني',                          type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1203',   name:'السيارات',                         type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1204',   name:'الآلات والمعدات',                 type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1205',   name:'الحاسب الآلي',                    type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'1206',   name:'الأثاث والمفروشات',               type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'120101', name:'الأراضي (التكلفة)',               type:'assets',      nature:'debit',  level:4, parentCode:'1201', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120201', name:'المباني (التكلفة)',               type:'assets',      nature:'debit',  level:4, parentCode:'1202', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120202', name:'مجمع إهلاك المباني',              type:'assets',      nature:'credit', level:4, parentCode:'1202', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120301', name:'السيارات (التكلفة)',              type:'assets',      nature:'debit',  level:4, parentCode:'1203', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120302', name:'مجمع إهلاك السيارات',             type:'assets',      nature:'credit', level:4, parentCode:'1203', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120401', name:'الآلات والمعدات (التكلفة)',       type:'assets',      nature:'debit',  level:4, parentCode:'1204', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120402', name:'مجمع إهلاك الآلات والمعدات',     type:'assets',      nature:'credit', level:4, parentCode:'1204', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120501', name:'الحاسب الآلي (التكلفة)',          type:'assets',      nature:'debit',  level:4, parentCode:'1205', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120502', name:'مجمع إهلاك الحاسب الآلي',        type:'assets',      nature:'credit', level:4, parentCode:'1205', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120601', name:'الأثاث والمفروشات (التكلفة)',     type:'assets',      nature:'debit',  level:4, parentCode:'1206', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'120602', name:'مجمع إهلاك الأثاث والمفروشات',   type:'assets',      nature:'credit', level:4, parentCode:'1206', isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // 13 ─ أصول أخرى
  { code:'1301',   name:'مشروعات تحت التنفيذ',            type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'1302',   name:'نفقات إيرادية مؤجلة',            type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'1303',   name:'استثمارات طويلة الأجل',          type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // ══════ 2 ▸ الخصوم ══════
  { code:'2',      name:'الخصوم',                          type:'liabilities', nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false, recordType:'system_protected' },
  { code:'21',     name:'الخصوم المتداولة',                type:'liabilities', nature:'credit', level:2, parentCode:'2',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'22',     name:'الخصوم طويلة الأجل',             type:'liabilities', nature:'credit', level:2, parentCode:'2',    isParent:true,  allowPosting:false, recordType:'system_editable' },

  { code:'2101',   name:'الموردون',                        type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'2102',   name:'أوراق الدفع',                     type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'2104',   name:'المصروفات المستحقة',              type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'2105',   name:'ضريبة القيمة المضافة',           type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'2107',   name:'دائنون متنوعون',                  type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false, recordType:'system_editable' },

  { code:'210101', name:'موردين فرع 1',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210102', name:'موردين فرع 2',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210103', name:'موردين فرع 3',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210104', name:'موردين خارجيين',                  type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210201', name:'شيكات آجلة الدفع',               type:'liabilities', nature:'credit', level:4, parentCode:'2102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210202', name:'كمبيالات دفع',                    type:'liabilities', nature:'credit', level:4, parentCode:'2102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210401', name:'كهرباء مستحقة',                  type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210402', name:'مياه مستحقة',                    type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210403', name:'اتصالات مستحقة',                 type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210404', name:'إيجارات مستحقة',                 type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210405', name:'أجور ورواتب مستحقة',             type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'21040501', name:'رواتب مستحقة الإدارة',         type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true, recordType:'system_flexible' },
  { code:'21040502', name:'رواتب مستحقة المبيعات',        type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true, recordType:'system_flexible' },
  { code:'21040503', name:'رواتب مستحقة العمال',          type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true, recordType:'system_flexible' },
  { code:'210501', name:'ضريبة مخرجات',                   type:'liabilities', nature:'credit', level:4, parentCode:'2105', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210502', name:'ضريبة مدخلات',                   type:'liabilities', nature:'debit',  level:4, parentCode:'2105', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210503', name:'ضريبة مستحقة السداد',            type:'liabilities', nature:'credit', level:4, parentCode:'2105', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210701', name:'دائنون موظفين',                   type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210702', name:'دائنون شركاء',                    type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'210703', name:'دائنون متنوعون أخرى',            type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true,  recordType:'system_flexible' },

  { code:'2201',   name:'القروض طويلة الأجل',             type:'liabilities', nature:'credit', level:3, parentCode:'22',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'2204',   name:'مخصصات',                          type:'liabilities', nature:'credit', level:3, parentCode:'22',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'220101', name:'قرض بنك 1',                      type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'220102', name:'قرض بنك 2',                      type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'220103', name:'قرض تمويل سيارات',               type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'220401', name:'مخصص الزكاة',                    type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'220402', name:'مخصص نهاية الخدمة',              type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'220403', name:'مخصص قضايا ونزاعات',            type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // ══════ 3 ▸ حقوق الملكية ══════
  { code:'3',      name:'حقوق الملكية',                   type:'equity',      nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false, recordType:'system_protected' },
  { code:'31',     name:'رأس المال',                       type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'32',     name:'جاري الشركاء',                    type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'33',     name:'الاحتياطيات',                     type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'34',     name:'الأرباح المحتجزة',                type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false, recordType:'system_editable' },

  { code:'3101',   name:'رأس المال الرئيسي',              type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3102',   name:'زيادة رأس المال',                type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3103',   name:'رأس مال إضافي',                  type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'320101', name:'جاري الشريك 1',                  type:'equity',      nature:'credit', level:3, parentCode:'32',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'320102', name:'جاري الشريك 2',                  type:'equity',      nature:'credit', level:3, parentCode:'32',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'320103', name:'مسحوبات الشركاء',                type:'equity',      nature:'debit',  level:3, parentCode:'32',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3301',   name:'احتياطي نظامي',                  type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3302',   name:'احتياطي عام',                    type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3303',   name:'احتياطي توسعات',                 type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3401',   name:'أرباح العام الحالي',             type:'equity',      nature:'credit', level:3, parentCode:'34',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3402',   name:'أرباح سنوات سابقة',             type:'equity',      nature:'credit', level:3, parentCode:'34',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'3403',   name:'خسائر متراكمة',                  type:'equity',      nature:'debit',  level:3, parentCode:'34',   isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // ══════ 4 ▸ الإيرادات ══════
  { code:'4',      name:'الإيرادات',                       type:'revenue',     nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false, recordType:'system_protected' },
  { code:'41',     name:'صافى المبيعات',                   type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'42',     name:'إيرادات الخدمات',                 type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'43',     name:'إيرادات أخرى',                    type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false, recordType:'system_editable' },

  { code:'4101',   name:'إجمالى المبيعات',                type:'revenue',     nature:'credit', level:3, parentCode:'41',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'4102',   name:'مردودات المبيعات',               type:'revenue',     nature:'debit',  level:3, parentCode:'41',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'4103',   name:'الخصم المسموح به',               type:'revenue',     nature:'debit',  level:3, parentCode:'41',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'410101', name:'مبيعات فرع 1',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410102', name:'مبيعات فرع 2',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410103', name:'مبيعات فرع 3',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410201', name:'مردودات فرع 1',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410202', name:'مردودات فرع 2',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410203', name:'مردودات فرع 3',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410301', name:'خصم فرع 1',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410302', name:'خصم فرع 2',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'410303', name:'خصم فرع 3',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4201',   name:'إيرادات خدمات تركيب',           type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4202',   name:'إيرادات خدمات نقل',             type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4203',   name:'إيرادات صيانة',                  type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4204',   name:'إيرادات عقود',                   type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4301',   name:'أرباح بيع أصول',                type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4302',   name:'خصومات مكتسبة',                 type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4303',   name:'إيرادات استثمارات',             type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'4304',   name:'إيرادات متنوعة',                type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true,  recordType:'system_flexible' },

  // ══════ 5 ▸ المصروفات ══════
  { code:'5',      name:'المصروفات',                       type:'expenses',    nature:'debit',  level:1, parentCode:null,   isParent:true,  allowPosting:false, recordType:'system_protected' },
  { code:'51',     name:'صافى المشتريات',                  type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'52',     name:'تكلفة المبيعات',                  type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'53',     name:'المصروفات الإدارية والعمومية',   type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'54',     name:'المصروفات البيعية والتسويقية',   type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'55',     name:'المصروفات التشغيلية',             type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'56',     name:'الإهلاك',                          type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'57',     name:'مصروفات أخرى',                    type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false, recordType:'system_editable' },

  { code:'5101',   name:'إجمالى المشتريات',               type:'expenses',    nature:'debit',  level:3, parentCode:'51',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'5102',   name:'مردودات المشتريات',              type:'expenses',    nature:'credit', level:3, parentCode:'51',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'5103',   name:'الخصم المكتسب',                  type:'expenses',    nature:'credit', level:3, parentCode:'51',   isParent:true,  allowPosting:false, recordType:'system_editable' },
  { code:'510101', name:'مشتريات فرع 1',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510102', name:'مشتريات فرع 2',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510103', name:'مشتريات فرع 3',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510201', name:'مردودات فرع 1',                  type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510202', name:'مردودات فرع 2',                  type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510203', name:'مردودات فرع 3',                  type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510301', name:'خصم مكتسب فرع 1',               type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510302', name:'خصم مكتسب فرع 2',               type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'510303', name:'خصم مكتسب فرع 3',               type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5201',   name:'تكلفة مبيعات فرع 1',            type:'expenses',    nature:'debit',  level:3, parentCode:'52',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5202',   name:'تكلفة مبيعات فرع 2',            type:'expenses',    nature:'debit',  level:3, parentCode:'52',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5203',   name:'تكلفة مبيعات فرع 3',            type:'expenses',    nature:'debit',  level:3, parentCode:'52',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5204',   name:'تكلفة تشغيل أخرى',              type:'expenses',    nature:'debit',  level:3, parentCode:'52',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5301',   name:'الرواتب والأجور',                type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5302',   name:'بدلات وسكن',                     type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5303',   name:'كهرباء ومياه',                   type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5304',   name:'اتصالات وإنترنت',                type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5305',   name:'إيجارات',                         type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5306',   name:'رسوم حكومية',                    type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5307',   name:'تأمينات',                         type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5308',   name:'صيانة',                           type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5309',   name:'أدوات مكتبية',                   type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5310',   name:'ضيافة وبوفيه',                   type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5311',   name:'برامج وأنظمة',                   type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5312',   name:'عمولات بنكية',                   type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5313',   name:'سفر وانتقالات',                  type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5314',   name:'مصروفات قانونية',                type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5315',   name:'مصروفات بريد وشحن',              type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5316',   name:'مصروفات متنوعة',                 type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5401',   name:'رواتب المبيعات',                 type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5402',   name:'عمولات البيع',                   type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5403',   name:'دعاية وإعلان',                   type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5404',   name:'نقل وتحميل',                     type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5405',   name:'وقود ومحروقات',                  type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5406',   name:'صيانة السيارات',                 type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5407',   name:'هدايا وعينات',                   type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5408',   name:'إيجارات المعارض',                type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5409',   name:'شحن وتوصيل',                     type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5410',   name:'مصروفات تسويق أخرى',            type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5501',   name:'مصروف أجور ورواتب',             type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5502',   name:'وقود وتشغيل',                    type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5503',   name:'صيانة وتشغيل',                   type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5504',   name:'أدوات تشغيل',                    type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5505',   name:'كهرباء التشغيل',                 type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5506',   name:'مصروفات تشغيل أخرى',            type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5601',   name:'إهلاك المباني',                   type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5602',   name:'إهلاك السيارات',                  type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5603',   name:'إهلاك المعدات',                   type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5604',   name:'إهلاك الحاسب الآلي',              type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5605',   name:'إهلاك الأثاث',                    type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5606',   name:'إهلاك الرافعات',                  type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5701',   name:'خسائر فروقات عملة',              type:'expenses',    nature:'debit',  level:3, parentCode:'57',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5702',   name:'غرامات ومخالفات',                type:'expenses',    nature:'debit',  level:3, parentCode:'57',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5703',   name:'ديون معدومة',                     type:'expenses',    nature:'debit',  level:3, parentCode:'57',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5704',   name:'زكاة وضريبة',                    type:'expenses',    nature:'debit',  level:3, parentCode:'57',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
  { code:'5705',   name:'تبرعات وصدقات',                  type:'expenses',    nature:'debit',  level:3, parentCode:'57',   isParent:false, allowPosting:true,  recordType:'system_flexible' },
];

// ─── دالة البذر الرئيسية (idempotent) ─────────────────────────────────────────
export async function seedFoundationAccounts(orgId: number): Promise<{ inserted: number; skipped: number }> {
  try {
    // 1. اجلب جميع system_key الموجودة لهذه المؤسسة
    const existingRows = await db
      .select({ systemKey: chartOfAccounts.systemKey })
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.orgId, orgId),
        eq(chartOfAccounts.isActive, true),
      ));
    const existingKeys = new Set(existingRows.map(r => r.systemKey).filter(Boolean));

    // 2. حدّد الحسابات المطلوب إدراجها (غير موجودة بعد)
    const toInsert = FOUNDATION_ACCOUNTS.filter(a => !existingKeys.has(key(a.code)));

    if (toInsert.length === 0) {
      logger.info('seed-foundation', `org ${orgId}: all foundation accounts already present`);
      return { inserted: 0, skipped: FOUNDATION_ACCOUNTS.length };
    }

    // 3. بناء خريطة code → id للحسابات الموجودة (لحل parentId)
    const allExisting = await db
      .select({ id: chartOfAccounts.id, systemKey: chartOfAccounts.systemKey })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.orgId, orgId), eq(chartOfAccounts.isActive, true)));
    const keyToId = new Map<string, number>(
      allExisting.filter(r => r.systemKey).map(r => [r.systemKey!, r.id])
    );

    // 4. إدراج الحسابات بالترتيب (الآباء قبل الأبناء)
    let inserted = 0;
    for (const acc of toInsert) {
      const systemKeyVal = key(acc.code);

      // تجاهل إذا أُضيف في حلقة سابقة خلال نفس الجلسة
      if (keyToId.has(systemKeyVal)) { inserted++; continue; }

      const parentId = acc.parentCode ? keyToId.get(key(acc.parentCode)) : undefined;

      const [row] = await db.insert(chartOfAccounts).values({
        orgId,
        code:          acc.code,
        name:          acc.name,
        accountType:   acc.type,
        nature:        acc.nature,
        level:         acc.level,
        isParent:      acc.isParent,
        allowPosting:  acc.allowPosting,
        isActive:      true,
        costCenterType:'not_allowed',
        recordType:    acc.recordType,
        systemKey:     systemKeyVal,
        ...(parentId !== undefined ? { parentId } : {}),
      } as any).returning({ id: chartOfAccounts.id });

      keyToId.set(systemKeyVal, row.id);
      inserted++;
    }

    logger.info('seed-foundation', `org ${orgId}: inserted ${inserted} foundation accounts`);
    return { inserted, skipped: FOUNDATION_ACCOUNTS.length - inserted };
  } catch (err) {
    logger.error('seed-foundation', `org ${orgId}: ${(err as Error).message}`);
    return { inserted: 0, skipped: 0 };
  }
}
