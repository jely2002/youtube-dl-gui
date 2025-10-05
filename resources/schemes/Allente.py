payload = {
    'playerPayload': base64.b64encode(cdm.service_certificate_challenge).decode()
}
service_cert = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
service_cert = service_cert['license']
payload = {
    'playerPayload': getChallenge('b64', service_cert)
}
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['license']
