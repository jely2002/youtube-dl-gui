payload = loadBody("json")
payload['licenseRequest'] = getChallenge('b64')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence["result"]["license"]
