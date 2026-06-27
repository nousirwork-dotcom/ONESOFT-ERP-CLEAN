/**
 * arabicKeyboardShortcuts.ts
 *
 * عند تفعيل لوحة المفاتيح العربية يُرسل المتصفح event.key = 'ؤ' بدلاً من 'c'
 * و 'ر' بدلاً من 'v' — فلا تُعالَج هذه الأحداث كنسخ/لصق.
 *
 * هذا الملف يُسجّل مستمعاً عالمياً (capture phase) يُعيد تشغيل أوامر الحافظة
 * الصحيحة بناءً على المفتاح الفيزيائي (event.code) بغض النظر عن لغة الإدخال.
 *
 * التغطية:
 *   Ctrl+ؤ (C) → نسخ
 *   Ctrl+ر (V) → لصق
 *   Ctrl+ء (X) → قص
 *   Ctrl+ش (A) → تحديد الكل
 *   Ctrl+ئ (Z) → تراجع
 *   Ctrl+غ (Y) → إعادة
 */

/* ── خريطة المفاتيح الفيزيائية ← حرف عربي ── */
const ARABIC_CTRL_MAP: Record<string, string> = {
  KeyC: 'ؤ',
  KeyV: 'ر',
  KeyX: 'ء',
  KeyA: 'ش',
  KeyZ: 'ئ',
  KeyY: 'غ',
};

/* ── أوامر execCommand المقابلة للمفاتيح الفيزيائية ── */
const CODE_TO_COMMAND: Record<string, string> = {
  KeyC: 'copy',
  KeyX: 'cut',
  KeyA: 'selectAll',
  KeyZ: 'undo',
  KeyY: 'redo',
};

/* ── دالة مساعدة: لصق نص في العنصر النشط ── */
function pasteTextIntoActive(text: string): void {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;

  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
    const el = active as HTMLInputElement | HTMLTextAreaElement;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    const newVal = before + text + after;

    /* native value setter — الطريقة الوحيدة لإخطار React بالتغيير */
    const proto  = active.tagName === 'INPUT'
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (setter) {
      setter.call(el, newVal);
    } else {
      el.setRangeText(text, start, end, 'end');
    }
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

  } else if ((active as HTMLElement).isContentEditable) {
    document.execCommand('insertText', false, text);
  }
}

/* ── المعالج الرئيسي ── */
function handleKeyDown(e: KeyboardEvent): void {
  if (!e.ctrlKey && !e.metaKey) return;

  const arabicChar = ARABIC_CTRL_MAP[e.code];

  /* تجاهل الحدث إذا لم يكن المفتاح عربياً أو لم يكن ضمن القائمة */
  if (!arabicChar || e.key !== arabicChar) return;

  e.preventDefault();
  e.stopPropagation();

  /* لصق: يحتاج قراءة الحافظة غير المتزامنة */
  if (e.code === 'KeyV') {
    navigator.clipboard
      .readText()
      .then(pasteTextIntoActive)
      .catch(() => {
        /* في حال رفض الإذن: نحاول dispatch حدث paste اصطناعي كبديل */
        const dt = new DataTransfer();
        const synth = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });
        document.activeElement?.dispatchEvent(synth);
      });
    return;
  }

  /* باقي الأوامر: copy / cut / selectAll / undo / redo */
  const cmd = CODE_TO_COMMAND[e.code];
  if (cmd) {
    document.execCommand(cmd);
  }
}

/* ── نقطة التهيئة — تُستدعى مرة واحدة عند بدء التطبيق ── */
export function initArabicKeyboardShortcuts(): void {
  document.addEventListener('keydown', handleKeyDown, { capture: true });
}
