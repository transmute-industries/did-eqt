const identifier = require('../identifier/operation')

const qldb = require('./qldb')

const unsupportedResponse = {
  status: 501,
  message:
    'Amazon QLDB is the only supported registry at this time. See https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.',
}

const registry = {
  create: async (config) => {
    if (!config.arn) {
      return unsupportedResponse
    }
    if (!config.identifier) {
      config.identifier = identifier
    }
    return qldb.createVerifiableDataRegistry(config)
  },
  connect: async (config) => {
    if (!config.urn.startsWith('arn:aws:qldb:')) {
      return unsupportedResponse
    }
    if (!config.identifier) {
      config.identifier = identifier
    }
    return qldb.connectToVerifiableDataRegistry(config)
  },
}

module.exports = registry
