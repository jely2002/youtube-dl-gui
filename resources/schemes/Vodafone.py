payload = loadBody("json")
payload['requests'][3]['params']['challenge'] = getChallenge('b64')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['license']
