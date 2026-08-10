import { ArrowLeftRight, AlertTriangle } from "lucide-react";

export default function Transfers() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border border-amber-300/50 bg-amber-50 p-6 text-center text-amber-900">
        <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-amber-600" />
        <h2 className="mb-2 text-lg font-bold">التحويل بين المخازن غير متاح</h2>
        <p className="text-sm">
          لا يوجد إجراء خادم معتمد لهذه الدورة حاليًا. لم يتم ربط الشاشة بسلوك وهمي أو إجراء غير موجود.
        </p>
        <AlertTriangle className="mx-auto mt-4 h-4 w-4 text-amber-600" />
      </div>
    </div>
  );
}