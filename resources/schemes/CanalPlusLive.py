payload = loadBody('json')
payload['ServiceRequest']['InData']['ChallengeInfo'] = getChallenge('b64', Cdm.common_privacy_cert)
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence["ServiceResponse"]["OutData"]["LicenseInfo"]
