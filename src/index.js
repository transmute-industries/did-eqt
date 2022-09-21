require('dotenv').config()

const key = require('./key')
const identifier = require('./identifier')
const registry = require('./registry')

module.exports = {
  name: 'did:eqt',
  key,
  identifier,
  registry,
}
