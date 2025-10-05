payload = loadBody('json')
payload['payload'] = getChallenge('b64')
licence = await corsFetch (licUrl, "POST", licHeaders, payload, "blob")
