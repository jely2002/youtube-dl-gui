import urllib.parse
payload = f'widevine2Challenge={urllib.parse.quote(base64.b64encode(cdm.service_certificate_challenge).decode())}&includeHdcpTestKeyInLicense=true'
service_cert = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
service_cert = service_cert['widevine2License']['license']
payload = f'widevine2Challenge={urllib.parse.quote(getChallenge("b64", service_cert))}&includeHdcpTestKeyInLicense=true'
licence = await corsFetch(licUrl, "POST", licHeaders, payload, "json")
licence = licence['widevine2License']['license']
