import type { Category, PosConfig, Product, ProductView } from '../types';
import { formatMoney } from '../money';
import { Spinner } from './Modal';

interface ProductBrowserProps {
  categories: Category[];
  products: Product[];
  favoriteProducts: Product[];
  selectedCategoryId: string | null;
  view: ProductView;
  loading: boolean;
  config: PosConfig;
  onCategoryChange: (categoryId: string | null) => void;
  onProductClick: (product: Product) => void;
}

function ProductCard({ product, config, onClick, compact = false }: {
  product: Product;
  config: PosConfig;
  onClick: () => void;
  compact?: boolean;
}) {
  const stockWarning = product.trackStock && product.availableQuantity != null && product.availableQuantity <= 5;
  return (
    <button
      type="button"
      disabled={!product.isAvailable}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border text-start transition active:scale-[0.98] ${
        product.isAvailable
          ? 'border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-[#1C4576]/50 hover:shadow-md'
          : 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'
      } ${compact ? 'min-h-20 p-3' : 'min-h-36 p-3'}`}
    >
      {product.isFavorite ? <span className="absolute start-2 top-2 text-amber-500">★</span> : null}
      {!product.isAvailable ? <span className="absolute inset-x-2 top-2 rounded-md bg-rose-600 px-2 py-1 text-center text-[10px] font-bold text-white">غير متاح</span> : null}
      <div className={`${compact ? 'text-3xl' : 'mb-3 text-5xl'} text-center`} aria-hidden="true">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className={`${compact ? 'h-10' : 'h-16'} mx-auto w-full object-contain`} />
        ) : (
          product.emoji ?? '◻'
        )}
      </div>
      <div className="line-clamp-2 min-h-10 text-sm font-extrabold leading-5 text-slate-900">{product.name}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-sm font-black text-[#1C4576]">{formatMoney(product.priceMinor, config.currency, config.locale)}</span>
        {product.modifierGroups?.length ? <span className="rounded-md bg-[#D8AE55]/20 px-1.5 py-1 text-[10px] font-bold text-amber-800">خيارات</span> : null}
      </div>
      {stockWarning ? <div className="mt-1 text-[10px] font-bold text-rose-600">متبقي {product.availableQuantity}</div> : null}
    </button>
  );
}

export function ProductBrowser(props: ProductBrowserProps) {
  const activeCategories = props.categories.filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  if (props.loading) {
    return <div className="grid h-full place-items-center text-[#1C4576]"><Spinner label="جارٍ تحميل الأصناف" /></div>;
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_132px] gap-2 overflow-hidden p-2">
      <div className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        {props.view === 'mixed' && props.favoriteProducts.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-amber-900">الأكثر استخدامًا والمفضلة</h3>
              <span className="text-[10px] text-amber-700">وصول سريع</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {props.favoriteProducts.slice(0, 6).map((product) => (
                <ProductCard key={`fav-${product.id}`} product={product} config={props.config} onClick={() => props.onProductClick(product)} compact />
              ))}
            </div>
          </div>
        ) : null}

        {props.view === 'compact' ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[80px_minmax(0,1fr)_140px_90px] bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600">
              <span>الكود</span><span>الصنف</span><span>السعر</span><span>المتاح</span>
            </div>
            {props.products.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={!product.isAvailable}
                onClick={() => props.onProductClick(product)}
                className="grid min-h-12 w-full grid-cols-[80px_minmax(0,1fr)_140px_90px] items-center border-t border-slate-100 px-3 text-start text-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                <span className="font-mono text-xs text-slate-500">{product.sku}</span>
                <span className="font-bold text-slate-800">{product.emoji} {product.name}</span>
                <span className="font-extrabold text-[#1C4576]">{formatMoney(product.priceMinor, props.config.currency, props.config.locale)}</span>
                <span className={product.isAvailable ? 'text-emerald-700' : 'text-rose-700'}>{product.isAvailable ? 'متاح' : 'موقوف'}</span>
              </button>
            ))}
          </div>
        ) : props.view === 'grouped' && !props.selectedCategoryId ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {activeCategories.map((category) => {
              const count = props.products.filter((product) => product.categoryId === category.id).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => props.onCategoryChange(category.id)}
                  className="min-h-32 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#1C4576] hover:shadow-md"
                >
                  <div className="mx-auto mb-3 h-12 w-12 rounded-2xl" style={{ backgroundColor: category.color ?? '#E2E8F0' }} />
                  <div className="font-extrabold text-slate-900">{category.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{count} صنف</div>
                </button>
              );
            })}
          </div>
        ) : props.products.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {props.products.map((product) => (
              <ProductCard key={product.id} product={product} config={props.config} onClick={() => props.onProductClick(product)} />
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center text-center text-slate-500">
            <div>
              <div className="text-4xl">⌕</div>
              <div className="mt-2 font-bold">لا توجد أصناف مطابقة</div>
              <div className="text-xs">غيّر البحث أو اختر مجموعة أخرى</div>
            </div>
          </div>
        )}
      </div>

      <nav className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          onClick={() => props.onCategoryChange(null)}
          className={`mb-1 min-h-14 w-full rounded-xl px-2 text-xs font-extrabold transition ${
            !props.selectedCategoryId ? 'bg-[#1C4576] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          كل الأصناف
        </button>
        {activeCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => props.onCategoryChange(category.id)}
            className={`mb-1 min-h-14 w-full rounded-xl border-s-4 px-2 text-xs font-extrabold transition ${
              props.selectedCategoryId === category.id
                ? 'bg-[#1C4576] text-white shadow'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            style={{ borderInlineStartColor: category.color ?? '#CBD5E1' }}
          >
            {category.name}
          </button>
        ))}
      </nav>
    </section>
  );
}
