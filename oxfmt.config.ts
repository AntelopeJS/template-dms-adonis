import { antelopeFmtPreset } from '@antelopejs/tooling-configs/oxc/fmt'

/** The `@adonisjs/prettier-config` style, which the files `node ace make:*` generates follow. */
export default antelopeFmtPreset({
  printWidth: 100,
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  quoteProps: 'consistent',
  arrowParens: 'always',
  ignorePatterns: ['public/assets/**', 'resources/**', 'tmp/**'],
})
