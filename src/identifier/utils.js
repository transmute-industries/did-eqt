const didJwk = require('@or13/did-jwk')

const defaultContext = [
  'https://www.w3.org/ns/did/v1',
  {
    '@vocab': 'https://www.iana.org/assignments/jose#',
  },
]

const computeRegistryDecentralizedIdentifier = async ({
  privateKeyJwk,
  registry,
}) => {
  const { method, urn } = registry
  const id = await didJwk.calculateJwkThumbprint(privateKeyJwk)
  return `did:${method}:${urn}:${id}`
}

const formatVerificationMethod = (verificationMethod) => {
  const { id, type, controller, publicKeyJwk, ...rest } = verificationMethod
  return JSON.parse(
    JSON.stringify({
      id,
      type,
      controller,
      publicKeyJwk,
      ...rest,
    })
  )
}

const formatDidDocument = (didDocument) => {
  const {
    id,
    controller,
    alsoKnownAs,
    verificationMethod,
    authentication,
    assertionMethod,
    capabilityInvocation,
    capabilityDelegation,
    keyAgreement,
    service,
    ...rest
  } = didDocument
  return JSON.parse(
    JSON.stringify({
      '@context': didDocument['@context'] || defaultContext,
      id,
      controller,
      alsoKnownAs,
      verificationMethod: verificationMethod
        ? verificationMethod.map(formatVerificationMethod)
        : undefined,
      authentication,
      assertionMethod,
      capabilityInvocation,
      capabilityDelegation,
      keyAgreement,
      service,
      ...rest,
    })
  )
}

const claimDidDocument = (did, didDocument) => {
  const clone = JSON.parse(JSON.stringify(didDocument))
  clone.id = did
  if (clone.verificationMethod) {
    clone.verificationMethod = clone.verificationMethod.map((vm) => {
      vm.controller = did
      return vm
    })
  }
  return clone
}

const disclaimDidDocument = (didDocument) => {
  const clone = JSON.parse(JSON.stringify(didDocument))
  delete clone.id

  if (clone.verificationMethod) {
    clone.verificationMethod = clone.verificationMethod.map((vm) => {
      delete vm.controller
      return vm
    })
  }

  return clone
}

const compressKnownLedgers = (didDocument, registry) => {
  const did = didDocument.id.replace(registry.urn, registry.network)
  return claimDidDocument(did, didDocument)
}

const expandKnownLedgers = (didDocument, registry) => {
  const did = didDocument.id.replace(registry.network, registry.urn)
  return claimDidDocument(did, didDocument)
}

const signDidDocumentUpdate = async (
  unclaimedDidDocument,
  privateKeyJwk,
  header
) => {
  return didJwk.signAsDid(
    Buffer.from(JSON.stringify(unclaimedDidDocument)),
    privateKeyJwk,
    header
  )
}

const getAuthenticationKeyId = (didDocument) => {
  return didDocument.authentication[0]
}

const urnToCtyPrefix = (urn) => {
  const [label, parition, service] = urn.split(':')
  return { ['arn']: `vnd.${parition}.${service}` }[label]
}

const dereferenceAuthenticationKey = ({ didDocument, iss, kid }) => {
  return didDocument.verificationMethod.find((vm) => {
    return (
      vm.controller === iss &&
      vm.id === kid &&
      didDocument.authentication.includes(kid)
    )
  })
}

const dereferenceDidUrl = (didDocument, didUrl) => {
  const bucket = [
    ...didDocument.verificationMethod,
    ...(didDocument.service || []),
  ]
  const matches = bucket.filter((p) => {
    return didUrl.endsWith(p.id)
  })
  return matches.length > 0 ? matches[0] : null
}

module.exports = {
  urnToCtyPrefix,
  getAuthenticationKeyId,
  dereferenceAuthenticationKey,
  signDidDocumentUpdate,
  compressKnownLedgers,
  expandKnownLedgers,
  disclaimDidDocument,
  claimDidDocument,
  formatDidDocument,
  formatVerificationMethod,
  computeRegistryDecentralizedIdentifier,
  dereferenceDidUrl,
}
