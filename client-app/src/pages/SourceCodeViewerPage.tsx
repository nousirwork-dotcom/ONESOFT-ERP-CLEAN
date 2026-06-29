/**
 * SourceCodeViewerPage.tsx — مستعرض الكود البرمجي
 * يعرض شجرة ملفات المشروع مع عارض كود متكامل
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── أنواع ─────────────────────────────────────────────────────────────────────
interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  ext?: string;
  size?: number;
  children?: FileNode[];
}

// ── أيقونات الملفات ──────────────────────────────────────────────────────────
function fileIcon(ext?: string, type?: string): string {
  if (type === "dir") return "📁";
  const m: Record<string, string> = {
    ts: "🔷", tsx: "⚛️", js: "🟨", jsx: "⚛️", json: "📋",
    css: "🎨", html: "🌐", md: "📝", sql: "🗃️", sh: "🖥️",
    env: "🔒", txt: "📄",
  };
  return m[ext ?? ""] ?? "📄";
}

// ── ألوان الـ language ───────────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6", javascript: "#f1e05a", json: "#c5a300",
  css: "#563d7c", html: "#e34c26", markdown: "#083fa1",
  sql: "#e38c00", bash: "#89e051", text: "#6b7280",
};

// ── تمييل الكود بالألوان (أساسي بدون مكتبات خارجية) ────────────────────────
function highlight(code: string, lang: string): string {
  if (lang === "text" || lang === "markdown") return escapeHtml(code);

  let s = escapeHtml(code);

  if (lang === "json") {
    s = s
      .replace(/(&quot;[^&]*&quot;)(\s*:)/g, '<span style="color:#9cdcfe">$1</span>$2')
      .replace(/:(\s*)(&quot;[^&]*&quot;)/g, ':$1<span style="color:#ce9178">$2</span>')
      .replace(/\b(true|false|null)\b/g, '<span style="color:#569cd6">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>');
    return s;
  }

  if (lang === "css") {
    s = s
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6a9955">$1</span>')
      .replace(/([a-z-]+)(\s*:)/g, '<span style="color:#9cdcfe">$1</span>$2')
      .replace(/:([\s]*)([^;{}\n]+)(;)/g, ':$1<span style="color:#ce9178">$2</span>$3');
    return s;
  }

  s = s
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#6a9955">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6a9955">$1</span>')
    .replace(/\b(import|export|from|default|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|async|await|new|this|typeof|instanceof|void|null|undefined|true|false|switch|case|break|continue|throw|try|catch|finally|of|in|as|enum|namespace|module|declare|abstract|readonly|static|public|private|protected|override)\b/g,
      '<span style="color:#c586c0">$1</span>')
    .replace(/(&quot;[^&\n]*&quot;|&#x27;[^&\n]*&#x27;|`[^`]*`)/g,
      '<span style="color:#ce9178">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>')
    .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, '<span style="color:#4ec9b0">$1</span>')
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, '<span style="color:#dcdcaa">$1</span>');

  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── عقدة شجرة الملفات ────────────────────────────────────────────────────────
function TreeNode({
  node, depth, selectedPath, onSelect,
}: {
  node: FileNode; depth: number; selectedPath: string; onSelect: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = node.path === selectedPath;

  if (node.type === "dir") {
    return (
      <div>
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "3px 8px",
            paddingRight: `${8 + depth * 14}px`, cursor: "pointer",
            borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#94a3b8",
            userSelect: "none",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ fontSize: 10, color: "#64748b", width: 10 }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: 14 }}>📂</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
        </div>
        {open && node.children?.map(c => (
          <TreeNode key={c.path} node={c} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "3px 8px",
        paddingRight: `${8 + depth * 14}px`, cursor: "pointer",
        borderRadius: 4, fontSize: 11.5, color: isSelected ? "#fff" : "#94a3b8",
        background: isSelected ? "#1d4ed8" : "transparent", userSelect: "none",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#1e293b"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      title={node.path}
    >
      <span style={{ width: 10 }} />
      <span style={{ fontSize: 13, flexShrink: 0 }}>{fileIcon(node.ext)}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.name}</span>
      {node.size !== undefined && (
        <span style={{ fontSize: 9, color: "#475569", flexShrink: 0 }}>
          {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}K`}
        </span>
      )}
    </div>
  );
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────────────────
export default function SourceCodeViewerPage() {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [searchQ, setSearchQ]           = useState("");
  const [searchMode, setSearchMode]     = useState(false);
  const [showLineNums, setShowLineNums] = useState(true);
  const [wrapLines, setWrapLines]       = useState(false);
  const [fontSize, setFontSize]         = useState(12);
  const searchRef = useRef<HTMLInputElement>(null);

  const treeQ   = trpc.sourceCode.getTree.useQuery();
  const fileQ   = trpc.sourceCode.getFile.useQuery(
    { filePath: selectedFile },
    { enabled: !!selectedFile }
  );
  const searchEnabled = searchMode && searchQ.trim().length >= 2;
  const searchResultsQ = trpc.sourceCode.search.useQuery(
    { query: searchQ },
    { enabled: searchEnabled }
  );

  const lines = useMemo(() => {
    if (!fileQ.data) return [];
    return fileQ.data.content.split("\n");
  }, [fileQ.data]);

  const highlighted = useMemo(() => {
    if (!fileQ.data) return [];
    return lines.map(l => highlight(l, fileQ.data!.lang));
  }, [lines, fileQ.data]);

  const copyFile = useCallback(() => {
    if (!fileQ.data) return;
    navigator.clipboard.writeText(fileQ.data.content);
    toast.success("تم نسخ الملف بالكامل");
  }, [fileQ.data]);

  useEffect(() => {
    if (searchMode) searchRef.current?.focus();
  }, [searchMode]);

  const langColor = LANG_COLORS[fileQ.data?.lang ?? ""] ?? "#6b7280";

  return (
    <div style={{ display: "flex", height: "100%", background: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif", overflow: "hidden" }}>

      {/* ── شجرة الملفات ── */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* رأس الشريط الجانبي */}
        <div style={{ padding: "12px 10px 8px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🗂️</span> مستعرض الكود
          </div>

          {/* بحث */}
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setSearchMode(true); }}
                onFocus={() => setSearchMode(true)}
                placeholder="🔍 بحث في الملفات..."
                style={{ width: "100%", height: 28, borderRadius: 5, background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", padding: "0 8px", fontSize: 11, direction: "rtl", boxSizing: "border-box" }}
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(""); setSearchMode(false); }} style={{ position: "absolute", left: 6, top: 4, background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
              )}
            </div>
            <button onClick={() => setSearchMode(false)} title="تصفح الملفات"
              style={{ width: 28, height: 28, background: searchMode ? "#1e293b" : "#1d4ed8", border: "1px solid #334155", borderRadius: 5, color: "#e2e8f0", cursor: "pointer", fontSize: 12 }}>📁</button>
          </div>
        </div>

        {/* محتوى الشريط */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
          {treeQ.isLoading && (
            <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>⏳</div>جارٍ تحميل الملفات...
            </div>
          )}

          {/* نتائج البحث */}
          {searchMode && searchQ.trim().length >= 2 && (
            <div>
              {searchResultsQ.isLoading && <div style={{ padding: 10, color: "#64748b", fontSize: 11 }}>🔍 جارٍ البحث...</div>}
              {searchResultsQ.data && searchResultsQ.data.length === 0 && (
                <div style={{ padding: 10, color: "#64748b", fontSize: 11 }}>لا توجد نتائج لـ "{searchQ}"</div>
              )}
              {searchResultsQ.data?.map((r, i) => (
                <div key={i} onClick={() => { setSelectedFile(r.path); setSearchMode(false); }}
                  style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, marginBottom: 2, borderRight: "2px solid #334155" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontSize: 10.5, color: "#60a5fa", fontWeight: 600, marginBottom: 2 }}>
                    {r.path.split("/").pop()} <span style={{ color: "#475569" }}>:{r.line}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* شجرة الملفات */}
          {!searchMode && treeQ.data?.map(root => (
            <div key={root.path} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", padding: "4px 8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {root.name}
              </div>
              {root.children?.map(c => (
                <TreeNode key={c.path} node={c} depth={0} selectedPath={selectedFile} onSelect={setSelectedFile} />
              ))}
            </div>
          ))}
        </div>

        {/* إحصائيات */}
        <div style={{ padding: "8px 10px", borderTop: "1px solid #1e293b", fontSize: 10, color: "#475569" }}>
          {treeQ.data && (
            <span>
              {treeQ.data.reduce((acc, r) => acc + countFiles(r), 0)} ملف •{" "}
              client-app/src + server-app/src
            </span>
          )}
        </div>
      </div>

      {/* ── منطقة عرض الكود ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* شريط الأدوات */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0, minHeight: 44 }}>
          {selectedFile ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflow: "hidden" }}>
                <span style={{ fontSize: 15 }}>{fileIcon(selectedFile.split(".").pop())}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile.split("/").pop()}
                </span>
                <span style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile}
                </span>
                {fileQ.data && (
                  <span style={{ flexShrink: 0, fontSize: 10, color: langColor, fontWeight: 700, background: `${langColor}22`, padding: "1px 6px", borderRadius: 4, border: `1px solid ${langColor}44` }}>
                    {fileQ.data.lang}
                  </span>
                )}
              </div>

              {fileQ.data && (
                <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>
                  {fileQ.data.lines} سطر • {(fileQ.data.size / 1024).toFixed(1)} KB
                </span>
              )}

              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setFontSize(s => Math.max(9, s - 1))} title="تصغير الخط"
                  style={toolBtn}>A-</button>
                <button onClick={() => setFontSize(s => Math.min(20, s + 1))} title="تكبير الخط"
                  style={toolBtn}>A+</button>
                <button onClick={() => setShowLineNums(s => !s)} title="أرقام الأسطر"
                  style={{ ...toolBtn, background: showLineNums ? "#1d4ed8" : "#1e293b" }}>
                  #
                </button>
                <button onClick={() => setWrapLines(s => !s)} title="التفاف النص"
                  style={{ ...toolBtn, background: wrapLines ? "#1d4ed8" : "#1e293b" }}>
                  ↵
                </button>
                <button onClick={copyFile} title="نسخ محتوى الملف"
                  style={{ ...toolBtn, color: "#60a5fa" }}>
                  📋 نسخ
                </button>
              </div>
            </>
          ) : (
            <span style={{ color: "#475569", fontSize: 12 }}>
              اختر ملفاً من الشجرة على اليسار لعرض محتواه
            </span>
          )}
        </div>

        {/* عارض الكود */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          {!selectedFile && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#334155", gap: 16 }}>
              <div style={{ fontSize: 60 }}>🗂️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>مستعرض الكود البرمجي</div>
              <div style={{ fontSize: 12, color: "#334155", textAlign: "center", maxWidth: 300 }}>
                اختر ملفاً من شجرة الملفات على اليسار لعرض محتواه مع تمييل الكود
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 400 }}>
                {["🔷 TypeScript", "⚛️ React/TSX", "🎨 CSS", "📋 JSON", "🗃️ SQL"].map(l => (
                  <span key={l} style={{ padding: "4px 12px", borderRadius: 20, background: "#1e293b", color: "#64748b", fontSize: 11 }}>{l}</span>
                ))}
              </div>
            </div>
          )}

          {selectedFile && fileQ.isLoading && (
            <div style={{ padding: 24, color: "#64748b", fontSize: 12, textAlign: "center" }}>
              ⏳ جارٍ تحميل الملف...
            </div>
          )}

          {fileQ.error && (
            <div style={{ padding: 24, color: "#ef4444", fontSize: 12 }}>
              ❌ {fileQ.error.message}
            </div>
          )}

          {fileQ.data && (
            <div style={{ display: "flex", minHeight: "100%" }}>
              {/* أرقام الأسطر */}
              {showLineNums && (
                <div style={{
                  flexShrink: 0, padding: "16px 0", textAlign: "left",
                  background: "#0a0f1e", borderLeft: "1px solid #1e293b",
                  userSelect: "none", minWidth: Math.max(40, String(lines.length).length * 8 + 20),
                }}>
                  {lines.map((_, i) => (
                    <div key={i} style={{ fontSize, lineHeight: "1.6", paddingLeft: 10, paddingRight: 10, color: "#334155", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* الكود */}
              <pre style={{
                flex: 1, margin: 0, padding: "16px 20px",
                fontSize, lineHeight: "1.6", fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
                whiteSpace: wrapLines ? "pre-wrap" : "pre",
                wordBreak: wrapLines ? "break-all" : "normal",
                background: "transparent", color: "#d4d4d4",
                overflowX: wrapLines ? "hidden" : "auto",
              }}>
                {highlighted.map((line, i) => (
                  <div key={i} style={{ minHeight: `${fontSize * 1.6}px` }} dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }} />
                ))}
              </pre>
            </div>
          )}
        </div>

        {/* شريط الحالة السفلي */}
        {selectedFile && fileQ.data && (
          <div style={{ padding: "4px 14px", borderTop: "1px solid #1e293b", background: "#0a0f1e", display: "flex", gap: 14, fontSize: 10, color: "#475569", flexShrink: 0 }}>
            <span>📄 {selectedFile.split("/").pop()}</span>
            <span>•</span>
            <span>{fileQ.data.lines} سطر</span>
            <span>•</span>
            <span>{(fileQ.data.size / 1024).toFixed(1)} KB</span>
            <span>•</span>
            <span style={{ color: langColor }}>{fileQ.data.lang}</span>
            <span style={{ marginRight: "auto" }}>UTF-8</span>
          </div>
        )}
      </div>
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  height: 26, padding: "0 10px", background: "#1e293b", border: "1px solid #334155",
  borderRadius: 4, color: "#94a3b8", cursor: "pointer", fontSize: 11, fontWeight: 700,
};

function countFiles(node: FileNode): number {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((a, c) => a + countFiles(c), 0);
}
