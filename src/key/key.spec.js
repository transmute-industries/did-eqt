const method = require('..')

const jwk = {
  kid: 'urn:ietf:params:oauth:jwk-thumbprint:sha-256:Hh4q3-Q06g8CIH56553Pk17y1M_g_LojHsOMbpQ2lPQ',
  kty: 'EC',
  crv: 'P-256',
  alg: 'ES256',
  x: 'LpsWKYbHasiRyPwl7ZFe---FEAYPQkczYREwfSG9zZM',
  y: 'VTZh4ZhiLH-01q8pMrtzU1N3fVRMk1hgx4ETsZWTTgI',
  d: 'SX_aB7YflsCR9KxNTMF6AYZhccjR3gw0wm4qe6CDsDE',
}

method.key.create = jest.fn(async () => {
  return jwk
})

it('create', async () => {
  const privateKeyJwk = await method.key.create('ES256')
  expect(privateKeyJwk.kid).toBe(jwk.kid)
})
