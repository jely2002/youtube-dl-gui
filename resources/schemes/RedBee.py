payload = loadBody("json")
payload['message'] = getChallenge('b64')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['license']
