const fs = require('fs')
const jwkToPem = require('jwk-to-pem')
const testVectors = require('../docs/test-vectors/generated-test-vectors.json')

;(async () => {
  const { privateKeyJwk, operations } = testVectors[Object.keys(testVectors)[0]]
  const { d, ...publicKeyJwk } = privateKeyJwk
  const publicKeyPem = jwkToPem(publicKeyJwk)
  fs.writeFileSync(
    './docs/opa-policy-examples/verify-did-create-operation.input.json',
    JSON.stringify({ publicKeyPem, jws: operations[0] }, null, 2)
  )
})()
