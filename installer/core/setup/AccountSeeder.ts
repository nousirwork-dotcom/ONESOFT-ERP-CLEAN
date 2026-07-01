import type { ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

interface AccountSeed {
  code: string;
  name: string;
  type: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  nature: 'debit' | 'credit';
  level: number;
  parentCode: string | null;
  isParent: boolean;
  allowPosting: boolean;
}

/**
 * يُثبّت شجرة الحسابات الافتراضية مباشرةً عبر pg
 * لا يعتمد على npx أو tsx أو drizzle-orm — صالح لأجهزة العملاء
 */
export class AccountSeeder {
  async seed(databaseUrl: string, emit: Emit): Promise<void> {
    emit({ level: 'info', message: 'جارٍ تثبيت شجرة الحسابات الافتراضية...', timestamp: now() });

    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });

    try {
      const client = await pool.connect();
      try {
        // جلب أول مؤسسة مسجّلة
        const orgRes = await client.query<{ id: number }>(
          'SELECT id FROM organizations ORDER BY id LIMIT 1',
        );
        if (orgRes.rows.length === 0) {
          emit({ level: 'warning', message: 'لا توجد مؤسسة — تم تخطي شجرة الحسابات', timestamp: now() });
          return;
        }
        const orgId = orgRes.rows[0].id;

        // هل سبق تثبيت الحسابات؟
        const countRes = await client.query<{ cnt: string }>(
          'SELECT COUNT(*) AS cnt FROM chart_of_accounts WHERE organization_id = $1',
          [orgId],
        );
        if (parseInt(countRes.rows[0].cnt, 10) > 0) {
          emit({ level: 'info', message: 'شجرة الحسابات موجودة مسبقاً — تم التخطي', timestamp: now() });
          return;
        }

        // ─── إدراج الحسابات بالترتيب (الآباء قبل الأبناء) ──────────────────
        let inserted = 0;
        for (const acc of ACCOUNTS) {
          // تحديد parent_id من code الأب
          let parentId: number | null = null;
          if (acc.parentCode) {
            const pRes = await client.query<{ id: number }>(
              'SELECT id FROM chart_of_accounts WHERE code = $1 AND organization_id = $2',
              [acc.parentCode, orgId],
            );
            parentId = pRes.rows[0]?.id ?? null;
          }

          await client.query(
            `INSERT INTO chart_of_accounts
               (organization_id, code, name, type, nature, level, parent_id, is_parent, allow_posting)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (organization_id, code) DO NOTHING`,
            [orgId, acc.code, acc.name, acc.type, acc.nature, acc.level,
             parentId, acc.isParent, acc.allowPosting],
          );
          inserted++;
        }

        emit({ level: 'success', message: `تم تثبيت ${inserted} حساب في شجرة الحسابات`, timestamp: now() });
      } finally {
        client.release();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'warning', message: `تحذير شجرة الحسابات: ${msg}`, timestamp: now() });
    } finally {
      await pool.end().catch(() => {});
    }
  }
}

function now() { return new Date().toISOString(); }

// ─── شجرة الحسابات الكاملة — مُستخرجة من seed-chart-of-accounts.ts ──────────
const ACCOUNTS: AccountSeed[] = [
  // 1 ▸ الأصول
  { code:'1',      name:'الأصول',                        type:'assets',      nature:'debit',  level:1, parentCode:null,    isParent:true,  allowPosting:false },
  { code:'11',     name:'الأصول المتداولة',               type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false },
  { code:'12',     name:'الأصول الثابتة',                 type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false },
  { code:'13',     name:'أصول أخرى',                      type:'assets',      nature:'debit',  level:2, parentCode:'1',    isParent:true,  allowPosting:false },
  { code:'1101',   name:'نقدية بالصندوق',                 type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1102',   name:'البنوك',                          type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1103',   name:'العملاء',                         type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1104',   name:'المخزون',                         type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1105',   name:'العهد والسلف',                    type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1106',   name:'أوراق القبض',                     type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1107',   name:'المصروفات المقدمة',               type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'1108',   name:'ذمم مدينة أخرى',                  type:'assets',      nature:'debit',  level:3, parentCode:'11',   isParent:true,  allowPosting:false },
  { code:'110101', name:'نقدية بالصندوق فرع 1',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true  },
  { code:'110102', name:'نقدية بالصندوق فرع 2',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true  },
  { code:'110103', name:'نقدية بالصندوق فرع 3',           type:'assets',      nature:'debit',  level:4, parentCode:'1101', isParent:false, allowPosting:true  },
  { code:'110201', name:'بنك 1',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true  },
  { code:'110202', name:'بنك 2',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true  },
  { code:'110203', name:'بنك 3',                           type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true  },
  { code:'110204', name:'شيكات تحت التحصيل',               type:'assets',      nature:'debit',  level:4, parentCode:'1102', isParent:false, allowPosting:true  },
  { code:'110301', name:'العملاء',                         type:'assets',      nature:'debit',  level:4, parentCode:'1103', isParent:false, allowPosting:true  },
  { code:'110401', name:'مخزون فرع 1',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true  },
  { code:'110402', name:'مخزون فرع 2',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true  },
  { code:'110403', name:'مخزون فرع 3',                    type:'assets',      nature:'debit',  level:4, parentCode:'1104', isParent:false, allowPosting:true  },
  { code:'110501', name:'عهد الموظفين',                   type:'assets',      nature:'debit',  level:4, parentCode:'1105', isParent:false, allowPosting:true  },
  { code:'110502', name:'سلف العاملين',                   type:'assets',      nature:'debit',  level:4, parentCode:'1105', isParent:false, allowPosting:true  },
  { code:'110601', name:'شيكات آجلة',                     type:'assets',      nature:'debit',  level:4, parentCode:'1106', isParent:false, allowPosting:true  },
  { code:'110602', name:'كمبيالات',                        type:'assets',      nature:'debit',  level:4, parentCode:'1106', isParent:false, allowPosting:true  },
  { code:'110701', name:'إيجارات مقدمة',                  type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true  },
  { code:'110702', name:'تأمينات مقدمة',                  type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true  },
  { code:'110703', name:'رسوم حكومية مقدمة',              type:'assets',      nature:'debit',  level:4, parentCode:'1107', isParent:false, allowPosting:true  },
  { code:'110801', name:'تأمينات لدى الغير',              type:'assets',      nature:'debit',  level:4, parentCode:'1108', isParent:false, allowPosting:true  },
  { code:'110802', name:'مدينون متنوعون',                 type:'assets',      nature:'debit',  level:4, parentCode:'1108', isParent:false, allowPosting:true  },
  { code:'1201',   name:'الأراضي',                         type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'1202',   name:'المباني',                          type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'1203',   name:'السيارات',                         type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'1204',   name:'الآلات والمعدات',                 type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'1205',   name:'الحاسب الآلي',                    type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'1206',   name:'الأثاث والمفروشات',               type:'assets',      nature:'debit',  level:3, parentCode:'12',   isParent:true,  allowPosting:false },
  { code:'120101', name:'الأراضي (التكلفة)',               type:'assets',      nature:'debit',  level:4, parentCode:'1201', isParent:false, allowPosting:true  },
  { code:'120201', name:'المباني (التكلفة)',               type:'assets',      nature:'debit',  level:4, parentCode:'1202', isParent:false, allowPosting:true  },
  { code:'120202', name:'مجمع إهلاك المباني',              type:'assets',      nature:'credit', level:4, parentCode:'1202', isParent:false, allowPosting:true  },
  { code:'120301', name:'السيارات (التكلفة)',              type:'assets',      nature:'debit',  level:4, parentCode:'1203', isParent:false, allowPosting:true  },
  { code:'120302', name:'مجمع إهلاك السيارات',             type:'assets',      nature:'credit', level:4, parentCode:'1203', isParent:false, allowPosting:true  },
  { code:'120401', name:'الآلات والمعدات (التكلفة)',       type:'assets',      nature:'debit',  level:4, parentCode:'1204', isParent:false, allowPosting:true  },
  { code:'120402', name:'مجمع إهلاك الآلات والمعدات',     type:'assets',      nature:'credit', level:4, parentCode:'1204', isParent:false, allowPosting:true  },
  { code:'120501', name:'الحاسب الآلي (التكلفة)',          type:'assets',      nature:'debit',  level:4, parentCode:'1205', isParent:false, allowPosting:true  },
  { code:'120502', name:'مجمع إهلاك الحاسب الآلي',        type:'assets',      nature:'credit', level:4, parentCode:'1205', isParent:false, allowPosting:true  },
  { code:'120601', name:'الأثاث والمفروشات (التكلفة)',     type:'assets',      nature:'debit',  level:4, parentCode:'1206', isParent:false, allowPosting:true  },
  { code:'120602', name:'مجمع إهلاك الأثاث والمفروشات',   type:'assets',      nature:'credit', level:4, parentCode:'1206', isParent:false, allowPosting:true  },
  { code:'1301',   name:'مشروعات تحت التنفيذ',            type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true  },
  { code:'1302',   name:'نفقات إيرادية مؤجلة',            type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true  },
  { code:'1303',   name:'استثمارات طويلة الأجل',          type:'assets',      nature:'debit',  level:3, parentCode:'13',   isParent:false, allowPosting:true  },
  // 2 ▸ الخصوم
  { code:'2',      name:'الخصوم',                          type:'liabilities', nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false },
  { code:'21',     name:'الخصوم المتداولة',                type:'liabilities', nature:'credit', level:2, parentCode:'2',    isParent:true,  allowPosting:false },
  { code:'22',     name:'الخصوم طويلة الأجل',             type:'liabilities', nature:'credit', level:2, parentCode:'2',    isParent:true,  allowPosting:false },
  { code:'2101',   name:'الموردون',                        type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false },
  { code:'2102',   name:'أوراق الدفع',                     type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false },
  { code:'2104',   name:'المصروفات المستحقة',              type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false },
  { code:'2105',   name:'ضريبة القيمة المضافة',           type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false },
  { code:'2107',   name:'دائنون متنوعون',                  type:'liabilities', nature:'credit', level:3, parentCode:'21',   isParent:true,  allowPosting:false },
  { code:'210101', name:'موردين فرع 1',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true  },
  { code:'210102', name:'موردين فرع 2',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true  },
  { code:'210103', name:'موردين فرع 3',                    type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true  },
  { code:'210104', name:'موردين خارجيين',                  type:'liabilities', nature:'credit', level:4, parentCode:'2101', isParent:false, allowPosting:true  },
  { code:'210201', name:'شيكات آجلة الدفع',               type:'liabilities', nature:'credit', level:4, parentCode:'2102', isParent:false, allowPosting:true  },
  { code:'210202', name:'كمبيالات دفع',                    type:'liabilities', nature:'credit', level:4, parentCode:'2102', isParent:false, allowPosting:true  },
  { code:'210401', name:'كهرباء مستحقة',                  type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true  },
  { code:'210402', name:'مياه مستحقة',                    type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true  },
  { code:'210403', name:'اتصالات مستحقة',                 type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true  },
  { code:'210404', name:'إيجارات مستحقة',                 type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:false, allowPosting:true  },
  { code:'210405', name:'أجور ورواتب مستحقة',             type:'liabilities', nature:'credit', level:4, parentCode:'2104', isParent:true,  allowPosting:false },
  { code:'21040501', name:'رواتب مستحقة الإدارة',         type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true },
  { code:'21040502', name:'رواتب مستحقة المبيعات',        type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true },
  { code:'21040503', name:'رواتب مستحقة العمال',          type:'liabilities', nature:'credit', level:5, parentCode:'210405', isParent:false, allowPosting:true },
  { code:'210501', name:'ضريبة مخرجات',                   type:'liabilities', nature:'credit', level:4, parentCode:'2105', isParent:false, allowPosting:true  },
  { code:'210502', name:'ضريبة مدخلات',                   type:'liabilities', nature:'debit',  level:4, parentCode:'2105', isParent:false, allowPosting:true  },
  { code:'210503', name:'ضريبة مستحقة السداد',            type:'liabilities', nature:'credit', level:4, parentCode:'2105', isParent:false, allowPosting:true  },
  { code:'210701', name:'دائنون موظفين',                   type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true  },
  { code:'210702', name:'دائنون شركاء',                    type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true  },
  { code:'210703', name:'دائنون متنوعون أخرى',            type:'liabilities', nature:'credit', level:4, parentCode:'2107', isParent:false, allowPosting:true  },
  { code:'2201',   name:'القروض طويلة الأجل',             type:'liabilities', nature:'credit', level:3, parentCode:'22',   isParent:true,  allowPosting:false },
  { code:'2204',   name:'مخصصات',                          type:'liabilities', nature:'credit', level:3, parentCode:'22',   isParent:true,  allowPosting:false },
  { code:'220101', name:'قرض بنك 1',                      type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true  },
  { code:'220102', name:'قرض بنك 2',                      type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true  },
  { code:'220103', name:'قرض تمويل سيارات',               type:'liabilities', nature:'credit', level:4, parentCode:'2201', isParent:false, allowPosting:true  },
  { code:'220401', name:'مخصص الزكاة',                    type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true  },
  { code:'220402', name:'مخصص نهاية الخدمة',              type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true  },
  { code:'220403', name:'مخصص قضايا ونزاعات',            type:'liabilities', nature:'credit', level:4, parentCode:'2204', isParent:false, allowPosting:true  },
  // 3 ▸ حقوق الملكية
  { code:'3',      name:'حقوق الملكية',                   type:'equity',      nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false },
  { code:'31',     name:'رأس المال',                       type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false },
  { code:'32',     name:'جاري الشركاء',                    type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false },
  { code:'33',     name:'الاحتياطيات',                     type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false },
  { code:'34',     name:'الأرباح المحتجزة',                type:'equity',      nature:'credit', level:2, parentCode:'3',    isParent:true,  allowPosting:false },
  { code:'3101',   name:'رأس المال الرئيسي',              type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true  },
  { code:'3102',   name:'زيادة رأس المال',                type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true  },
  { code:'3103',   name:'رأس مال إضافي',                  type:'equity',      nature:'credit', level:3, parentCode:'31',   isParent:false, allowPosting:true  },
  { code:'320101', name:'جاري الشريك 1',                  type:'equity',      nature:'credit', level:3, parentCode:'32',   isParent:false, allowPosting:true  },
  { code:'320102', name:'جاري الشريك 2',                  type:'equity',      nature:'credit', level:3, parentCode:'32',   isParent:false, allowPosting:true  },
  { code:'320103', name:'مسحوبات الشركاء',                type:'equity',      nature:'debit',  level:3, parentCode:'32',   isParent:false, allowPosting:true  },
  { code:'3301',   name:'احتياطي نظامي',                  type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true  },
  { code:'3302',   name:'احتياطي عام',                    type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true  },
  { code:'3303',   name:'احتياطي توسعات',                 type:'equity',      nature:'credit', level:3, parentCode:'33',   isParent:false, allowPosting:true  },
  { code:'3401',   name:'أرباح العام الحالي',             type:'equity',      nature:'credit', level:3, parentCode:'34',   isParent:false, allowPosting:true  },
  { code:'3402',   name:'أرباح سنوات سابقة',             type:'equity',      nature:'credit', level:3, parentCode:'34',   isParent:false, allowPosting:true  },
  { code:'3403',   name:'خسائر متراكمة',                  type:'equity',      nature:'debit',  level:3, parentCode:'34',   isParent:false, allowPosting:true  },
  // 4 ▸ الإيرادات
  { code:'4',      name:'الإيرادات',                       type:'revenue',     nature:'credit', level:1, parentCode:null,   isParent:true,  allowPosting:false },
  { code:'41',     name:'صافى المبيعات',                   type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false },
  { code:'42',     name:'إيرادات الخدمات',                 type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false },
  { code:'43',     name:'إيرادات أخرى',                    type:'revenue',     nature:'credit', level:2, parentCode:'4',    isParent:true,  allowPosting:false },
  { code:'4101',   name:'إجمالى المبيعات',                type:'revenue',     nature:'credit', level:3, parentCode:'41',   isParent:true,  allowPosting:false },
  { code:'4102',   name:'مردودات المبيعات',               type:'revenue',     nature:'debit',  level:3, parentCode:'41',   isParent:true,  allowPosting:false },
  { code:'4103',   name:'الخصم المسموح به',               type:'revenue',     nature:'debit',  level:3, parentCode:'41',   isParent:true,  allowPosting:false },
  { code:'410101', name:'مبيعات فرع 1',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true  },
  { code:'410102', name:'مبيعات فرع 2',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true  },
  { code:'410103', name:'مبيعات فرع 3',                   type:'revenue',     nature:'credit', level:4, parentCode:'4101', isParent:false, allowPosting:true  },
  { code:'410201', name:'مردودات فرع 1',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true  },
  { code:'410202', name:'مردودات فرع 2',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true  },
  { code:'410203', name:'مردودات فرع 3',                  type:'revenue',     nature:'debit',  level:4, parentCode:'4102', isParent:false, allowPosting:true  },
  { code:'410301', name:'خصم فرع 1',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true  },
  { code:'410302', name:'خصم فرع 2',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true  },
  { code:'410303', name:'خصم فرع 3',                      type:'revenue',     nature:'debit',  level:4, parentCode:'4103', isParent:false, allowPosting:true  },
  { code:'4201',   name:'إيرادات خدمات تركيب',           type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true  },
  { code:'4202',   name:'إيرادات خدمات نقل',             type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true  },
  { code:'4203',   name:'إيرادات صيانة',                  type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true  },
  { code:'4204',   name:'إيرادات عقود',                   type:'revenue',     nature:'credit', level:3, parentCode:'42',   isParent:false, allowPosting:true  },
  { code:'4301',   name:'أرباح بيع أصول',                type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true  },
  { code:'4302',   name:'خصومات مكتسبة',                 type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true  },
  { code:'4303',   name:'إيرادات استثمارات',             type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true  },
  { code:'4304',   name:'إيرادات متنوعة',                type:'revenue',     nature:'credit', level:3, parentCode:'43',   isParent:false, allowPosting:true  },
  // 5 ▸ المصروفات
  { code:'5',      name:'المصروفات',                       type:'expenses',    nature:'debit',  level:1, parentCode:null,   isParent:true,  allowPosting:false },
  { code:'51',     name:'صافى المشتريات',                  type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'52',     name:'تكلفة البضاعة المباعة',           type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'53',     name:'مصروفات البيع والتوزيع',         type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'54',     name:'المصروفات الإدارية والعمومية',   type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'55',     name:'المصروفات المالية',               type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'56',     name:'مصروفات أخرى',                   type:'expenses',    nature:'debit',  level:2, parentCode:'5',    isParent:true,  allowPosting:false },
  { code:'5101',   name:'إجمالى المشتريات',               type:'expenses',    nature:'debit',  level:3, parentCode:'51',   isParent:true,  allowPosting:false },
  { code:'5102',   name:'مردودات المشتريات',              type:'expenses',    nature:'credit', level:3, parentCode:'51',   isParent:true,  allowPosting:false },
  { code:'5103',   name:'الخصم المكتسب',                  type:'expenses',    nature:'credit', level:3, parentCode:'51',   isParent:true,  allowPosting:false },
  { code:'5104',   name:'مصاريف الشراء',                  type:'expenses',    nature:'debit',  level:3, parentCode:'51',   isParent:true,  allowPosting:false },
  { code:'510101', name:'مشتريات فرع 1',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true  },
  { code:'510102', name:'مشتريات فرع 2',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true  },
  { code:'510103', name:'مشتريات فرع 3',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5101', isParent:false, allowPosting:true  },
  { code:'510201', name:'مردودات مشتريات فرع 1',          type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true  },
  { code:'510202', name:'مردودات مشتريات فرع 2',          type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true  },
  { code:'510203', name:'مردودات مشتريات فرع 3',          type:'expenses',    nature:'credit', level:4, parentCode:'5102', isParent:false, allowPosting:true  },
  { code:'510301', name:'خصم فرع 1 (مكتسب)',             type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true  },
  { code:'510302', name:'خصم فرع 2 (مكتسب)',             type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true  },
  { code:'510303', name:'خصم فرع 3 (مكتسب)',             type:'expenses',    nature:'credit', level:4, parentCode:'5103', isParent:false, allowPosting:true  },
  { code:'510401', name:'شحن ونقل',                       type:'expenses',    nature:'debit',  level:4, parentCode:'5104', isParent:false, allowPosting:true  },
  { code:'510402', name:'تأمين بضاعة',                    type:'expenses',    nature:'debit',  level:4, parentCode:'5104', isParent:false, allowPosting:true  },
  { code:'510403', name:'رسوم جمركية',                    type:'expenses',    nature:'debit',  level:4, parentCode:'5104', isParent:false, allowPosting:true  },
  { code:'5201',   name:'بضاعة أول المدة',                type:'expenses',    nature:'debit',  level:3, parentCode:'52',   isParent:false, allowPosting:true  },
  { code:'5202',   name:'بضاعة آخر المدة',                type:'expenses',    nature:'credit', level:3, parentCode:'52',   isParent:false, allowPosting:true  },
  { code:'5301',   name:'مصروفات البيع والدعاية',         type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:true,  allowPosting:false },
  { code:'5302',   name:'مصروفات التوزيع والنقل',         type:'expenses',    nature:'debit',  level:3, parentCode:'53',   isParent:true,  allowPosting:false },
  { code:'530101', name:'مصروفات دعاية وإعلان',           type:'expenses',    nature:'debit',  level:4, parentCode:'5301', isParent:false, allowPosting:true  },
  { code:'530102', name:'عمولات مبيعات',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5301', isParent:false, allowPosting:true  },
  { code:'530103', name:'تغليف وتعبئة',                   type:'expenses',    nature:'debit',  level:4, parentCode:'5301', isParent:false, allowPosting:true  },
  { code:'530201', name:'شحن بضاعة للعملاء',             type:'expenses',    nature:'debit',  level:4, parentCode:'5302', isParent:false, allowPosting:true  },
  { code:'530202', name:'رواتب موظفي المبيعات',           type:'expenses',    nature:'debit',  level:4, parentCode:'5302', isParent:false, allowPosting:true  },
  { code:'5401',   name:'رواتب وأجور',                    type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:true,  allowPosting:false },
  { code:'5402',   name:'إيجارات',                         type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:true,  allowPosting:false },
  { code:'5403',   name:'مصروفات مكتبية',                 type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:true,  allowPosting:false },
  { code:'5404',   name:'مصروفات عامة أخرى',             type:'expenses',    nature:'debit',  level:3, parentCode:'54',   isParent:true,  allowPosting:false },
  { code:'540101', name:'رواتب الإدارة',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5401', isParent:false, allowPosting:true  },
  { code:'540102', name:'بدل سكن',                        type:'expenses',    nature:'debit',  level:4, parentCode:'5401', isParent:false, allowPosting:true  },
  { code:'540103', name:'بدل نقل',                        type:'expenses',    nature:'debit',  level:4, parentCode:'5401', isParent:false, allowPosting:true  },
  { code:'540104', name:'مكافآت ونهاية خدمة',            type:'expenses',    nature:'debit',  level:4, parentCode:'5401', isParent:false, allowPosting:true  },
  { code:'540201', name:'إيجار مكتب',                     type:'expenses',    nature:'debit',  level:4, parentCode:'5402', isParent:false, allowPosting:true  },
  { code:'540202', name:'إيجار مخزن',                     type:'expenses',    nature:'debit',  level:4, parentCode:'5402', isParent:false, allowPosting:true  },
  { code:'540301', name:'قرطاسية',                         type:'expenses',    nature:'debit',  level:4, parentCode:'5403', isParent:false, allowPosting:true  },
  { code:'540302', name:'طباعة ونسخ',                     type:'expenses',    nature:'debit',  level:4, parentCode:'5403', isParent:false, allowPosting:true  },
  { code:'540401', name:'كهرباء وماء',                    type:'expenses',    nature:'debit',  level:4, parentCode:'5404', isParent:false, allowPosting:true  },
  { code:'540402', name:'اتصالات وانترنت',                type:'expenses',    nature:'debit',  level:4, parentCode:'5404', isParent:false, allowPosting:true  },
  { code:'540403', name:'تأمينات',                         type:'expenses',    nature:'debit',  level:4, parentCode:'5404', isParent:false, allowPosting:true  },
  { code:'540404', name:'صيانة وإصلاح',                   type:'expenses',    nature:'debit',  level:4, parentCode:'5404', isParent:false, allowPosting:true  },
  { code:'540405', name:'مصروفات ضيافة',                  type:'expenses',    nature:'debit',  level:4, parentCode:'5404', isParent:false, allowPosting:true  },
  { code:'5501',   name:'فوائد قروض',                     type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true  },
  { code:'5502',   name:'عمولات بنكية',                   type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true  },
  { code:'5503',   name:'خسائر صرف عملة',                type:'expenses',    nature:'debit',  level:3, parentCode:'55',   isParent:false, allowPosting:true  },
  { code:'5601',   name:'خسائر بيع أصول',                type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true  },
  { code:'5602',   name:'مصروفات متنوعة',                type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true  },
  { code:'5603',   name:'إهلاك الأصول',                   type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true  },
  { code:'5604',   name:'ديون معدومة',                    type:'expenses',    nature:'debit',  level:3, parentCode:'56',   isParent:false, allowPosting:true  },
];
