import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { usePOS } from '../state';
import type { Product, CartLine, ModifierChoice } from '../types';

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  type: 'radio' | 'checkbox';
  isRemove?: boolean;
  choices: Array<{ id: string; name: string; priceDelta: number }>;
}

const SAMPLE_GROUPS: ModifierGroup[] = [
  {
    id: 'size',
    name: 'الحجم',
    required: true,
    type: 'radio',
    choices: [
      { id: 'sm', name: 'صغير', priceDelta: -3 },
      { id: 'md', name: 'متوسط', priceDelta: 0 },
      { id: 'lg', name: 'كبير', priceDelta: 8 },
      { id: 'xl', name: 'إكسترا لارج', priceDelta: 15 },
    ],
  },
  {
    id: 'addons',
    name: 'الإضافات',
    required: false,
    type: 'checkbox',
    choices: [
      { id: 'sauce', name: 'صوص إضافي', priceDelta: 2 },
      { id: 'cheese', name: 'جبن إضافي', priceDelta: 5 },
      { id: 'jalapeno', name: 'جالبينيو', priceDelta: 3 },
      { id: 'mushroom', name: 'فطر', priceDelta: 4 },
    ],
  },
  {
    id: 'remove',
    name: 'إزالة مكون',
    required: false,
    type: 'checkbox',
    isRemove: true,
    choices: [
      { id: 'no-onion', name: 'بدون بصل', priceDelta: 0 },
      { id: 'no-tomato', name: 'بدون طماطم', priceDelta: 0 },
      { id: 'no-pickle', name: 'بدون مخلل', priceDelta: 0 },
    ],
  },
];

function money(v: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ModifierDialog({ product, open, onClose }: Props) {
  const { dispatch } = usePOS();

  const [selectedSize, setSelectedSize] = useState<string>('md');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [selectedRemove, setSelectedRemove] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const handleClose = () => {
    setSelectedSize('md');
    setSelectedAddons(new Set());
    setSelectedRemove(new Set());
    setNotes('');
    onClose();
  };

  const priceDelta = useMemo(() => {
    const sizeDelta = SAMPLE_GROUPS[0]?.choices.find((c) => c.id === selectedSize)?.priceDelta ?? 0;
    const addonsDelta = SAMPLE_GROUPS[1]?.choices
      .filter((c) => selectedAddons.has(c.id))
      .reduce((s, c) => s + c.priceDelta, 0) ?? 0;
    return sizeDelta + addonsDelta;
  }, [selectedSize, selectedAddons]);

  const basePrice = product?.salePrice ?? 0;
  const finalPrice = Math.max(0, basePrice + priceDelta);

  const handleConfirm = () => {
    if (!product) return;

    const modifiers: ModifierChoice[] = [];

    const sizeChoice = SAMPLE_GROUPS[0]?.choices.find((c) => c.id === selectedSize);
    if (sizeChoice) {
      modifiers.push({ id: sizeChoice.id, name: sizeChoice.name, priceDelta: sizeChoice.priceDelta });
    }

    SAMPLE_GROUPS[1]?.choices
      .filter((c) => selectedAddons.has(c.id))
      .forEach((c) => modifiers.push({ id: c.id, name: c.name, priceDelta: c.priceDelta }));

    SAMPLE_GROUPS[2]?.choices
      .filter((c) => selectedRemove.has(c.id))
      .forEach((c) => modifiers.push({ id: c.id, name: c.name, priceDelta: 0 }));

    const line: CartLine = {
      id: `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: product.id,
      productCode: product.code,
      name: product.name,
      unitName: product.unitName,
      quantity: 1,
      unitPrice: finalPrice,
      taxRate: product.taxRate,
      discountPercent: 0,
      imageUrl: product.imageUrl,
      notes: notes.trim() || undefined,
      modifiers,
      kitchenStatus: 'new',
    };

    dispatch({ type: 'ADD_LINE', line });
    handleClose();
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRemove = (id: string) => {
    setSelectedRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!product) return null;

  return (
    <Modal open={open} title={`تخصيص — ${product.name}`} onClose={handleClose} width={620}>
      <div className="pos-modifier-dialog">
        <div className="pos-modifier-summary">
          <div>
            <small>السعر الأساسي</small>
            <strong>{money(basePrice)} ر.س</strong>
          </div>
          {priceDelta !== 0 && (
            <div>
              <small>فرق السعر</small>
              <strong className={priceDelta > 0 ? 'is-positive' : 'is-negative'}>
                {priceDelta > 0 ? '+' : ''}{money(priceDelta)} ر.س
              </strong>
            </div>
          )}
          <div>
            <small>السعر النهائي</small>
            <strong style={{ color: 'var(--pos-blue)', fontSize: 24 }}>{money(finalPrice)} ر.س</strong>
          </div>
        </div>

        <div className="pos-modifier-group">
          <div className="pos-modifier-group__title">
            {SAMPLE_GROUPS[0]?.name}
            <small>مطلوب</small>
          </div>
          <div className="pos-modifier-choices">
            {SAMPLE_GROUPS[0]?.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`pos-modifier-choice${selectedSize === choice.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedSize(choice.id)}
              >
                {choice.name}
                {choice.priceDelta !== 0 && (
                  <span className={`pos-modifier-delta ${choice.priceDelta > 0 ? 'is-plus' : 'is-minus'}`}>
                    ({choice.priceDelta > 0 ? '+' : ''}{choice.priceDelta})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pos-modifier-group">
          <div className="pos-modifier-group__title">
            {SAMPLE_GROUPS[1]?.name}
            <small>اختياري</small>
          </div>
          <div className="pos-modifier-choices">
            {SAMPLE_GROUPS[1]?.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`pos-modifier-choice${selectedAddons.has(choice.id) ? ' is-selected' : ''}`}
                onClick={() => toggleAddon(choice.id)}
              >
                {choice.name}
                <span className="pos-modifier-delta is-plus">+{choice.priceDelta}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pos-modifier-group">
          <div className="pos-modifier-group__title">
            {SAMPLE_GROUPS[2]?.name}
            <small>اختياري</small>
          </div>
          <div className="pos-modifier-choices">
            {SAMPLE_GROUPS[2]?.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`pos-modifier-choice${selectedRemove.has(choice.id) ? ' is-selected is-remove' : ''}`}
                onClick={() => toggleRemove(choice.id)}
              >
                {choice.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pos-modifier-group">
          <div className="pos-modifier-group__title">ملاحظة للمطبخ</div>
          <textarea
            className="pos-modifier-notes"
            placeholder="مثال: بدون ملح، ناضج جداً..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="pos-modifier-actions">
          <button type="button" className="pos-button pos-button--secondary" onClick={handleClose}>
            إلغاء
          </button>
          <button type="button" className="pos-button pos-button--primary" onClick={handleConfirm}>
            إضافة للسلة — {money(finalPrice)} ر.س
          </button>
        </div>
      </div>
    </Modal>
  );
}
