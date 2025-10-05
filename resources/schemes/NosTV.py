payload = {
    'challenge': getChallenge('b64')
}
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence["license"][0]
