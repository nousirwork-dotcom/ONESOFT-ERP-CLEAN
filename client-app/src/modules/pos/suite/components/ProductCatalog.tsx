import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';

export function ProductCatalog() {
  const { state, addProduct } = usePOS();
  const { products, productGroups } = usePOSCatalog();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'groups' | 'products' | 'list'>(
    state.mode === 'restaurant' ? 'groups' : 'list',
  );
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setView(state.mode === 'restaurant' ? 'groups' : 'list');
    setSelectedGroupId(null);
  }, [state.mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const inGroup = selectedGroupId == null || product.groupId === selectedGroupId;
      const matches =
        !normalized ||
        [product.name, product.code, product.barcode ?? ''].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      return inGroup && matches;
    });
  }, [query, selectedGroupId, products]);

  const handleBarcodeEnter = () => {
    const exact = products.find(
      (product) =>
        product.barcode === query.trim() ||
        product.code.toLowerCase() === query.trim().toLowerCase(),
    );
    if (exact) {
      addProduct(exact);
      setQuery('');
    }
  };

  if (products.length === 0) {
    return (
      <section className="pos-catalog">
        <div className="pos-empty-state">
          <strong>جارٍ تحميل الأصناف...</strong>
          <span>يتم الآن تحميل بيانات الأصناف من الخادم.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="pos-catalog">
      <div className="pos-catalog__toolbar">
        <div className="pos-search">
          <span>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleBarcodeEnter();
            }}
            placeholder={
              state.mode === 'store'
                ? 'امسح الباركود أو ابحث بالاسم والكود — F2'
                : 'ابحث عن صنف أو باركود — F2'
            }
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')}>
              ×
            </button>
          ) : null}
        </div>
        <div className="pos-view-switch">
          <button
            type="button"
            className={view === 'groups' ? 'is-active' : ''}
            onClick={() => { setView('groups'); setSelectedGroupId(null); }}
          >
            المجموعات
          </button>
          <button
            type="button"
            className={view === 'products' ? 'is-active' : ''}
            onClick={() => setView('products')}
          >
            الصور
          </button>
          <button
            type="button"
            className={view === 'list' ? 'is-active' : ''}
            onClick={() => setView('list')}
          >
            القائمة
          </button>
        </div>
      </div>

      {selectedGroupId != null ? (
        <div className="pos-catalog__breadcrumb">
          <button
            type="button"
            onClick={() => { setSelectedGroupId(null); setView('groups'); }}
          >
            ← كل المجموعات
          </button>
          <strong>
            {productGroups.find((group) => group.id === selectedGroupId)?.name}
          </strong>
        </div>
      ) : null}

      <div className="pos-catalog__body">
        {view === 'groups' && selectedGroupId == null ? (
          <div className="pos-group-grid">
            {productGroups.map((group) => {
              const count = products.filter((p) => p.groupId === group.id).length;
              return (
                <button
                  type="button"
                  key={group.id}
                  className="pos-group-card"
                  style={{ background: group.color ?? undefined }}
                  onClick={() => { setSelectedGroupId(group.id); setView('products'); }}
                >
                  <span className="pos-group-card__image">
                    {group.name.slice(0, 1)}
                  </span>
                  <strong>{group.name}</strong>
                  <small>{count} أصناف</small>
                </button>
              );
            })}
          </div>
        ) : view === 'list' ? (
          <div className="pos-product-table-wrap">
            <table className="pos-product-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الصنف</th>
                  <th>الوحدة</th>
                  <th>السعر</th>
                  <th>الرصيد</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} onDoubleClick={() => addProduct(product)}>
                    <td>{product.code}</td>
                    <td>
                      <strong>{product.name}</strong>
                      <small>{product.barcode ?? 'بدون باركود'}</small>
                    </td>
                    <td>{product.unitName}</td>
                    <td>{product.salePrice.toFixed(2)}</td>
                    <td>
                      {product.itemType === 'service'
                        ? 'خدمة'
                        : product.stockQuantity?.toFixed(2) ?? '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pos-add-button"
                        onClick={() => addProduct(product)}
                      >
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pos-product-grid">
            {filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="pos-product-card"
                onClick={() => addProduct(product)}
              >
                <span className="pos-product-card__image">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" />
                  ) : (
                    product.name.slice(0, 1)
                  )}
                </span>
                <strong>{product.name}</strong>
                <small>
                  {product.code} • {product.unitName}
                </small>
                <div>
                  <b>{product.salePrice.toFixed(2)} ر.س</b>
                  {state.settings.showStock ? (
                    <em>
                      {product.itemType === 'service'
                        ? 'خدمة'
                        : `متاح ${product.stockQuantity ?? 0}`}
                    </em>
                  ) : null}
                </div>
                {product.hasModifiers ? (
                  <span className="pos-product-card__modifier">خيارات</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && !(view === 'groups' && selectedGroupId == null) ? (
          <div className="pos-empty-state">
            <strong>لا توجد أصناف مطابقة</strong>
            <span>جرّب تغيير البحث أو اختيار مجموعة أخرى.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
