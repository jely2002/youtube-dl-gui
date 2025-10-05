import xml.etree.ElementTree as ET
licence = await corsFetch(licUrl, "POST", licHeaders, getChallenge('b64', Cdm.common_privacy_cert), "blob")
licence = ET.fromstring(licence).find('.//{http://www.canal-plus.com/DRM/V1}license').text
