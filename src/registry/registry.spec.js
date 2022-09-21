const method = require('..')

method.registry.create = jest.fn((config) => {
  const { arn } = config
  const { partition, service, region, accountId, ledger, table } = arn
  return {
    status: 200,
    message: 'Verifiable data registry created.',
    data: {
      table: `arn:${partition}:${service}:${region}:${accountId}:ledger/${ledger}/table/1111111111111111111111`,
    },
  }
})

method.registry.connect = jest.fn(() => {
  return {
    key: {},
    identifier: {},
  }
})

it('create', async () => {
  const response = await method.registry.create({
    arn: {
      partition: 'aws',
      service: 'qldb',
      region: 'us-east-2',
      accountId: 111111111111,
      ledger: 'transmute-scitt-registry-test',
      table: 'test3',
    },
  })
  expect(response).toEqual({
    status: 200,
    message: 'Verifiable data registry created.',
    data: {
      table:
        'arn:aws:qldb:us-east-2:111111111111:ledger/transmute-scitt-registry-test/table/1111111111111111111111',
    },
  })
})

it('connect', async () => {
  const client = await method.registry.connect({
    method: 'eqt',
    network: '0',
    table: 'test3',
    urn: `arn:aws:qldb:us-east-2:111111111111:ledger/test/table/1111111111111111111111`,
  })
  expect(client.key).toBeDefined()
  expect(client.identifier).toBeDefined()
})
