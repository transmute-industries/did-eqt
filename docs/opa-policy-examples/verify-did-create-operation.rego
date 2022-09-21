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