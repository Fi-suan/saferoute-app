// ESLint flat config — .eslintrc.json больше не читается начиная с ESLint 9.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'backend/**',
      'android/**',
      'ios/**',
      'eslint.config.js',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    // Правило из @typescript-eslint должно применяться только там, где expo-конфиг
    // подключил сам плагин, иначе ESLint падает на .js-файлах конфигурации.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-unescaped-entities': 'off',

      // ── Правила React Compiler (eslint-plugin-react-hooks v6) ──────────────
      // Понижены до warn осознанно, а не спрятаны: они подсвечивают настоящий
      // технический долг, но чинить его вслепую нельзя.
      //
      // refs — все 12 срабатываний приходятся на паттерн
      //   useRef(new Animated.Value(0)).current
      // в ProximityBanner, Skeleton и OnboardingScreen. Для RN-анимаций это
      // общепринятый приём, переписывание тянет за собой всю анимационную часть.
      //
      // set-state-in-effect и purity — реальные запахи (useLivestock,
      // useRoutePolyline, MapScreen, IncidentDetailScreen), но это рефакторинг
      // с риском регрессий, который нужно проверять на живом устройстве.
      //
      // exhaustive-deps — часть зависимостей опущена намеренно (эффекты по
      // location?.lat), досыпать их вслепую значит менять поведение.
      //
      // Разгребается отдельной задачей; ошибкой не делаем, чтобы CI ловил
      // настоящие поломки, а не спорил про стиль хуков.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
