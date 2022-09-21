const method = require('.')

const fastify = require('fastify')({ logger: true })
const path = require('path')

const getRegistry = async () => {
  return method.registry.connect({
    method: 'eqt',
    network: '0',
    urn: process.env.AWS_QLDB_ARN,
    table: process.env.AWS_QLDB_TABLE,
  })
}

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'static'),
  prefix: '/',
})

fastify.get('/1.0/identifiers/:did', async (request) => {
  const { did } = request.params
  const registry = await getRegistry()
  const resolution = await registry.identifier.read({ did })
  return resolution.data
})

fastify.post('/1.0/method/operations', async (request) => {
  const { jws } = request.body
  const registry = await getRegistry()
  return registry.operation.apply({ jws })
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
