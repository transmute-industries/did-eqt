const didJwk = require('@or13/did-jwk')

const {
  urnToCtyPrefix,
  getAuthenticationKeyId,
  dereferenceAuthenticationKey,
  signDidDocumentUpdate,
  compressKnownLedgers,
  disclaimDidDocument,
  claimDidDocument,
  formatDidDocument,
  computeRegistryDecentralizedIdentifier,
} = require('./utils')

const create = async (config) => {
  const { privateKeyJwk, registry } = config
  const ctyPrefix = urnToCtyPrefix(registry.urn)
  const did = await computeRegistryDecentralizedIdentifier({
    privateKeyJwk,
    registry,
  })
  const didDocument = compressKnownLedgers(
    claimDidDocument(did, didJwk.toDidDocument(privateKeyJwk)),
    registry
  )
  const unclaimedDidDocument = disclaimDidDocument(didDocument)
  return signDidDocumentUpdate(unclaimedDidDocument, privateKeyJwk, {
    iss: didDocument.id,
    kid: getAuthenticationKeyId(didDocument),
    cty: `${ctyPrefix}.did.create`,
  })
}

const decodeJws = (jws) => {
  const [encodedHeader, encodedPayload] = jws.split('.')
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64'))
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64'))
  return { header, payload }
}

const read = async (config) => {
  const { did, entry } = config
  const id = did.split(':').pop().split('#')[0]
  const txn = await entry.read(id)

  if (txn.status === 200) {
    const { jws } = txn.data._resultList[0]
    const { payload } = decodeJws(jws)
    const didDocument = formatDidDocument(claimDidDocument(did, payload))
    const meta = entry.utils.registryTxToDidMeta(txn)
    meta.didDocumentMetaData.deactivated =
      didDocument.verificationMethod === undefined
    return { ...txn, data: { didDocument, ...meta } }
  } else {
    return txn
  }
}

const update = async (config) => {
  const { did, kid, didDocument, privateKeyJwk, registry } = config
  const unclaimedDidDocument = disclaimDidDocument(didDocument)
  const ctyPrefix = urnToCtyPrefix(registry.urn)
  return signDidDocumentUpdate(unclaimedDidDocument, privateKeyJwk, {
    iss: did,
    kid: kid || '#0',
    cty: `${ctyPrefix}.did.update`,
  })
}

const deactivate = async (config) => {
  const { did, kid, privateKeyJwk, registry } = config
  const ctyPrefix = urnToCtyPrefix(registry.urn)
  return signDidDocumentUpdate({}, privateKeyJwk, {
    iss: did,
    kid: kid || '#0',
    cty: `${ctyPrefix}.did.deactivate`,
  })
}

const verifyCreateOperation = async (config) => {
  const { jws } = config
  const [encodedHeader, encodedPayload] = jws.split('.')
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64'))
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64'))
  if (!header.iss) {
    throw new Error('iss MUST be present in a did create operation header.')
  }
  const { iss } = header
  const kid = iss.split(':').pop()
  // TODO: verify with auth key instead.
  const { publicKeyJwk } = payload.verificationMethod[0]
  const computedKid = await didJwk.calculateJwkThumbprint(publicKeyJwk)
  if (kid !== computedKid) {
    throw new Error(
      'The did create operation MUST be signed by a public key that matches the iss'
    )
  }
  const verified = await didJwk.verifyWithKey(jws, publicKeyJwk)
  const valid = verified.protectedHeader.iss === iss
  return { valid, ...verified }
}

const verifyUpdateOperation = async (config) => {
  const { jws } = config
  const [encodedHeader] = jws.split('.')
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64'))
  if (!header.iss) {
    throw new Error('iss MUST be present in a did update operation header.')
  }
  const { iss, kid } = header
  const {
    status,
    message,
    data: { didDocument },
  } = await read({ did: iss, ...config })
  if (status === 200) {
    const authKey = dereferenceAuthenticationKey({
      didDocument,
      iss,
      kid,
    })
    const verified = await didJwk.verifyWithKey(jws, authKey.publicKeyJwk)
    const valid = verified.protectedHeader.iss === iss
    return { valid, ...verified }
  } else {
    return { valid: false, status, message, data }
  }
}

const apply = async ({ jws, registry, entry }) => {
  const [encodedHeader] = jws.split('.')
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64'))
  if (!header.iss) {
    throw new Error('iss MUST be present in a did operation header.')
  }

  const ctyPrefix = urnToCtyPrefix(registry.urn)

  if (!header.cty || !header.cty.startsWith(ctyPrefix)) {
    throw new Error(
      'cty MUST be present in a did operation header and MUST start with ' +
        ctyPrefix
    )
  }

  const applyCreateOperation = async ({ jws, entry }) => {
    const op = await verifyCreateOperation({ jws })
    if (op.valid) {
      const did = op.protectedHeader.iss
      const kid = did.split(':').pop()
      const doc = JSON.parse(op.payload.toString())
      const txn = await entry.create(kid, jws)
      if (txn.status === 200) {
        const didDocument = formatDidDocument(claimDidDocument(did, doc))
        const meta = entry.utils.registryTxToDidMeta(txn)
        meta.didDocumentMetaData.deactivated =
          didDocument.verificationMethod === undefined
        return { ...txn, data: { didDocument, ...meta } }
      } else {
        return { ...txn, data: { did } }
      }
    } else {
      return { ...op }
    }
  }

  // TODO: store operation in ledger
  const applyUpdateOperation = async ({ jws, entry }) => {
    const op = await verifyUpdateOperation({ jws, entry })
    if (op.valid) {
      const did = op.protectedHeader.iss
      const kid = did.split(':').pop()
      const doc = JSON.parse(op.payload.toString())
      if (doc.verificationMethod === undefined && Object.keys(doc).length > 0) {
        return {
          status: 400,
          message:
            'verificationMethod MUST be present in update operation, or payload empty in case of deactivate operation.',
        }
      }
      const txn = await entry.update(kid, jws)
      if (txn.status === 200) {
        const didDocument = formatDidDocument(claimDidDocument(did, doc))
        const meta = entry.utils.registryTxToDidMeta(txn)
        meta.didDocumentMetaData.deactivated =
          didDocument.verificationMethod === undefined
        return { ...txn, data: { didDocument, ...meta } }
      } else {
        return { ...txn, data: { did } }
      }
    } else {
      return { ...op }
    }
  }

  const ledgerOperations = {
    [`vnd.aws.qldb.did.create`]: applyCreateOperation,
    [`vnd.aws.qldb.did.update`]: applyUpdateOperation,
    [`vnd.aws.qldb.did.deactivate`]: applyUpdateOperation,
  }

  const response = await ledgerOperations[header.cty]({ jws, registry, entry })

  if (response.status === 409) {
    return response
  }

  if (response.data.didDocumentMetaData.deactivated) {
    response.message = 'An entry has been deactivated in the registry'
  }

  return response
}

module.exports = {
  create,
  read,
  update,
  deactivate,
  apply,
  verifyCreateOperation,
  verifyUpdateOperation,
  decodeJws,
}
