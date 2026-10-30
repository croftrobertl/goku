#!/usr/bin/env python3
"""Builds data/interactions.json for the supplement interaction checker (2.4; plain-language text in 2.5).
Source text: the "Interactions with Medications" sections of the NIH Office of Dietary Supplements
health professional fact sheets (ods.od.nih.gov), which ODS says are in the public domain and may be
reproduced unchanged. tools/src/ods-interactions.json holds that text exactly as published on
2026-10-29; its checksum below was taken from the live pages, so any edit to the NIH words fails here.
Goku adds only: a few labels for sections without a heading (marked own: true) and the medicine
names each section is matched on (the names NIH writes, plus common members of the drug classes it
names, so "lisinopril" finds a paragraph about ACE inhibitors).
2.5: the text shown is from the CONSUMER fact sheets ("Does X interact with medications or other dietary
supplements?"), in tools/src/ods-consumer.json, checked the same way. The health professional text
is used only where NIH has no consumer section (black cohosh, valerian, ashwagandha).
Usage: python3 -I tools/build-interactions.py (from the goku folder)."""
import json, re, hashlib

raw_text = open('tools/src/ods-interactions.json', encoding='utf-8').read()
raw = json.loads(raw_text)
compact = json.dumps(raw, ensure_ascii=False, separators=(',', ':'))
assert hashlib.sha256(compact.encode()).hexdigest() == '83d0a949b1e52951494405991f4a5b37adfe6ac163eb1b4aed2200836ebc242e', 'NIH text changed'
consumer = json.loads(open('tools/src/ods-consumer.json', encoding='utf-8').read())
assert hashlib.sha256(json.dumps(consumer, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == '8ae981fa303cd02133f43fbdb1caf36d5d4af142483984f00d37f7601700400e', 'NIH consumer text changed'

# Paragraphs from two fact sheets laid out differently (checked against the live pages the same way).
EXTRA = {
  'Ashwagandha': ('May 2, 2025', 'Ashwagandha', 'Thyroid, diabetes, blood pressure, immunosuppressant and sedative medicines', 'b447f9d020f1',
    'Three case reports have also described thyrotoxicosis in women who were taking ashwagandha extract (age range 32–73 years) [31]. However, the doses of ashwagandha were not specified in two of these case reports, and the third case involved an unusually high dose (1,950 mg/day for more than 2 months) [32]. Discontinuing ashwagandha resolved the symptoms of thyrotoxicosis in all three cases. These findings suggest that ashwagandha might interact with thyroid hormone medications. Ashwagandha might also interact with other medications, including antidiabetes medications, antihypertensives, immunosuppressants, and sedatives [8,33].'),
  'Caffeine': ('April 1, 2024', 'ExerciseAndAthleticPerformance', 'Cimetidine', '010e17c1a621',
    'Cimetidine (Tagamet HB, used to treat duodenal ulcers) can slow the rate of caffeine clearance from the body and thereby increase the risk of adverse effects from caffeine consumption [219].'),
  'Ginseng': ('April 1, 2024', 'ExerciseAndAthleticPerformance', 'Warfarin', 'a6bca8262114',
    'Ginseng can reduce the anticoagulant effects of the blood thinner warfarin (Coumadin or Jantoven) [216].'),
}
for k, (d, slug, head, h, text) in EXTRA.items():
    assert hashlib.sha256(text.encode()).hexdigest()[:12] == h, f'{k} text changed'

# Drug classes NIH names, with common members (generic names, lowercase).
CLASS = {
  'ace': 'benazepril captopril enalapril fosinopril lisinopril quinapril ramipril perindopril trandolapril',
  'arb': 'losartan valsartan irbesartan olmesartan candesartan telmisartan',
  'statin': 'atorvastatin simvastatin rosuvastatin pravastatin lovastatin fluvastatin pitavastatin',
  'ppi': 'omeprazole esomeprazole lansoprazole pantoprazole rabeprazole dexlansoprazole',
  'h2': 'famotidine cimetidine nizatidine ranitidine',
  'quinolone': 'ciprofloxacin levofloxacin moxifloxacin ofloxacin gemifloxacin',
  'tetracycline': 'tetracycline doxycycline minocycline demeclocycline',
  'thiazide': 'hydrochlorothiazide chlorthalidone chlorothiazide indapamide metolazone',
  'loop': 'furosemide bumetanide torsemide',
  'ksparing': 'spironolactone amiloride triamterene eplerenone',
  'coumarin': 'warfarin jantoven coumadin',
  'antiplatelet': 'clopidogrel prasugrel ticagrelor aspirin',
  'anticoag': 'apixaban rivaroxaban dabigatran edoxaban heparin enoxaparin',
  'seizure': 'carbamazepine phenytoin phenobarbital primidone valproate valproic levetiracetam',
  'diabetes': 'metformin insulin glipizide glimepiride glyburide pioglitazone sitagliptin empagliflozin dapagliflozin canagliflozin semaglutide liraglutide dulaglutide tirzepatide',
  'steroid': 'prednisone prednisolone methylprednisolone dexamethasone hydrocortisone',
  'thyroid': 'levothyroxine liothyronine synthroid levoxyl unithroid tirosint',
  'bp': 'amlodipine metoprolol atenolol carvedilol propranolol diltiazem verapamil nifedipine',
  'immuno': 'tacrolimus cyclosporine mycophenolate azathioprine sirolimus',
  'sedative': 'alprazolam diazepam lorazepam clonazepam triazolam temazepam zolpidem eszopiclone',
  'bisphos': 'alendronate risedronate ibandronate',
  'bileacid': 'cholestyramine colestipol colesevelam',
  'antibiotic': 'amoxicillin penicillin azithromycin clarithromycin cephalexin cefdinir cefuroxime clindamycin sulfamethoxazole trimethoprim nitrofurantoin metronidazole',
  'antithyroid': 'methimazole propylthiouracil',
  'chemo': 'chemotherapy radiation radiotherapy',
}
# Common US brand names for the same medicines (2.5), so a typed brand finds them too.
BRANDS = {'ace': 'zestril prinivil vasotec altace lotensin accupril',
  'arb': 'cozaar diovan avapro benicar atacand micardis',
  'statin': 'lipitor zocor crestor pravachol mevacor livalo',
  'ppi': 'prilosec nexium prevacid protonix aciphex dexilant',
  'h2': 'pepcid tagamet axid zantac',
  'quinolone': 'cipro levaquin avelox',
  'tetracycline': 'vibramycin minocin doryx',
  'thiazide': 'microzide hygroton',
  'loop': 'lasix bumex demadex',
  'ksparing': 'aldactone midamor dyrenium inspra',
  'antiplatelet': 'plavix effient brilinta',
  'anticoag': 'eliquis xarelto pradaxa savaysa lovenox',
  'seizure': 'tegretol dilantin depakote depakene keppra',
  'diabetes': 'glucophage ozempic wegovy mounjaro zepbound jardiance farxiga januvia trulicity victoza invokana actos',
  'steroid': 'deltasone medrol decadron',
  'thyroid': 'cytomel armour',
  'bp': 'norvasc lopressor toprol tenormin coreg',
  'immuno': 'prograf neoral cellcept imuran',
  'sedative': 'xanax valium ativan klonopin halcion restoril ambien lunesta',
  'bisphos': 'fosamax actonel boniva',
  'bileacid': 'questran colestid welchol',
  'antibiotic': 'amoxil augmentin zithromax keflex omnicef bactrim macrobid flagyl cleocin',
  'antithyroid': 'tapazole'}
for k, v in BRANDS.items(): CLASS[k] += ' ' + v
def cls(*names): return [w for n in names for w in CLASS[n].split()]

# (supplement, heading) -> extra names to match beyond those written in the text.
TAGS = {
  ('VitaminA', 'Retinoids'): ['retinoid', 'isotretinoin', 'accutane', 'acitretin', 'bexarotene'],
  ('VitaminC', 'Chemotherapy and radiation'): cls('chemo'), ('VitaminC', '3-Hydroxy-3-methylglutaryl coenzyme A reductase inhibitors (statins)'): cls('statin') + ['statin'],
  ('VitaminD', 'Statins'): cls('statin') + ['statin'], ('VitaminD', 'Steroids'): cls('steroid') + ['steroid', 'corticosteroid'],
  ('VitaminD', 'Thiazide diuretics'): cls('thiazide') + ['thiazide'],
  ('VitaminE', 'Anticoagulant and antiplatelet medications'): cls('coumarin', 'antiplatelet', 'anticoag') + ['blood thinner', 'anticoagulant'],
  ('VitaminE', 'Chemotherapy and radiotherapy'): cls('chemo'),
  ('VitaminK', 'Warfarin (Coumadin) and similar anticoagulants'): cls('coumarin') + ['blood thinner'],
  ('VitaminK', 'Antibiotics'): cls('antibiotic', 'quinolone', 'tetracycline') + ['antibiotic'], ('VitaminK', 'Bile acid sequestrants'): cls('bileacid'),
  ('Thiamin', 'Chemotherapy with fluorouracil'): ['fluorouracil', '5-fluorouracil', 'adrucil'] + cls('chemo'),
  ('VitaminB6', 'Antiepileptic medications'): cls('seizure') + ['antiepileptic', 'anticonvulsant'],
  ('VitaminB12', 'Gastric acid inhibitors'): cls('ppi', 'h2') + ['antacid', 'acid reducer'],
  ('Biotin', 'Anticonvulsants'): cls('seizure') + ['anticonvulsant', 'antiepileptic'], ('Thiamin', 'Furosemide'): cls('loop'),
  ('Niacin', 'Antidiabetes medications'): cls('diabetes'), ('Folate', 'Antiepileptic medications'): cls('seizure') + ['antiepileptic', 'anticonvulsant'],
  ('Calcium', 'Levothyroxine'): cls('thyroid'), ('Calcium', 'Quinolone antibiotics'): cls('quinolone'),
  ('Iron', 'Levothyroxine'): cls('thyroid'), ('Iron', 'Proton pump inhibitors'): cls('ppi'),
  ('Magnesium', 'Bisphosphonates'): cls('bisphos'), ('Magnesium', 'Antibiotics'): cls('quinolone', 'tetracycline'),
  ('Magnesium', 'Diuretics'): cls('loop', 'thiazide', 'ksparing') + ['diuretic', 'water pill'], ('Magnesium', 'Proton pump inhibitors'): cls('ppi'),
  ('Zinc', 'Antibiotics'): cls('quinolone', 'tetracycline'), ('Zinc', 'Diuretics'): cls('thiazide') + ['thiazide'],
  ('Potassium', 'Angiotensin converting enzyme inhibitors and angiotensin receptor blockers'): cls('ace', 'arb') + ['ace inhibitor'],
  ('Potassium', 'Potassium-sparing diuretics'): cls('ksparing'), ('Potassium', 'Loop and thiazide diuretics'): cls('loop', 'thiazide') + ['diuretic', 'water pill'],
  ('Phosphorus', 'Antacids'): ['antacid', 'mylanta', 'tums', 'rolaids', 'maalox'], ('Phosphorus', 'Laxatives'): ['laxative', 'sodium phosphate'],
  ('Iodine', 'Antithyroid medications'): cls('antithyroid'), ('Iodine', 'Angiotensin-converting enzyme inhibitors'): cls('ace') + ['ace inhibitor'],
  ('Iodine', 'Potassium-sparing diuretics'): cls('ksparing'), ('Selenium', 'Cisplatin'): cls('chemo'),
  ('Chromium', 'Insulin'): ['insulin'], ('Chromium', 'Metformin and other antidiabetes medications'): cls('diabetes'), ('Chromium', 'Levothyroxine'): cls('thyroid'),
  ('Carnitine', 'Valproic acid and other anticonvulsants'): cls('seizure') + ['anticonvulsant'],
  ('Omega3FattyAcids', 'Warfarin (Coumadin) and similar anticoagulants'): cls('coumarin') + ['blood thinner'],
  ('Ashwagandha', 'Thyroid, diabetes, blood pressure, immunosuppressant and sedative medicines'): cls('thyroid', 'diabetes', 'ace', 'arb', 'bp', 'thiazide', 'immuno', 'sedative') + ['blood pressure'],
  ('Ginseng', 'Warfarin'): cls('coumarin') + ['blood thinner'], ('Caffeine', 'Cimetidine'): ['cimetidine', 'tagamet'],
  ('MVMS', 'Warfarin (Coumadin, Jantoven)'): cls('coumarin') + ['blood thinner'],
  ('Valerian', 'Sedatives, benzodiazepines and barbiturates'): cls('sedative') + ['benzodiazepine', 'barbiturate', 'sedative', 'xanax', 'valium', 'ativan', 'halcion', 'phenobarbital', 'morphine', 'propofol', "st. john's wort", 'kava', 'melatonin'],
}
# Words the name finder picks up that aren't medicines.
DENY = {'deficiency', 'nonusers', 'supplements', 'supplementation', 'lipoprotein', 'coenzyme', 'hydroxy-', 'methylglutaryl', 'reductase', 'inhibitors',
  'inhibitor', 'gastric', 'proton', 'magnesium', 'periods', 'typically', 'ratio', 'blood', 'carbonate', 'enzyme', 'converting', 'angiotensin', 'blockers',
  'sequestrants', 'medications', 'similar', 'other', 'hyperkalemia', 'hypothyroidism', 'drugs', 'antioxidants', 'combination', 'bleeding', 'clots', 'calcium', 'potassium', 'acid', 'with', 'over-the-counter', 'prescription', 'hdl', 'cns'}
def names_in(text):
    """Generic names written just before a bracket, and the capitalized brand names inside it: "warfarin (Coumadin)"."""
    out = set()
    for gen, inside in re.findall(r"\b([a-z][a-z-]{4,})\s*\(([^()]+)\)", text):
        out.add(gen)
        for w in re.split(r',|\band\b|\bor\b|;', inside):
            w = w.strip().strip('®')
            if re.fullmatch(r'[A-Z][A-Za-z-]+(?: [A-Z][A-Za-z]*)?', w) and w not in ('FDA', 'HIV', 'PPI', 'ACE', 'INR', 'NAD', 'TDP', 'PLP'): out.add(w.lower())
    return out - DENY

# Medicine classes a consumer paragraph names in words ("diuretics", "blood thinner"), found by keyword.
RULES = [
  (r'statin', ['statin', 'ace'][:1]), (r'warfarin|blood thinner|blood clotting|anticoagulant', ['coumarin']), (r'anticoagulant', ['anticoag']),
  (r'antiplatelet', ['antiplatelet']), (r'quinolone', ['quinolone']), (r'tetracycline', ['tetracycline']),
  (r'thiazide', ['thiazide']), (r'loop diuretic', ['loop']), (r'potassium-sparing', ['ksparing']), (r'ace inhibitor', ['ace']),
  (r'angiotensin receptor', ['arb']), (r'antithyroid', ['antithyroid']), (r'levothyroxine|thyroid hormone', ['thyroid']),
  (r'diabetes', ['diabetes']), (r'steroid', ['steroid']), (r'epilep|antiseizure|anticonvulsant|antiepileptic', ['seizure']), (r'chemotherapy|radiation therapy|cancer treatment|treated for cancer', ['chemo']),
  (r'bisphosphonate', ['bisphos']), (r'bile acid', ['bileacid']), (r'gastric acid|acid reflux|proton pump', ['ppi', 'h2']), (r'sedative', ['sedative']),
]
WORDS = {r'statin': ['statin', 'statins'], r'diuretic': ['diuretic', 'diuretics', 'water pill'],
  r'antacid': ['antacid', 'antacids', 'tums', 'rolaids', 'maalox', 'mylanta'], r'laxative': ['laxative', 'laxatives'],
  r'warfarin|blood thinner': ['blood thinner'], r'insulin': ['insulin'], r'chemotherapy': ['chemotherapy'], r'radiation': ['radiation']}
def class_tags(text):
    t = text.lower(); out = set()
    for rx, names in RULES:
        if re.search(rx, t): out |= set(cls(*names))
    for rx, names in WORDS.items():
        if re.search(rx, t): out |= set(names)
    # "antibiotics" or "diuretics" with no type named means any of them
    if re.search(r'antibiotic', t) and not re.search(r'quinolone|tetracycline|pivampicillin|cycloserine', t): out |= set(cls('antibiotic', 'quinolone', 'tetracycline')) | {'antibiotic', 'antibiotics'}
    # every medicine name Goku knows that the paragraph writes out
    out |= {d for d in DRUGS if re.search(r'(^|[^a-z])' + re.escape(d) + r'($|[^a-z])', t)}
    if re.search(r'\bdiuretics\b', t) and not re.search(r'thiazide|loop|potassium-sparing', t): out |= set(cls('loop', 'thiazide', 'ksparing'))
    return out
# Supplements a paragraph says interfere with this one (supplement with supplement).
SUPS = {('Iron', '• Calcium might'): ['Calcium'], ('Magnesium', '• Very high doses of zinc'): ['Zinc'],
  ('Valerian', 'Valerian might have'): ['Melatonin']}
# Medicines named one by one in the consumer text (plus every class member and brand above).
DRUGS = set(' '.join(CLASS.values()).split()) | set('''orlistat alli xenical acitretin soriatane bexarotene targretin furosemide fluorouracil adrucil
  isoniazid pyrazinamide dolutegravir dovato tivicay lithium eskalith lithobid levodopa sinemet stalevo penicillamine cimetidine
  insulin metformin methotrexate rheumatrex trexall cycloserine seromycin theophylline cisplatin pivampicillin sulfasalazine azulfidine
  warfarin coumadin jantoven questran colestid levothroid'''.split())
CLOSE = ('Tell your doctor', 'Talk with your', 'If you take dietary')

out = {}
def item(key, head, paras, own=False):
    text = ' '.join(paras)
    tags = (names_in(text) | names_in(head or '') | class_tags(text + ' ' + (head or ''))) - DENY
    tags |= set(TAGS.get((key, head), []))
    it = {**({'h': head} if head else {}), 't': paras, 'm': sorted(tags)}
    sup = next((v for (k, pre), v in SUPS.items() if k == key and paras[0].startswith(pre)), None)
    if sup: it['s'] = sup
    if own: it['own'] = True
    return it
def from_consumer(key, c, slug):
    ps = [x for x in c['p'] if not x.startswith(CLOSE)]
    entry = {'d': c['d'], 'slug': slug, 'src': 'Consumer', 'i': [], 'x': []}
    if any('not known to interact' in x for x in ps): entry['i'] = ps; return entry
    i = 0
    if len(ps) > 1 and not ps[0].startswith('•'): entry['i'].append(ps[0]); i = 1
    while i < len(ps):
        x = ps[i]
        if not x.startswith('•') and not x.endswith('.') and i + 1 < len(ps) and len(x) < 90:   # a short heading line, then its paragraph
            entry['x'].append(item(key, x, [ps[i + 1]])); i += 2; continue
        entry['x'].append(item(key, None, [x])); i += 1
    if not entry['x'] and entry['i']: entry['x'] = [item(key, None, entry['i'])]; entry['i'] = []
    return entry
for k, c in consumer.items():
    if k != 'ExerciseAndAthleticPerformance': out[k] = from_consumer(k, c, k)
# The exercise sheet's two sentences belong to two supplements; each is quoted whole.
ex = consumer['ExerciseAndAthleticPerformance']; para = ex['p'][0]
gin = 'For example, ginseng can reduce the blood-thinning effects of warfarin (Coumadin).'
caf = 'Cimetidine (Tagamet HB, used to treat duodenal ulcers) can slow the removal of caffeine from the body and thus increase the risk of side effects from caffeine consumption.'
assert gin in para and caf in para
out['Ginseng'] = {'d': ex['d'], 'slug': 'ExerciseAndAthleticPerformance', 'src': 'Consumer', 'i': [], 'x': [item('Ginseng', None, [gin])]}
out['Caffeine'] = {'d': ex['d'], 'slug': 'ExerciseAndAthleticPerformance', 'src': 'Consumer', 'i': [], 'x': [item('Caffeine', None, [caf])]}
# No consumer section: the health professional text, as in 2.4.
out['BlackCohosh'] = {'d': raw['BlackCohosh']['d'], 'slug': 'BlackCohosh', 'src': 'HealthProfessional', 'i': raw['BlackCohosh']['i'], 'x': []}
out['Valerian'] = {'d': raw['Valerian']['d'], 'slug': 'Valerian', 'src': 'HealthProfessional', 'i': raw['Valerian']['i'][5:],
  'x': [item('Valerian', 'Sedatives, benzodiazepines and barbiturates', raw['Valerian']['i'][:5], own=True)]}
d, slug, head, h, text = EXTRA['Ashwagandha']
out['Ashwagandha'] = {'d': d, 'slug': slug, 'src': 'HealthProfessional', 'i': [], 'x': [item('Ashwagandha', head, [text], own=True)]}
json.dump(out, open('data/interactions.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for k, v in out.items():
    for it in v['x']: print(f"{k:16} {(it.get('h') or it['t'][0])[:40]:40} {('SUP ' + str(it['s']) + ' ') if it.get('s') else ''}{', '.join(it['m'])[:120]}")
