payload = loadBody("json")
payload['rawLicense'] = getChallenge('b64')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['rawLicense']
