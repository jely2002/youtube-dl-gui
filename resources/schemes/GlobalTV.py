payload = loadBody("json")
payload['license_request_data'] = getChallenge('list')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "blob")
