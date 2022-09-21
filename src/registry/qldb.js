const { Agent } = require('https')
const { QldbDriver, RetryConfig } = require('amazon-qldb-driver-nodejs')

const ionjs = require('ion-js')

function charIsLetter(char) {
  if (typeof char !== 'string') {
    return false
  }
  return /^[a-zA-Z]+$/.test(char)
}

const isTableNameValid = (table) => {
  // table_name
  // The unique name of the table to create. An active table with the same name must not already exist. The following are the naming constraints:
  // - Is case sensitive.
  // - Must not be a QLDB PartiQL reserved word.
  // - Must only contain 1–128 alphanumeric characters or underscores.
  if (table.length > 128) {
    return {
      valid: false,
      reason: 'Must only contain 1-128 alphanumeric characters or underscores.',
    }
  }
  // - Must have a letter or an underscore for the first character.
  if (!charIsLetter(table[0] || table[0] === '_')) {
    return {
      valid: false,
      reason: 'Must have a letter or an underscore for the first character.',
    }
  }
  // - Can have any combination of alphanumeric characters and underscores for the remaining characters.
  return {
    valid: /^[a-zA-Z0-9_]+$/.test(table),
    reason: 'Does not match regex: /^[a-zA-Z0-9_]+$/',
  }
}

// https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html

const getDriver = (region, ledger) => {
  const maxConcurrentTransactions = 10
  const retryLimit = 4
  // Reuse connections with keepAlive
  const agentForQldb = new Agent({
    keepAlive: true,
    maxSockets: maxConcurrentTransactions,
  })
  // Use driver's default backoff function for this example (no second parameter provided to RetryConfig)
  const retryConfig = new RetryConfig(retryLimit)
  const serviceConfigurationOptions = {
    region,
    httpOptions: {
      agent: agentForQldb,
    },
  }
  return new QldbDriver(
    ledger,
    serviceConfigurationOptions,
    maxConcurrentTransactions,
    retryConfig
  )
}

const createVerifiableDataRegistry = async (config) => {
  const { arn } = config
  const { partition, service, region, accountId, ledger, table } = arn

  const validation = isTableNameValid(table)

  if (!validation.valid) {
    return {
      status: 400,
      message: 'Table name is not valid.',
      data: validation,
    }
  }

  const driver = getDriver(region, ledger)

  const tableCreated = await driver.executeLambda(async (txn) => {
    try {
      const { _resultList } = await txn.execute(`CREATE TABLE ${table}`)
      return {
        status: 200,
        message: 'A table was created',
        data: {
          table: `arn:${partition}:${service}:${region}:${accountId}:ledger/${ledger}/table/${_resultList[0].tableId}`,
        },
      }
    } catch (e) {
      return {
        status: 409,
        message: 'A table with this name already exists.',
      }
    }
  })

  if (tableCreated.status === 200) {
    return driver.executeLambda(async (txn) => {
      try {
        await driver.executeLambda(async (txn) => {
          return txn.execute(`CREATE INDEX ON ${table} (id)`)
        })
        return {
          status: 200,
          message: 'Verifiable data registry created.',
          data: tableCreated.data,
        }
      } catch (e) {
        cobsole.log(e)
        return {
          status: 409,
          message: 'An index on id in this table already exists.',
        }
      }
    })
  } else {
    return tableCreated
  }
}

const registryTxToDidMeta = (txn) => {
  const json = JSON.parse(JSON.stringify(txn))

  const didResolutionMetadata = {
    processingTimeMilliseconds:
      txn.data._timingInformation._processingTimeMilliseconds,
    ioUsage: {
      readIOs: txn.data._ioUsage._readIOs,
    },
  }

  const didDocumentMetaData = {}

  if (json.data._resultList[0].documentId) {
    didDocumentMetaData.documentId = json.data._resultList[0].documentId
  }

  return { didDocumentMetaData, didResolutionMetadata }
}

const connectToVerifiableDataRegistry = async (config) => {
  const { urn, identifier } = config
  let [arn, partition, service, region, accountId, ledger, table] =
    urn.split(':')

  if (arn !== 'arn') {
    throw new Error('Only arn resource names are currently supported.')
  }
  if (partition !== 'aws') {
    throw new Error('Only aws partition is currently supported.')
  }

  if (service !== 'qldb') {
    throw new Error('Only qldb service is currently supported.')
  }

  ;[_0, ledger, _1, table] = ledger.split('/')

  // Override ARN table id with ION Tabel Name.
  table = config.table

  const driver = getDriver(region, ledger)

  const query = (text) => {
    return driver.executeLambda(async (txn) => {
      const res = await txn.execute(text)
      return JSON.parse(JSON.stringify(res.getResultList(), null, 2))
    })
  }

  const createEntry = async (id, jws) => {
    return driver.executeLambda(async (txn) => {
      const results = (
        await txn.execute(`SELECT * FROM ${table} WHERE id = ?`, id)
      ).getResultList()

      if (results.length == 0) {
        const ionDoc = ionjs.load(
          ionjs.dumpBinary({
            id,
            jws,
          })
        )
        const res = await txn.execute(`INSERT INTO ${table} ?`, ionDoc)
        return {
          status: 200,
          message: 'An entry has been added from the registry',
          data: JSON.parse(JSON.stringify(res)),
        }
      } else {
        return {
          status: 409,
          message: 'An entry with this identifier has already been registered.',
        }
      }
    })
  }

  // can we get revision number for free?
  const readEntry = async (id) => {
    return driver.executeLambda(async (txn) => {
      const res = await txn.execute(`SELECT * FROM ${table} WHERE id = '${id}'`)
      const results = res.getResultList()
      if (results.length !== 0) {
        return {
          status: 200,
          message: 'An entry has been read from the registry',
          data: JSON.parse(JSON.stringify(res)),
        }
      } else {
        return {
          status: 404,
          message: 'An entry with this identifier has not been registered.',
        }
      }
    })
  }

  const updateEntry = async (id, jws) => {
    return driver.executeLambda(async (txn) => {
      const res = await txn.execute(
        `UPDATE ${table} SET jws = ? WHERE id = ?`,
        jws,
        id
      )
      const results = res.getResultList()
      if (results.length !== 0) {
        return {
          status: 200,
          message: 'An entry has been updated in the registry',
          data: JSON.parse(JSON.stringify(res)),
        }
      } else {
        return {
          status: 404,
          message: 'An entry with this identifier has not been registered.',
        }
      }
    })
  }

  const entry = {
    create: createEntry,
    read: readEntry,
    update: updateEntry,
    utils: {
      registryTxToDidMeta,
    },
  }

  return {
    driver,
    query,
    entry,
    identifier: {
      create: (args) => identifier.create({ registry: config, ...args }),
      read: (args) => identifier.read({ registry: config, entry, ...args }),
      update: (args) =>
        identifier.update({
          registry: config,
          entry,
          ...args,
        }),
      deactivate: (args) =>
        identifier.deactivate({
          registry: config,
          entry,
          ...args,
        }),
    },
    operation: {
      apply: (args) =>
        identifier.apply({
          registry: config,
          entry,
          ...args,
        }),
      verify: {
        create: (args) => identifier.verifyCreateOperation({ ...args }),
        update: (args) =>
          identifier.verifyUpdateOperation({
            registry: config,
            entry,
            ...args,
          }),
        deactivate: (args) =>
          identifier.verifyUpdateOperation({
            registry: config,
            entry,
            ...args,
          }),
      },
    },
  }
}

module.exports = {
  createVerifiableDataRegistry,
  connectToVerifiableDataRegistry,
}
