"""Rebuild the similarity index in public/data/ui_data.json.

Pre-launch index = weighted sum of seven fits, all known before launch:
  category_fit       1 same category · 0.7 same use occasion · 0.2 same segment only · 0 otherwise
  season_fit         1 if both products peak in the same season, else 0
  price_fit          kept from the dataset (continuous)
  channel_fit        kept from the dataset (continuous channel-mix overlap)
  purchase_type_fit  1 if both are consumables (bought again and again) or both are durables, else 0
  trade_fit          1 if both are trade/project-led (B2B share >= 25%) or both are retail-led, else 0
  pack_size_fit      kept from the dataset (continuous)

Weather sensitivity and supply route are dropped: weather was 1.0 for most pairs and did not separate
seasons, and supply did not rank pairs in order of how alike their demand was. Season and use occasion
replace them. Refined index, ranks and analogue weights follow the same rules as before:
  refined = 0.7 * pre-launch + 0.3 * (shape correlation + 1) / 2
  analogue weight = index / sum of the top-3 pre-launch indices (0 outside the top 3)

Existing products' seasons are read from their demand history (months with the highest demand); new
products' seasons and use occasions are planner inputs known before launch.

Run from the ui folder:  python scripts/rebuild_similarity.py
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'ui_data.json'

WEIGHTS = {'category_fit': 0.25, 'season_fit': 0.20, 'price_fit': 0.15, 'channel_fit': 0.10,
           'purchase_type_fit': 0.10, 'trade_fit': 0.10, 'pack_size_fit': 0.10}

# Season: festive = Sep–Nov peak (Puja/Diwali), summer = Apr–Jun peak (power cuts), monsoon = Jul–Sep, flat = no strong peak.
SEASON = {
    **dict.fromkeys(['pdc', 'dzl', 'neon', 'lb9', 'lb12', 'bt20', 'bt40'], 'festive'),
    **dict.fromkeys(['hyb', 'kis', 'rch', 'cvt', 'ins', 'neo', 'xtb'], 'summer'),
    **dict.fromkeys(['ham', 'cz-aaa'], 'monsoon'),
    **dict.fromkeys(['ult-aa', 'ultp-aa', 'ult-aaa', 'cz-aa', 'cz-d', 'cz-9v', 'pn12', 'dl15', 'tap', 'wir'], 'flat'),
    'npd01': 'festive', 'npd02': 'summer', 'npd03': 'flat', 'npd04': 'festive', 'npd05': 'monsoon',
}
USE = {
    **dict.fromkeys(['pdc', 'dzl', 'neon', 'npd01'], 'Festive decoration'),
    **dict.fromkeys(['hyb', 'kis', 'rch', 'cvt', 'ins', 'neo', 'xtb', 'npd02'], 'Power-cut backup'),
    **dict.fromkeys(['ult-aa', 'ultp-aa', 'ult-aaa', 'cz-aa', 'cz-aaa', 'cz-d', 'cz-9v', 'npd03'], 'Powering devices'),
    **dict.fromkeys(['lb9', 'lb12', 'ham', 'bt20', 'bt40', 'pn12', 'dl15', 'npd04'], 'Home lighting'),
    **dict.fromkeys(['tap', 'wir'], 'Electrical installation'),
    'npd05': 'Pest control',
}
SEASON_LABEL = {'festive': 'Festive (Sep–Nov)', 'summer': 'Summer power cuts (Apr–Jun)', 'monsoon': 'Monsoon (Jul–Sep)', 'flat': 'All year'}


def main():
    D = json.loads(DATA.read_text(encoding='utf-8'))
    P = {p['id']: p for p in D['prods']}
    for p in D['prods']:
        p['season'] = SEASON_LABEL[SEASON[p['id']]]
        p['use'] = USE[p['id']]
        p['purchase_type'] = 'Consumable' if p['seg'] in ('Batteries', 'Home care') else 'Durable'
        p['channel_type'] = 'Trade / project' if p['b2b'] >= 0.25 else 'Retail'

    def cat_fit(a, b):
        if a['cat'] == b['cat']: return 1.0
        if a['use'] == b['use']: return 0.7
        return 0.2 if a['seg'] == b['seg'] else 0.0

    rows = []
    for r in D['sim']:
        n, e = P[r['npd_id']], P[r['existing_id']]
        fits = {'category_fit': cat_fit(n, e), 'season_fit': float(n['season'] == e['season']), 'price_fit': r['price_fit'],
                'channel_fit': r['channel_fit'], 'purchase_type_fit': float(n['purchase_type'] == e['purchase_type']),
                'trade_fit': float(n['channel_type'] == e['channel_type']), 'pack_size_fit': r['pack_size_fit']}
        pre = round(sum(WEIGHTS[k] * v for k, v in fits.items()), 3)
        shape = r['demand_shape_corr_first13wk']
        ref = round(0.7 * pre + 0.3 * (shape + 1) / 2, 3) if shape is not None else pre
        rows.append({'npd_id': r['npd_id'], 'npd': r['npd'], 'existing_id': r['existing_id'], 'existing_product': r['existing_product'],
                     'existing_category': r['existing_category'], **fits, 'similarity_index_prelaunch': pre,
                     'demand_shape_corr_first13wk': shape, 'similarity_index_refined': ref,
                     'analogue_avg_weekly_units_52wk_before_launch': r['analogue_avg_weekly_units_52wk_before_launch']})

    for npd in {r['npd_id'] for r in rows}:
        g = [r for r in rows if r['npd_id'] == npd]
        for k, rk in (('similarity_index_prelaunch', 'rank_prelaunch'), ('similarity_index_refined', 'rank_refined')):
            for i, r in enumerate(sorted(g, key=lambda r: (-r[k], r['existing_id'])), 1): r[rk] = i
        top = sum(r['similarity_index_prelaunch'] for r in g if r['rank_prelaunch'] <= 3)
        for r in g:
            r['top3_analogue_prelaunch'] = int(r['rank_prelaunch'] <= 3)
            r['analogue_weight_prelaunch'] = round(r['similarity_index_prelaunch'] / top, 3) if r['rank_prelaunch'] <= 3 else 0.0

    D['sim'], D['simw'] = rows, WEIGHTS
    DATA.write_text(json.dumps(D, separators=(',', ':')), encoding='utf-8')
    for npd in sorted({r['npd_id'] for r in rows}):
        top = sorted((r for r in rows if r['npd_id'] == npd), key=lambda r: r['rank_prelaunch'])[:3]
        print(npd, [(r['existing_id'], r['similarity_index_prelaunch']) for r in top])


if __name__ == '__main__':
    main()
