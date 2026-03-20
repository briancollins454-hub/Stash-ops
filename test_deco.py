import http.cookiejar, urllib.request, urllib.parse

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Step 1: Log in to get session cookie
login_data = urllib.parse.urlencode({
    'Username': 'briansinclair',
    'Password': 'Beehive55!',
}).encode()

login_urls = [
    'https://marxcorporate.secure-decoration.com/admin/login',
    'https://marxcorporate.secure-decoration.com/login',
    'https://marxcorporate.secure-decoration.com/Account/Login',
]

for login_url in login_urls:
    try:
        req = urllib.request.Request(login_url, data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        resp = opener.open(req, timeout=15)
        print(f"  {login_url}: status={resp.status}, cookies={[c.name for c in cj]}")
    except Exception as e:
        print(f"  {login_url}: {e}")

print(f"\nAll cookies: {[(c.name, c.domain) for c in cj]}")

# Step 2: Try API with session cookies
params = urllib.parse.urlencode({
    'Username': 'briansinclair',
    'Password': 'Beehive55!',
    'Limit': '3'
})
api_url = f'https://marxcorporate.secure-decoration.com/api/json/manage_orders/find?{params}'
try:
    api_req = urllib.request.Request(api_url, headers={'Accept': 'application/json'})
    api_resp = opener.open(api_req, timeout=15)
    data = api_resp.read().decode()[:1500]
    print(f"\nAPI with session: {data}")
except Exception as e:
    print(f"\nAPI with session failed: {e}")

# Step 3: Also try without session but with Basic Auth
import base64
creds = base64.b64encode(b'briansinclair:Beehive55!').decode()
try:
    req2 = urllib.request.Request(
        f'https://marxcorporate.secure-decoration.com/api/json/manage_orders/find?Limit=3',
        headers={'Accept': 'application/json', 'Authorization': f'Basic {creds}'}
    )
    resp2 = urllib.request.urlopen(req2, timeout=15)
    print(f"\nBasic Auth (no query creds): {resp2.read().decode()[:500]}")
except Exception as e:
    print(f"\nBasic Auth failed: {e}")
