#!/usr/bin/env python3
import json, urllib.request

# Test what Deco search returns for W72
req = urllib.request.Request("https://stash-api-production-7f18.up.railway.app/api/v1/quotes/products?q=W72&limit=5")
data = json.loads(urllib.request.urlopen(req, timeout=15).read())
print("Deco results for W72:")
for p in data.get("items", [])[:5]:
    print(f"  id={p.get('decoProductId')} sku={p.get('sku')} name={p.get('name','')[:50]}")

# Test catalog search  
req2 = urllib.request.Request("https://stash-api-production-7f18.up.railway.app/api/v1/catalog/search?q=hoody&limit=5")
data2 = json.loads(urllib.request.urlopen(req2, timeout=15).read())
print("\nCatalog results for 'hoody':")
for p in data2[:5]:
    print(f"  {p.get('styleCode')} {p.get('brand')} {p.get('name')}")
