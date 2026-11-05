import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

/**
 * Encrypts cookies and signed URLs with AES-256-GCM. The first key encrypts and every key is
 * tried to decrypt, so a new `APP_KEY` goes first and the old one stays until its data expires.
 */
const encryptionConfig = defineConfig({
  default: 'gcm',
  list: {
    gcm: drivers.aes256gcm({ keys: [env.get('APP_KEY')], id: 'gcm' }),
  },
})

export default encryptionConfig

declare module '@adonisjs/core/types' {
  export interface EncryptorsList extends InferEncryptors<typeof encryptionConfig> {}
}
