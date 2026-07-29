import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // المطلوب الأساسي: منع استخدام JSX مكوّن غير مستورد
      'react/jsx-no-undef': 'error',

      // react-hooks مُفعَّل بـ warn لمنع "rule not found" errors من التعليقات المضمَّنة
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // تقليل الضجيج — الأخطاء القديمة تُعالج في مهام منفصلة
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
      'no-extra-boolean-cast': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'vite.config.ts',
      'tailwind.config.ts',
      'postcss.config.js',
      'scripts/**',
    ],
  }
);
