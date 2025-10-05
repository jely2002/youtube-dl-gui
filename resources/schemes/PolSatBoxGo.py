payload = loadBody('json')
payload['params']['object'] = getChallenge('b64', Cdm.common_privacy_cert)
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['result']['object']['license']
