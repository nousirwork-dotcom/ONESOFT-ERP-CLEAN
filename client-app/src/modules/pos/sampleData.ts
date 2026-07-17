import type {
  CatalogPayload,
  CustomerSummary,
  OpenOrderSummary,
  RestaurantArea,
  RestaurantTable,
} from './types';

export const demoCatalog: CatalogPayload = {
  categories: [
    { id: 'all', name: 'الكل', sortOrder: 0, isActive: true },
    { id: 'hot', name: 'مشروبات ساخنة', sortOrder: 1, isActive: true, color: '#E8B86D' },
    { id: 'cold', name: 'مشروبات باردة', sortOrder: 2, isActive: true, color: '#6CB4EE' },
    { id: 'breakfast', name: 'الإفطار', sortOrder: 3, isActive: true, color: '#F4A261' },
    { id: 'sandwich', name: 'ساندويتشات', sortOrder: 4, isActive: true, color: '#E76F51' },
    { id: 'main', name: 'وجبات رئيسية', sortOrder: 5, isActive: true, color: '#2A9D8F' },
    { id: 'dessert', name: 'حلويات', sortOrder: 6, isActive: true, color: '#C77DFF' },
  ],
  products: [
    {
      id: 'p1', sku: 'CF-001', barcode: '100001', name: 'قهوة عربية', categoryId: 'hot', emoji: '☕',
      priceMinor: 1200, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true, isFavorite: true,
      modifierGroups: [
        {
          id: 'size', name: 'الحجم', required: true, minSelections: 1, maxSelections: 1,
          options: [
            { id: 'small', name: 'صغير', priceDeltaMinor: 0, isActive: true },
            { id: 'medium', name: 'وسط', priceDeltaMinor: 300, isActive: true, isDefault: true },
            { id: 'large', name: 'كبير', priceDeltaMinor: 600, isActive: true },
          ],
        },
        {
          id: 'extras', name: 'إضافات', required: false, minSelections: 0, maxSelections: 3,
          options: [
            { id: 'milk', name: 'حليب', priceDeltaMinor: 200, isActive: true },
            { id: 'shot', name: 'إسبريسو إضافي', priceDeltaMinor: 350, isActive: true },
            { id: 'syrup', name: 'نكهة', priceDeltaMinor: 250, isActive: true },
          ],
        },
      ],
    },
    { id: 'p2', sku: 'CF-002', barcode: '100002', name: 'إسبريسو', categoryId: 'hot', emoji: '🫘', priceMinor: 1000, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true, isFavorite: true },
    { id: 'p3', sku: 'CF-003', barcode: '100003', name: 'كابتشينو', categoryId: 'hot', emoji: '🥛', priceMinor: 1600, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p4', sku: 'CD-001', barcode: '200001', name: 'عصير برتقال', categoryId: 'cold', emoji: '🍊', priceMinor: 1400, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true, isFavorite: true },
    { id: 'p5', sku: 'CD-002', barcode: '200002', name: 'موهيتو ليمون', categoryId: 'cold', emoji: '🍋', priceMinor: 1800, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p6', sku: 'BR-001', barcode: '300001', name: 'فول وبيض', categoryId: 'breakfast', emoji: '🍳', priceMinor: 2200, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p7', sku: 'BR-002', barcode: '300002', name: 'شكشوكة', categoryId: 'breakfast', emoji: '🥘', priceMinor: 2400, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    {
      id: 'p8', sku: 'SW-001', barcode: '400001', name: 'برجر لحم', categoryId: 'sandwich', emoji: '🍔',
      priceMinor: 3200, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true, isFavorite: true,
      modifierGroups: [
        {
          id: 'doneness', name: 'درجة التسوية', required: true, minSelections: 1, maxSelections: 1,
          options: [
            { id: 'well', name: 'مستوي', priceDeltaMinor: 0, isActive: true, isDefault: true },
            { id: 'medium', name: 'متوسط', priceDeltaMinor: 0, isActive: true },
          ],
        },
        {
          id: 'burgerExtras', name: 'إضافات البرجر', required: false, minSelections: 0, maxSelections: 4,
          options: [
            { id: 'cheese', name: 'جبنة', priceDeltaMinor: 300, isActive: true },
            { id: 'mushroom', name: 'مشروم', priceDeltaMinor: 400, isActive: true },
            { id: 'fries', name: 'بطاطس', priceDeltaMinor: 700, isActive: true },
          ],
        },
      ],
    },
    { id: 'p9', sku: 'SW-002', barcode: '400002', name: 'شاورما دجاج', categoryId: 'sandwich', emoji: '🌯', priceMinor: 2000, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p10', sku: 'MN-001', barcode: '500001', name: 'كبسة دجاج', categoryId: 'main', emoji: '🍗', priceMinor: 3800, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true, isFavorite: true },
    { id: 'p11', sku: 'MN-002', barcode: '500002', name: 'مشاوي مشكلة', categoryId: 'main', emoji: '🍖', priceMinor: 6200, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p12', sku: 'DS-001', barcode: '600001', name: 'كيكة شوكولاتة', categoryId: 'dessert', emoji: '🍰', priceMinor: 1900, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: true },
    { id: 'p13', sku: 'DS-002', barcode: '600002', name: 'أم علي', categoryId: 'dessert', emoji: '🥧', priceMinor: 1700, taxRateBps: 1500, isTaxInclusive: true, isActive: true, isAvailable: false },
  ],
};

export const demoCustomers: CustomerSummary[] = [
  { id: 'c1', name: 'عميل نقدي', phone: null, balanceMinor: 0 },
  { id: 'c2', name: 'أحمد محمد', phone: '0500000001', balanceMinor: 12500 },
  { id: 'c3', name: 'شركة النور', phone: '0500000002', taxNumber: '310000000000003', balanceMinor: 0 },
  { id: 'c4', name: 'محمد علي', phone: '0500000003', balanceMinor: 4200 },
];

export const demoAreas: RestaurantArea[] = [
  { id: 'a1', name: 'الصالة الداخلية', sortOrder: 1 },
  { id: 'a2', name: 'الجلسات الخارجية', sortOrder: 2 },
  { id: 'a3', name: 'العائلات', sortOrder: 3 },
];

export const demoTables: RestaurantTable[] = [
  { id: 't1', areaId: 'a1', name: 'طاولة 1', seats: 4, status: 'available' },
  { id: 't2', areaId: 'a1', name: 'طاولة 2', seats: 4, status: 'occupied', currentOrderId: 'o2', currentTotalMinor: 8500, openedAt: new Date(Date.now() - 18 * 60_000).toISOString() },
  { id: 't3', areaId: 'a1', name: 'طاولة 3', seats: 2, status: 'kitchen', currentOrderId: 'o3', currentTotalMinor: 4300, openedAt: new Date(Date.now() - 11 * 60_000).toISOString() },
  { id: 't4', areaId: 'a2', name: 'خارجية 1', seats: 6, status: 'ready', currentOrderId: 'o4', currentTotalMinor: 12400, openedAt: new Date(Date.now() - 27 * 60_000).toISOString() },
  { id: 't5', areaId: 'a2', name: 'خارجية 2', seats: 4, status: 'reserved' },
  { id: 't6', areaId: 'a3', name: 'عائلات 1', seats: 8, status: 'available' },
];

export const demoOpenOrders: OpenOrderSummary[] = [
  { id: 'o2', displayNumber: 'POS-1042', status: 'draft', serviceType: 'dineIn', tableName: 'طاولة 2', totalMinor: 8500, openedAt: new Date(Date.now() - 18 * 60_000).toISOString(), cashierName: 'أحمد' },
  { id: 'o3', displayNumber: 'POS-1043', status: 'sentToKitchen', serviceType: 'dineIn', tableName: 'طاولة 3', totalMinor: 4300, openedAt: new Date(Date.now() - 11 * 60_000).toISOString(), cashierName: 'محمد' },
  { id: 'o4', displayNumber: 'POS-1044', status: 'ready', serviceType: 'dineIn', tableName: 'خارجية 1', totalMinor: 12400, openedAt: new Date(Date.now() - 27 * 60_000).toISOString(), cashierName: 'أحمد' },
];
