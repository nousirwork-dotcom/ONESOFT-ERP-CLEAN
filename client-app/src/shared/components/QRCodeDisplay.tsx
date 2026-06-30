/**
 * QRCodeDisplay.tsx — مكوّن عرض QR Code باستخدام مكتبة qrcode
 */
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  content: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function QRCodeDisplay({ content, size = 100, className, style }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !content) return;
    QRCode.toCanvas(canvasRef.current, content, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [content, size]);

  if (!content) return null;

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={style}
    />
  );
}
