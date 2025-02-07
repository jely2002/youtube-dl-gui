payload = loadBody('json')
payload['licenseRequest'] = getChallenge('b64', Cdm.common_privacy_cert)
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['license'].replace("-", "+").replace("_", "/")
