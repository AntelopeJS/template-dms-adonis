/**
 * Not read at runtime: `ajs project init` keeps a template's own `antelope.config.ts` instead of
 * writing one and building a module that an AdonisJS application does not have. The modules this
 * application loads are listed in `providers/antelope_provider.ts`.
 */
export default { name: 'template-dms-adonis', modules: {} }
