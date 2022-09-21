const method = require('..')

const fixture = require('../../docs/test-vectors/generated-test-vectors.json')

describe('identifier method utils', () => {
  it('can expand and compress registry identifiers', async () => {
    const kid = Object.keys(fixture)[0]
    const doc0 = fixture[kid].resolutions[0].data.didDocument
    expect(doc0.id.startsWith('did:eqt:0:')).toBe(true)
    const doc1 = method.identifier.utils.expandKnownLedgers(doc0, {
      network: '0',
      urn: `arn:aws:qldb:us-east-2:111111111111:ledger/test/table/1111111111111111111111`,
    })
    expect(
      doc1.id.startsWith(
        'did:eqt:arn:aws:qldb:us-east-2:111111111111:ledger/test/table/1111111111111111111111:'
      )
    ).toBe(true)
  })
})
