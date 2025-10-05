payload = loadBody("json")
payload["getWidevineLicense"]["widevineChallenge"] = getChallenge('b64')
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence["getWidevineLicenseResponse"]["license"]
