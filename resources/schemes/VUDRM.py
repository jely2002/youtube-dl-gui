payload = loadBody("json")
payload['drm_info'] = getChallenge('list')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "blob")
