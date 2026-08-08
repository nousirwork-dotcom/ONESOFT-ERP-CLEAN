/**
 * QRCodeDisplay.tsx — مكوّن عرض QR Code باستخدام مكتبة qrcode
 */
import { useEffect, useState } from "react";
import {
  QRCodeService,
  QR_CODE_ERROR_CORRECTION,
  QR_CODE_MARGIN_MODULES,
} from "@/shared/lib/print/QRCodeService";

interface QRCodeDisplayProps {
  content: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function QRCodeDisplay({ content, size = 100, className, style }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    if (!content) return () => { cancelled = true; };

    QRCodeService.generateDataUrl(content, size)
      .then(nextDataUrl => {
        if (!cancelled) setDataUrl(nextDataUrl);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });

    return () => { cancelled = true; };
  }, [content, size]);

  if (!content || !dataUrl) return null;

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="ZATCA QR"
      className={className}
      style={{
        width: size,
        height: size,
        display: "block",
        objectFit: "contain",
        imageRendering: "pixelated",
        ...style,
      }}
      data-qr-error-correction={QR_CODE_ERROR_CORRECTION}
      data-qr-margin-modules={QR_CODE_MARGIN_MODULES}
    />
  );
}
