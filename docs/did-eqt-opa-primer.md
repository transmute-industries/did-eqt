# Decentralized Identifiers & Open Policy Agent

Decentralized Identifiers (DIDs) can be extended with advanced policy managment capabilities by integrating with Open Policy Agent (OPA).

This primary seeks to explain two common scenarios, the first leverages OPA in the DID method operations themselves,
the second shows how to use DIDs to store OPA policies for the purpose of evaluating arbitrary claims or verifiable credentials.

### Getting Started

```
curl -L -o opa https://github.com/open-policy-agent/opa/releases/download/v0.44.0/opa_darwin_amd64
chmod +x ./opa
```

### Securing DID Method Operations with OPA

There are 3 DID Method operations which change the state of a given DID.

- CREATE
- UPDATE
- DEACTIVATE

Using OPA, a policy can be written to decide if a given operation should be applied to the verifiable data registry or not.

For example, the following rego policy could be used to ensure that a create operation is valid, and that a new DID should be registered:

```rego
package verify_did_create_operation

verified {
    output := io.jwt.verify_es256(input.jws, input.publicKeyPem)
}

authentication_relationship {
    [header, payload, _] := io.jwt.decode(input.jws)
    header.kid == payload.authentication[0]
    payload.verificationMethod[0].id == payload.authentication[0]
    split(header.iss, ":")[3] == split(payload.verificationMethod[0].publicKeyJwk.kid, ":")[6]
}
```

In order to apply this policy, we will need to transform one of the test-vector outputs to support publicKeyPem:

```
node ./scripts/prepare-verify-did-create-operation-rego-input.js
```

#### Evaluate a DID Creation Operation against a Rego Policy

```
./opa eval --format pretty data \
-i ./docs/opa-policy-examples/verify-did-create-operation.input.json \
-d ./docs/opa-policy-examples/verify-did-create-operation.rego
```

This will return:

```json
{
  "verify_did_create_operation": {
    "authentication_relationship": true,
    "verified": true
  }
}
```

### Notarising Verifiable Credentials with OPA

A device manufacturer might be trusted to make a claim about certain device software, but a retailer might not.

When a claim is made, how can a notary evaluate if the claim should be endorsed or not?

#### Evaluating Endorsement Policies for Verifiable Credentials with OPA

Consider the following cold chain policy intended to keep protect consumers of sea food:

```rego
package verify_epcis_cold_chain

import future.keywords.in

default endorse = false

default force_validation_error = false

issuer_is_authorized {
    input.credential.issuer.id in input.authorized_cold_chain_inspectors
}

credential_type_is_acceptable {
    "EPCISDocumentCredential" in input.credential.type
}


credential_claims_are_active {
    time.parse_rfc3339_ns(input.credential.issuanceDate) <= time.now_ns()
}


temperature_claim_provided {
    "Temperature" == input.credential.credentialSubject.eventList[0].sensorElementList[0].sensorReport[0].type
}


temperature_claim_is_in_the_past {
    endTime := input.credential.credentialSubject.eventList[0].sensorElementList[0].sensorMetadata.endTime
    time.parse_rfc3339_ns(endTime) <= time.now_ns()
}

endorse {
    issuer_is_authorized
    credential_type_is_acceptable
    credential_claims_are_active
    temperature_claim_provided
    temperature_claim_is_in_the_past
    not force_validation_error
}
```

Consider this example Verifiable Credential, issued by a cold chain automated inspection service:

```json
{
  "authorized_cold_chain_inspectors": ["did:example:123"],
  "credential": {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    "id": "urn:uuid:987",
    "type": ["VerifiableCredential", "EPCISDocumentCredential"],
    "issuer": {
      "id": "did:example:123",
      "type": ["Device", "ColdChainInspector"]
    },
    "issuanceDate": "2010-01-01T19:23:24Z",
    "credentialSubject": {
      "id": "did:example:456",
      "type": ["EPCISDocument"],
      "eventList": [
        {
          "type": "ObjectEvent",
          "action": "OBSERVE",
          "bizStep": "inspecting",
          "epcList": ["urn:epc:id:sgtin:4012345.011111.9876"],
          "eventTime": "2019-04-02T15:00:00.000+01:00",
          "eventTimeZoneOffset": "+01:00",
          "readPoint": {
            "id": "urn:epc:id:sgln:4012345.00005.0"
          },
          "sensorElementList": [
            {
              "sensorMetadata": {
                "startTime": "2019-04-01T15:00:00.000+01:00",
                "endTime": "2019-04-02T14:59:59.999+01:00"
              },
              "sensorReport": [
                {
                  "type": "Temperature",
                  "minValue": 12.4,
                  "maxValue": 13.8,
                  "uom": "CEL"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

We can evaluate this credential against the policy to see if this claim meets the criteria for endorsement:

```
./opa eval --format pretty data \
-i ./docs/opa-policy-examples/verify-epcis-cold-chain.input.json \
-d ./docs/opa-policy-examples/verify-epcis-cold-chain.rego
```

We can see that it does, and the reasons why:

```json
{
  "verify_epcis_cold_chain": {
    "credential_claims_are_active": true,
    "credential_type_is_acceptable": true,
    "endorse": true,
    "force_validation_error": false,
    "issuer_is_authorized": true,
    "temperature_claim_is_in_the_past": true,
    "temperature_claim_provided": true
  }
}
```
