import csv

styles_with_back = set()
styles_with_side = set()
styles_total = set()

with open('/Users/briansinclair/Downloads/products 2.csv') as f:
    for row in csv.DictReader(f):
        sc = row.get('Style Code', '')
        if sc:
            styles_total.add(sc)
        if row.get('Back Image'):
            styles_with_back.add(sc)
        if row.get('Side Image'):
            styles_with_side.add(sc)

print(f'Total unique style codes: {len(styles_total)}')
print(f'Styles with back image: {len(styles_with_back)}')
print(f'Styles with side image: {len(styles_with_side)}')

# Check JH030 specifically
with open('/Users/briansinclair/Downloads/products 2.csv') as f:
    for row in csv.DictReader(f):
        if row.get('Style Code') == 'JH030':
            print(f"\nJH030 sample:")
            print(f"  Front: {row.get('Front Image', '')[:100]}")
            print(f"  Back:  {row.get('Back Image', '')[:100]}")
            print(f"  Side:  {row.get('Side Image', '')[:100]}")
            print(f"  Model: {row.get('Model Image', '')[:100]}")
            print(f"  Color: {row.get('Colourway Name', '')}")
            break
