import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/** The error handler turns an exception into an HTTP response. */
server.errorHandler(() => import('#exceptions/handler'))

/** The server middleware stack runs on every HTTP request, even one no route matches. */
server.use([() => import('#middleware/container_bindings_middleware')])

/** The router middleware stack runs only on requests a registered route matches. */
router.use([() => import('@adonisjs/core/bodyparser_middleware')])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({})
