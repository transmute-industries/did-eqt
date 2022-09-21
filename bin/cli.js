#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const method = require('../src')

const didJwk = require('@or13/did-jwk')

const readJsonFromPath = (argv, argName) => {
  let value
  if (argv[argName]) {
    try {
      const file = fs
        .readFileSync(path.resolve(process.cwd(), argv[argName]))
        .toString()
      value = JSON.parse(file)
    } catch (e) {
      console.error('Cannot read from file: ' + argv[argName])
      process.exit(1)
    }
  }
  return value
}

const getRegistry = async () => {
  return method.registry.connect({
    method: 'eqt',
    network: '0',
    urn: process.env.AWS_QLDB_ARN,
    table: process.env.AWS_QLDB_TABLE,
  })
}
yargs(hideBin(process.argv))
  .scriptName(method.name)
  .command(
    'generate-key <alg>',
    'generate a key pair',
    () => {},
    async (argv) => {
      const { alg } = argv
      const key = await didJwk.generateKeyPair(alg)
      console.log(JSON.stringify(key.privateKeyJwk, null, 2))
    }
  )
  .command(
    'generate-for <purpose>',
    'generate a key for a purpose',
    () => {},
    async (argv) => {
      const { purpose } = argv
      const purposeToKeyOp = {
        authenticity: 'sign',
        privacy: 'encrypt',
      }
      const op = purposeToKeyOp[purpose]
      const key = await didJwk.generateKeyPairForOperation(op)
      console.log(JSON.stringify(key.privateKeyJwk, null, 2))
    }
  )
  .command(
    'create <jwk>',
    'create a decentralized identifier',
    () => {},
    async (argv) => {
      let jwk
      if (argv.jwk) {
        try {
          const file = fs
            .readFileSync(path.resolve(process.cwd(), argv.jwk))
            .toString()

          jwk = JSON.parse(file)
        } catch (e) {
          console.error('Cannot base jwk from: ' + argv.jwk)
          process.exit(1)
        }
      }
      const registry = await getRegistry()
      const createOperationJws = await registry.identifier.create({
        privateKeyJwk: jwk,
      })

      if (argv.publish) {
        const r0 = await registry.operation.apply({ jws: createOperationJws })
        console.log(JSON.stringify(r0, null, 2))
      } else {
        console.log(JSON.stringify({ jws: createOperationJws }, null, 2))
      }
    }
  )
  .command(
    'update <did> <doc> <jwk>',
    'update a decentralized identifier',
    () => {},
    async (argv) => {
      let jwk
      let doc
      if (argv.jwk) {
        try {
          const file = fs
            .readFileSync(path.resolve(process.cwd(), argv.jwk))
            .toString()

          jwk = JSON.parse(file)
        } catch (e) {
          console.error('Cannot get jwk from: ' + argv.jwk)
          process.exit(1)
        }
      }

      if (argv.doc) {
        try {
          const file = fs
            .readFileSync(path.resolve(process.cwd(), argv.doc))
            .toString()

          doc = JSON.parse(file)
        } catch (e) {
          console.error('Cannot get doc from: ' + argv.doc)
          process.exit(1)
        }
      }

      const registry = await getRegistry()
      const updateOperationJws = await registry.identifier.update({
        did: argv.did,
        didDocument: doc,
        privateKeyJwk: jwk,
      })

      if (argv.publish) {
        const r0 = await registry.operation.apply({ jws: updateOperationJws })
        console.log(JSON.stringify(r0, null, 2))
      } else {
        console.log(JSON.stringify({ jws: updateOperationJws }, null, 2))
      }
    }
  )
  .command(
    'deactivate <did> <jwk>',
    'deactivate a decentralized identifier',
    () => {},
    async (argv) => {
      let jwk
      if (argv.jwk) {
        try {
          const file = fs
            .readFileSync(path.resolve(process.cwd(), argv.jwk))
            .toString()

          jwk = JSON.parse(file)
        } catch (e) {
          console.error('Cannot get jwk from: ' + argv.jwk)
          process.exit(1)
        }
      }

      const registry = await getRegistry()
      const deactivateOperationJws = await registry.identifier.deactivate({
        did: argv.did,
        privateKeyJwk: jwk,
      })

      if (argv.publish) {
        const r0 = await registry.operation.apply({
          jws: deactivateOperationJws,
        })
        console.log(JSON.stringify(r0, null, 2))
      } else {
        console.log(JSON.stringify({ jws: deactivateOperationJws }, null, 2))
      }
    }
  )
  .command(
    'resolve <did>',
    'resolve a decentralized identifier',
    () => {},
    async (argv) => {
      const { did } = argv
      const registry = await getRegistry()
      const resolution = await registry.identifier.read({ did })
      console.log(JSON.stringify(resolution.data, null, 2))
    }
  )
  .command(
    'dereference <didUrl>',
    'dereference a decentralized identifier url',
    () => {},
    async (argv) => {
      const { didUrl } = argv
      const registry = await getRegistry()

      const resolution = await registry.identifier.read({
        did: didUrl.split('#')[0],
      })
      const key = method.identifier.utils.dereferenceDidUrl(
        resolution.data.didDocument,
        didUrl
      )
      console.log(JSON.stringify(key, null, 2))
    }
  )
  .command(
    'sign <jwk> <iss> <kid> <msg>',
    'sign a message as a decentralized identifier',
    () => {},
    async (argv) => {
      const jwk = readJsonFromPath(argv, 'jwk')
      const msg = readJsonFromPath(argv, 'msg')
      const message = new TextEncoder().encode(JSON.stringify(msg))
      const jws = await didJwk.sign(message, jwk, {
        iss: argv.iss,
        kid: argv.kid,
      })
      console.log(JSON.stringify({ jws }, null, 2))
    }
  )
  .command(
    'verify <msg>',
    'verify a message signed by a decentralized identifier',
    () => {},
    async (argv) => {
      const { jws } = readJsonFromPath(argv, 'msg')
      const decoded = await method.identifier.operation.decodeJws(jws)
      const registry = await getRegistry()
      const resolution = await registry.identifier.read({
        did: decoded.header.iss,
      })

      if (resolution.data.didDocumentMetaData.deactivated) {
        console.log(
          JSON.stringify(
            { verified: false, reason: 'Identifier is deactivated' },
            null,
            2
          )
        )
      } else {
        try {
          const { publicKeyJwk } = method.identifier.utils.dereferenceDidUrl(
            resolution.data.didDocument,
            decoded.header.iss + decoded.header.kid
          )
          const verified = await didJwk.verifyWithKey(jws, publicKeyJwk)
          if (argv.decode) {
            console.log(new TextDecoder().decode(verified.payload))
          } else {
            console.log(JSON.stringify({ verified }, null, 2))
          }
        } catch (e) {
          console.log(JSON.stringify({ verified: false }, null, 2))
        }
      }
    }
  )
  .command(
    'encrypt <did> <msg>',
    'encrypt a message to a decentralized identifier',
    () => {},
    async (argv) => {
      const did = argv.did
      const msg = readJsonFromPath(argv, 'msg')
      const message = new TextEncoder().encode(JSON.stringify(msg))

      const registry = await getRegistry()
      const resolution = await registry.identifier.read({
        did: argv.did,
      })

      if (resolution.data.didDocumentMetaData.deactivated) {
        console.log(
          JSON.stringify(
            { verified: false, reason: 'Identifier is deactivated' },
            null,
            2
          )
        )
      } else {
        try {
          const { publicKeyJwk } = method.identifier.utils.dereferenceDidUrl(
            resolution.data.didDocument,
            argv.did + resolution.data.didDocument.keyAgreement[0]
          )
          const jwe = await didJwk.encryptToKey(message, publicKeyJwk)
          console.log(JSON.stringify({ jwe }, null, 2))
        } catch (e) {
          console.log(JSON.stringify({ error: e.message }, null, 2))
        }
      }
    }
  )
  .command(
    'decrypt <jwk> <msg>',
    'encrypt a message to a decentralized identifier',
    () => {},
    async (argv) => {
      const jwk = readJsonFromPath(argv, 'jwk')
      const { jwe } = readJsonFromPath(argv, 'msg')
      const decrypted = await didJwk.decryptWithKey(jwe, jwk)

      if (argv.decode) {
        console.log(new TextDecoder().decode(decrypted.plaintext))
      } else {
        console.log(JSON.stringify({ decrypted }, null, 2))
      }
    }
  )
  .demandCommand(1)
  .parse()
