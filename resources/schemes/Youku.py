import urllib.parse
payload = urllib.parse.parse_qs(loadBody("str"))
payload['licenseRequest'] = [getChallenge('b64')]
payload = {k: v[0] for k, v in payload.items()}
payload = urllib.parse.urlencode(payload)
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['data']
