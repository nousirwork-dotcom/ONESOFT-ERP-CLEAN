import { useMemo, useState } from 'react';
import type { PosConfig, Product, SelectedModifier } from '../types';
import { formatMoney } from '../money';
import { Modal } from './Modal';

interface ModifierDialogProps {
  product: Product;
  config: PosConfig;
  onClose: () => void;
  onConfirm: (modifiers: SelectedModifier[]) => void;
}

export function ModifierDialog({ product, config, onClose, onConfirm }: ModifierDialogProps) {
  const groups = product.modifierGroups ?? [];
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of groups) {
      const defaults = group.options.filter((option) => option.isDefault && option.isActive).map((option) => option.id);
      initial[group.id] = defaults.slice(0, group.maxSelections);
    }
    return initial;
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const selectedModifiers = useMemo<SelectedModifier[]>(() => {
    const result: SelectedModifier[] = [];
    for (const group of groups) {
      for (const optionId of selected[group.id] ?? []) {
        const option = group.options.find((candidate) => candidate.id === optionId);
        if (!option) continue;
        result.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDeltaMinor: option.priceDeltaMinor,
        });
      }
    }
    return result;
  }, [groups, selected]);

  const extraMinor = selectedModifiers.reduce((sum, option) => sum + option.priceDeltaMinor, 0);

  const toggle = (groupId: string, optionId: string) => {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    const current = selected[groupId] ?? [];
    const exists = current.includes(optionId);
    if (exists) {
      setSelected((previous) => ({ ...previous, [groupId]: current.filter((id) => id !== optionId) }));
      return;
    }
    if (group.maxSelections === 1) {
      setSelected((previous) => ({ ...previous, [groupId]: [optionId] }));
      return;
    }
    if (current.length >= group.maxSelections) {
      setValidationMessage(`الحد الأقصى في «${group.name}» هو ${group.maxSelections}`);
      return;
    }
    setSelected((previous) => ({ ...previous, [groupId]: [...current, optionId] }));
  };

  const confirm = () => {
    for (const group of groups) {
      const count = (selected[group.id] ?? []).length;
      if (count < group.minSelections || (group.required && count === 0)) {
        setValidationMessage(`اختر ${Math.max(group.minSelections, 1)} على الأقل من «${group.name}»`);
        return;
      }
      if (count > group.maxSelections) {
        setValidationMessage(`الحد الأقصى في «${group.name}» هو ${group.maxSelections}`);
        return;
      }
    }
    onConfirm(selectedModifiers);
  };

  return (
    <Modal
      title={`خيارات ${product.name}`}
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-700">
            السعر: <span className="font-black text-[#1C4576]">{formatMoney(product.priceMinor + extraMinor, config.currency, config.locale)}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700">إلغاء</button>
            <button type="button" onClick={confirm} className="h-11 rounded-xl bg-[#1C4576] px-6 text-sm font-extrabold text-white">إضافة للطلب</button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.id}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">{group.name}</h3>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${group.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                {group.required ? 'إجباري' : 'اختياري'} • حتى {group.maxSelections}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.options.filter((option) => option.isActive).map((option) => {
                const active = (selected[group.id] ?? []).includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(group.id, option.id)}
                    className={`min-h-16 rounded-xl border p-3 text-start transition ${
                      active ? 'border-[#1C4576] bg-blue-50 ring-2 ring-[#1C4576]/15' : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-900">{option.name}</span>
                      <span className={`grid h-5 w-5 place-items-center rounded-full border text-xs ${active ? 'border-[#1C4576] bg-[#1C4576] text-white' : 'border-slate-300'}`}>{active ? '✓' : ''}</span>
                    </div>
                    {option.priceDeltaMinor !== 0 ? <div className="mt-1 text-xs font-bold text-[#1C4576]">+ {formatMoney(option.priceDeltaMinor, config.currency, config.locale)}</div> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {validationMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{validationMessage}</div> : null}
      </div>
    </Modal>
  );
}
