/**
 * HtmlRenderer.ts — مولّد صفحة HTML كاملة
 *
 * يُغلّف أي محتوى HTML ببنية صفحة كاملة (DOCTYPE + head + body).
 * يُستخدم من جميع الـ Builders لضمان مخرج موحد.
 */

export interface HtmlPageOptions {
  title?:    string;
  css?:      string;
  dir?:      "rtl" | "ltr";
  lang?:     string;
  bodyClass?: string;
}

export const HtmlRenderer = {
  /**
   * يُنشئ صفحة HTML كاملة.
   * @param bodyHtml  محتوى <body>
   * @param options   خيارات الصفحة (عنوان، CSS، اتجاه)
   */
  buildPage(bodyHtml: string, options: HtmlPageOptions = {}): string {
    const {
      title     = "OneSoft ERP",
      css       = "",
      dir       = "rtl",
      lang      = "ar",
      bodyClass = "print-page",
    } = options;

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${css}
  </style>
</head>
<body class="${bodyClass}">
  ${bodyHtml}
</body>
</html>`;
  },

  /**
   * يُنشئ معاينة مناسبة للـ iframe (نفس buildPage لكن بدون وسم html/head/body زائد).
   */
  buildIframeDoc(bodyHtml: string, options: HtmlPageOptions = {}): string {
    return this.buildPage(bodyHtml, options);
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
