import re


def replaceRequest(payload):
    challenge_blob = getChallenge('blob')
    challengeB64 = getChallenge('b64')
    challengeArr = str(getChallenge('list'))

    # Trying decode payload, challenge might be raw bytes if it failed
    try:
        decodedPayload = payload.decode()
    except:
        return challenge_blob

    # Challenge might be JSON/XML stored B64-encoded string
    replaced = decodedPayload.replace(r"(?<=(\"|\'|>))CAES.*?(?=(\"|\'|<))", challengeB64).replace(r"(?<=(\"|\'|>))CAQ=(?=(\"|\'|<))", challengeB64)
    if(decodedPayload != replaced):
        return replaced

    # Challenge might be raw B64-encoded string
    replaced = decodedPayload.replace(r"^CAES.*?=$", challengeB64).replace(r"^CAQ=$", challengeB64)
    if(decodedPayload != replaced):
        return replaced

    # Challenge might be Uint8Array
    replaced = decodedPayload.replace(r"\[0?8 ?, ?0?1 ?, ?[0-9 ,]*?\]", challengeArr).replace(r"\[0?8 ?, ?0?4]", challengeArr)
    if(decodedPayload != replaced):
        return replaced


def findLicense(response):
    # Trying decode response, license might be raw bytes if it failed
    try:
        decodedResponse = response.decode()
    except:
        return response

    # License might be JSON/XML stored B64-encoded string
    try:
        return re.search(r"(?<=(\"|\'|>))CAIS.*?(?=(\"|\'|<))", decodedResponse).group()
    except:
        pass

    # License might be raw B64-encoded string
    try:
        return re.search(r"^CAIS.*?=$", decodedResponse).group()
    except:
        pass

    # License might be Uint8Array
    try:
        foundStr = re.search(r"\[0?8 ?, ?0?2 ?, ?[0-9 ,]*?\]", decodedResponse).group()
        return bytes(json.loads(foundStr))
    except:
        pass


payload = loadBody("blob")
payload = replaceRequest(payload)
response = await corsFetch(licUrl, "POST", licHeaders, payload, "blob")
licence = findLicense(response)
