// ─── AI Provider Adapter ──────────────────────────────────────────────────────
// طبقة مستقلة تدعم أي مزود متوافق مع واجهة OpenAI القياسية (/chat/completions)
// سحابي أو نموذج محلي بعنوان Base URL مخصص. لا منطق مزود خارج هذا الملف.

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderConfig {
  baseUrl:     string;
  apiKey:      string;
  model:       string;
  maxTokens:   number;
  temperature: number;
  timeoutMs?:  number;
}

export class AiProviderError extends Error {
  constructor(
    public kind:
      | 'no_connection'   // انقطاع الشبكة / المزود غير متاح
      | 'invalid_key'     // مفتاح API خاطئ
      | 'quota_exceeded'  // انتهاء الرصيد أو تجاوز الحد
      | 'timeout'         // انتهاء المهلة
      | 'empty_answer'    // إجابة فارغة
      | 'bad_response',   // استجابة غير مفهومة
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

const AR_MESSAGES: Record<AiProviderError['kind'], string> = {
  no_connection:  'المساعد الذكي غير متاح حاليًا بسبب عدم وجود اتصال بالخدمة.',
  invalid_key:    'مفتاح API غير صحيح — راجع إعدادات المساعد الذكي',
  quota_exceeded: 'تم تجاوز حد الاستخدام أو انتهى رصيد مزود الخدمة — راجع حسابك لدى المزود',
  timeout:        'انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي — حاول مرة أخرى',
  empty_answer:   'لم يُرجِع النموذج أي إجابة — حاول إعادة صياغة السؤال',
  bad_response:   'استجابة غير متوقعة من مزود الخدمة — تحقق من عنوان الخدمة واسم النموذج',
};

function err(kind: AiProviderError['kind']): AiProviderError {
  return new AiProviderError(kind, AR_MESSAGES[kind]);
}

/**
 * يستدعي POST {baseUrl}/chat/completions ويعيد نص الإجابة.
 * لا يُسجّل المفتاح في أي log.
 */
export async function chatComplete(
  cfg: AiProviderConfig,
  messages: AiChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const url  = `${base}/chat/completions`;

  const controller = new AbortController();
  const timeoutMs  = cfg.timeoutMs ?? 45_000;
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model:       cfg.model,
        messages,
        max_tokens:  cfg.maxTokens,
        temperature: cfg.temperature,
        stream:      false,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') throw err('timeout');
    throw err('no_connection');
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) throw err('invalid_key');
  if (res.status === 402 || res.status === 429) throw err('quota_exceeded');
  if (!res.ok) throw err('bad_response');

  let data: any;
  try { data = await res.json(); } catch { throw err('bad_response'); }

  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw err('empty_answer');
  return content.trim();
}
