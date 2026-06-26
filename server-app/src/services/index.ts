/**
 * Services Index — نقطة دخول موحّدة لجميع خدمات النظام
 *
 * الاستخدام من الروترز:
 *   import { PostingEngine, PaymentEngine, FieldDictionaryService } from '../services/index.js';
 *
 * أو مباشرةً من الملف:
 *   import { resolveFieldValue } from '../services/PostingEngine.js';
 */

export * as PostingEngine          from './PostingEngine.js';
export * as PaymentEngine          from './PaymentEngine.js';
export * as FieldDictionaryService from './FieldDictionaryService.js';
export * as DocumentComponentService from './DocumentComponentService.js';
export * as TemplateEngine         from './TemplateEngine.js';
