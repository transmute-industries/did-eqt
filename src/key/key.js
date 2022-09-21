const didJwk = require('@or13/did-jwk')

const create = async (alg = 'ES256') => {
  const { privateKeyJwk } = await didJwk.generateKeyPair(alg)
  return privateKeyJwk
}

module.exports = { create }
