licence = await corsFetch(licUrl, "POST", licHeaders, getChallenge('blob'), "json")
licence = licence['license']
