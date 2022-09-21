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