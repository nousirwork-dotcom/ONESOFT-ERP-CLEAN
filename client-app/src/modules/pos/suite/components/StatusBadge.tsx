import React from 'react';

const labels: Record<string, string> = {
  new: 'جديد',
  open: 'مفتوح',
  sent: 'مرسل',
  sent_to_kitchen: 'مرسل للمطبخ',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  served: 'تم التقديم',
  awaiting_payment: 'بانتظار الدفع',
  paid: 'مدفوع',
  cancelled: 'ملغي',
  available: 'متاحة',
  occupied: 'مشغولة',
  kitchen: 'في المطبخ',
  reserved: 'محجوزة',
  accepted: 'مقبول',
  handed_to_driver: 'سُلّم للمندوب',
  completed: 'مكتمل',
  rejected: 'مرفوض',
  needs_review: 'يحتاج مراجعة',
  open_shift: 'مفتوحة',
  pending_review: 'بانتظار المراجعة',
  closed: 'مغلقة',
  approved: 'معتمدة',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`pos-status pos-status--${status}`}>{labels[status] ?? status}</span>;
}
