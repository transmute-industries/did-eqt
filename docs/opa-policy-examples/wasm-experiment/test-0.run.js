const fs = require('fs')

const { loadPolicy } = require('@open-policy-agent/opa-wasm')

;(async () => {
  console.log('testing opa...')
  const policyWasm = fs.readFileSync('./policies/test-0.wasm')
  const policy = await loadPolicy(policyWasm)

  policy.setData({ world: 'world' })

  const resultSet1 = policy.evaluate({ message: 'world' })
  console.log(resultSet1)

  const resultSet2 = policy.evaluate({ message: 'bar' })
  console.log(resultSet2)
})()
