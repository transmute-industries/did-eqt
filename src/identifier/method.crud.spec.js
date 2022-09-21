const method = require('..')
const fs = require('fs')

describe('DID Method Operations', () => {
  let fixture = {}
  let registry
  let privateKeyJwk
  let didDocument
  let lastUpdated
  let createOperationJws
  let resolveAfterCreate
  let updateOperationJws
  let resolveAfterUpdate
  let deactivateOperationJws
  let resolveAfterDeactivate

  beforeAll(async () => {
    const config = {
      arn: {
        partition: 'aws',
        service: 'qldb',
        region: 'us-east-2',
        accountId: process.env.AWS_ACCOUNT_ID,
        ledger: 'transmute-scitt-ledger-test',
        table: 'test3',
      },
    }
    // const response = await method.registry.create(config)
    registry = await method.registry.connect({
      method: 'eqt',
      network: '0',
      // urn: response.data.table, // see qldb dashboard
      urn: process.env.AWS_QLDB_ARN,
      table: config.arn.table,
    })
    expect(registry.driver).toBeDefined()
    privateKeyJwk = await method.key.create('ES256')
    expect(privateKeyJwk.alg).toBe('ES256')
  })

  describe('CREATE', () => {
    it('can create and verify identifier method create operation', async () => {
      createOperationJws = await registry.identifier.create({
        privateKeyJwk,
      })
      const opv = await registry.operation.verify.create({
        jws: createOperationJws,
      })
      expect(opv.valid).toBe(true)
    })

    it('can apply identifier create operation', async () => {
      const r0 = await registry.operation.apply({ jws: createOperationJws })
      expect(r0.status).toBe(200)
      expect(r0.message).toBe('An entry has been added from the registry')
      didDocument = r0.data.didDocument
    })

    it('can resolve after create', async () => {
      const r1 = await registry.identifier.read({
        did: didDocument.id,
      })
      expect(r1.status).toBe(200)
      expect(r1.message).toBe('An entry has been read from the registry')
      resolveAfterCreate = r1
    })
  })

  describe('UPDATE', () => {
    it('can create and verify identifier method update operation', async () => {
      lastUpdated = new Date().toISOString()
      updateOperationJws = await registry.identifier.update({
        did: didDocument.id,
        didDocument: {
          ...didDocument,
          lastUpdated,
        },
        privateKeyJwk,
      })
      const opv = await registry.operation.verify.update({
        jws: updateOperationJws,
      })
      expect(opv.valid).toBe(true)
    })

    it('can apply identifier update operation', async () => {
      const r0 = await registry.operation.apply({ jws: updateOperationJws })
      expect(r0.status).toBe(200)
      expect(r0.message).toBe('An entry has been updated in the registry')
      didDocument = r0.data.didDocument
    })

    it('can resolve after update', async () => {
      const r1 = await registry.identifier.read({
        did: didDocument.id,
      })
      expect(r1.status).toBe(200)
      expect(r1.message).toBe('An entry has been read from the registry')
      expect(r1.data.didDocument.lastUpdated).toBe(lastUpdated)
      resolveAfterUpdate = r1
    })
  })

  describe('DEACTIVATE', () => {
    it('can create and verify identifier method deactivate operation', async () => {
      lastUpdated = new Date().toISOString()
      deactivateOperationJws = await registry.identifier.deactivate({
        did: didDocument.id,
        privateKeyJwk,
      })
      const opv = await registry.operation.verify.deactivate({
        jws: deactivateOperationJws,
      })
      expect(opv.valid).toBe(true)
    })

    it('can apply identifier deactivate operation', async () => {
      const r0 = await registry.operation.apply({ jws: deactivateOperationJws })
      expect(r0.status).toBe(200)
      expect(r0.message).toBe('An entry has been deactivated in the registry')
      didDocument = r0.data.didDocument
    })

    it('can resolve after deactivate', async () => {
      const r1 = await registry.identifier.read({
        did: didDocument.id,
      })
      expect(r1.status).toBe(200)
      expect(r1.message).toBe('An entry has been read from the registry')
      expect(r1.data.didDocumentMetaData.deactivated).toBe(true)
      resolveAfterDeactivate = r1
    })
  })

  afterAll(async () => {
    fixture[privateKeyJwk.kid] = {
      privateKeyJwk,
      operations: [
        createOperationJws,
        updateOperationJws,
        deactivateOperationJws,
      ],
      resolutions: [
        resolveAfterCreate,
        resolveAfterUpdate,
        resolveAfterDeactivate,
      ],
    }

    fs.writeFileSync(
      './docs/test-vectors/generated-test-vectors.json',
      JSON.stringify(fixture, null, 2)
    )
  })
})
