import { antelopeNuxtConfig } from '@antelopejs/tooling-configs/eslint'

export default antelopeNuxtConfig().prepend({ ignores: ['.dms-types/**'] })
