# -*- coding: utf-8 -*-
"""Etape 3 : fusionne les stats FBref 2024-2025 et les fiches Transfermarkt,
attribue un poste precis, calcule les variables par 90 minutes et leurs percentiles par poste.

Sorties :
  data/big5_joueurs_2024_2025.csv   le fichier de reference (une ligne par joueur)
  site/data.js                      les memes donnees compactees pour le site
  data/_non_apparies.csv            les joueurs FBref sans fiche Transfermarkt
"""
import csv, json, os, re, sys, unicodedata
from difflib import SequenceMatcher

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variables import CHAMP, GARDIEN, POIDS_POSTE, POSTES, POSTES_LIBELLE, POSTES_PLURIEL
from variables_fiche import (DESCRIPTIVES, DESCRIPTIVES_GARDIEN, ORDRE_FAMILLES,
                             EXPLICATIONS_FAMILLES, POSTES_UNDERSTAT,
                             POSTE_TM_VERS_UNDERSTAT)

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, ".."))
FBREF = os.path.abspath(os.path.join(RACINE, "..", "player-similarity", "data", "raw",
                                     "players_data-2024_2025.csv"))
SQUADS = os.path.join(RACINE, "data", "tm_squads_2024_25.csv")
VALEURS = os.path.join(RACINE, "data", "tm_valeurs_2024_25.csv")
CSV_OUT = os.path.join(RACINE, "data", "big5_joueurs_2024_2025.csv")
JS_OUT = os.path.join(RACINE, "site", "data.js")
NON_APP = os.path.join(RACINE, "data", "_non_apparies.csv")
MEDIAS = os.path.join(RACINE, "data", "tm_medias_2024_25.csv")
PROFILS = os.path.join(RACINE, "data", "tm_profils_2024_25.csv")
UNDERSTAT = os.path.join(RACINE, "data", "understat_2024_25.json")
FICHES_OUT = os.path.join(RACINE, "site", "fiches.js")

# Deux seuils distincts : la population qui sert de reference pour les percentiles
# doit rester stable, mais on peut proposer des joueurs moins utilises, en les signalant.
MIN_MINUTES_REFERENCE = 450   # population qui definit l'echelle des percentiles
MIN_MINUTES_INCLUS = 270      # a partir de quand un joueur apparait dans le comparateur
LIGUES = {"fr Ligue 1": "Ligue 1", "eng Premier League": "Premier League",
          "es La Liga": "La Liga", "it Serie A": "Serie A", "de Bundesliga": "Bundesliga"}

# ---------------------------------------------------------------- outils texte
def sans_accents(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return (s.replace("Ø", "O").replace("ø", "o").replace("Đ", "D").replace("đ", "d")
             .replace("ß", "ss").replace("Ł", "L").replace("ł", "l"))


def cle_nom(s):
    s = sans_accents(s).lower()
    s = re.sub(r"[^a-z ]", " ", s)
    return " ".join(s.split())


def proximite(a, b):
    """Similarite de deux noms, en tolerant l'inversion prenom / nom."""
    direct = SequenceMatcher(None, a, b).ratio()
    trie = SequenceMatcher(None, " ".join(sorted(a.split())), " ".join(sorted(b.split()))).ratio()
    return max(direct, trie)


def tokens_compatibles(a, b):
    """Vrai si chaque mot du nom le plus court prolonge un mot de l'autre.

    Couvre les surnoms ('Catena' pour 'Alejandro Catena'), les diminutifs
    ('Max' pour 'Maximilian') et les noms coreens inverses.
    """
    ta, tb = a.split(), b.split()
    if not ta or not tb:
        return False
    court, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    utilises = set()
    for mot in court:
        trouve = False
        for i, autre in enumerate(long_):
            if i in utilises:
                continue
            if (autre.startswith(mot) or mot.startswith(autre)) and min(len(mot), len(autre)) >= 3:
                utilises.add(i)
                trouve = True
                break
        if not trouve:
            return False
    return True


MOTS_CLUB = {"fc", "ac", "as", "sc", "cf", "ud", "rc", "cd", "sv", "vfl", "vfb", "tsg", "sd",
             "club", "calcio", "olympique", "real", "de", "la", "le", "les", "us", "ss", "ssc",
             "afc", "bsc", "bv", "borussia", "athletic", "atletico", "sporting", "football",
             "united", "city", "1899", "1846", "1904", "1907", "05", "04", "96", "e", "v"}


def cle_club(nom):
    mots = [m for m in cle_nom(nom).split() if m not in MOTS_CLUB]
    return " ".join(mots) or cle_nom(nom)


def clubs_proches(a, b):
    ca, cb = cle_club(a), cle_club(b)
    if not ca or not cb:
        return False
    return ca in cb or cb in ca or SequenceMatcher(None, ca, cb).ratio() >= 0.7


# ------------------------------------------------- colonnes FBref -> totaux
# cle interne -> nom de colonne dans le CSV FBref
SOMMES = {
    "MP": "MP", "Starts": "Starts", "Min": "Min", "n90": "90s",
    "Gls": "Gls", "Ast": "Ast", "G-PK": "G-PK", "PK": "PK", "PKatt": "PKatt",
    "CrdY": "CrdY", "CrdR": "CrdR", "xG": "xG", "npxG": "npxG", "xAG": "xAG",
    "PrgC": "PrgC", "PrgP": "PrgP", "PrgR": "PrgR",
    "Sh": "Sh", "SoT": "SoT", "FK_tirs": "FK",
    "Cmp": "Cmp", "Att_pass": "Att", "TotDist": "TotDist", "PrgDist": "PrgDist",
    "xA": "xA", "KP": "KP", "1/3": "1/3", "PPA": "PPA", "CrsPA": "CrsPA",
    "TB": "TB", "Sw": "Sw", "Crs": "Crs", "CK": "CK", "FK": "FK_stats_passing_types",
    "SCA": "SCA", "GCA": "GCA",
    "Tkl": "Tkl", "TklW": "TklW", "Def 3rd_d": "Def 3rd", "Mid 3rd_d": "Mid 3rd",
    "Att 3rd_d": "Att 3rd", "Att_duel": "Att_stats_defense", "Lost_duel": "Lost",
    "Blocks_def": "Blocks_stats_defense", "Sh_blk": "Sh_stats_defense",
    "Int": "Int", "Tkl+Int": "Tkl+Int", "Clr": "Clr", "Err": "Err",
    "Touches": "Touches", "Def Pen": "Def Pen", "Def 3rd_p": "Def 3rd_stats_possession",
    "Mid 3rd_p": "Mid 3rd_stats_possession", "Att 3rd_p": "Att 3rd_stats_possession",
    "Att Pen": "Att Pen", "Att_drib": "Att_stats_possession", "Succ": "Succ",
    "Carries": "Carries", "TotDist_car": "TotDist_stats_possession",
    "PrgDist_car": "PrgDist_stats_possession", "1/3_car": "1/3_stats_possession",
    "CPA": "CPA", "Mis": "Mis", "Dis": "Dis", "Rec": "Rec",
    "Fls": "Fls", "Fld": "Fld_stats_misc", "Off": "Off_stats_misc", "Recov": "Recov",
    # colonnes qui ne servent qu a la fiche du joueur, pas a la ressemblance
    "SCA_pass": "PassLive", "SCA_drib": "TO", "SCA_fld": "Fld", "SCA_def": "Def",
    "Pass_blk": "Pass", "In": "In", "Out": "Out", "TI": "TI", "Dead": "Dead",
    "2CrdY": "2CrdY", "Compl": "Compl", "Subs": "Subs",
    "Won": "Won", "Lost_air": "Lost_stats_misc", "PKwon": "PKwon", "PKcon": "PKcon", "OG": "OG",
    # gardien
    "GA": "GA", "SoTA": "SoTA", "Saves": "Saves", "CS": "CS", "W": "W", "D": "D", "L": "L",
    "PKatt_gk": "PKatt_stats_keeper", "PKA": "PKA", "PKsv": "PKsv",
    "PSxG": "PSxG", "Cmp_long": "Cmp_stats_keeper_adv", "Att_long": "Att_stats_keeper_adv",
    "Att_gk": "Att (GK)", "Thr": "Thr", "Opp": "Opp", "Stp": "Stp", "#OPA": "#OPA",
    "FK_gk": "FK_stats_keeper_adv", "CK_gk": "CK_stats_keeper_adv",
}
# moyennes ponderees : cle interne -> (colonne, colonne de poids)
MOYENNES = {
    "Dist_moy": ("Dist", "Sh"), "Tkl%_moy": ("Tkl%", "Att_stats_defense"),
    "Launch%_moy": ("Launch%", "90s"), "AvgLen_moy": ("AvgLen", "90s"),
    "Stp%_moy": ("Stp%", "90s"), "AvgDist_moy": ("AvgDist", "90s"),
    "PPM_moy": ("PPM", "MP"), "minpct_moy": ("Min%", "MP"),
    "diff_moy": ("+/-90", "90s"), "diffxg_moy": ("xG+/-90", "90s"),
    "onoff_moy": ("On-Off", "90s"),
}

# ------------------------------------------------- postes Transfermarkt -> code
POSTE_TM = {
    "gardien de but": "GB",
    "arriere gauche": "DG", "arriere droit": "DD", "defenseur central": "DC",
    "defenseur": "DC",
    "milieu defensif": "MDC", "milieu central": "MC", "milieu offensif": "MOC",
    "milieu gauche": "AG", "milieu droit": "AD", "milieu de terrain": "MC",
    "ailier gauche": "AG", "ailier droit": "AD", "ailier": "AD",
    "avant centre": "BU", "avant-centre": "BU",
    "deuxieme attaquant": "MOC", "second attaquant": "MOC",
    "attaquant": "BU", "buteur": "BU",
}


def code_poste(libelle_tm):
    c = cle_nom(libelle_tm)
    if c in POSTE_TM:
        return POSTE_TM[c]
    for k, v in POSTE_TM.items():
        if cle_nom(k) in c:
            return v
    return ""


def poste_de_secours(pos_fbref, totaux):
    """Quand Transfermarkt ne donne rien : on deduit un poste a partir des stats."""
    p = str(pos_fbref)
    if p.startswith("GK"):
        return "GB"
    n90 = max(totaux.get("n90", 0), 0.1)
    touches = max(totaux.get("Touches", 0), 1)
    part_off = totaux.get("Att 3rd_p", 0) / touches
    part_def = totaux.get("Def 3rd_p", 0) / touches
    if p.startswith("DF"):
        # un lateral touche beaucoup plus de ballons hauts et centre davantage
        if totaux.get("Crs", 0) / n90 > 1.2 or part_off > 0.22:
            return "DD"
        return "DC"
    if p.startswith("FW"):
        if totaux.get("Att Pen", 0) / n90 > 4.0 and totaux.get("Crs", 0) / n90 < 1.0:
            return "BU"
        return "AD"
    if part_def > 0.30:
        return "MDC"
    if part_off > 0.30:
        return "MOC"
    return "MC"


# ---------------------------------------------------------------- chargement
def charger_fbref():
    df = pd.read_csv(FBREF, encoding="utf-8", low_memory=False)
    df = df[df["Comp"].isin(LIGUES)].copy()
    df["ligue"] = df["Comp"].map(LIGUES)
    df["nom_cle"] = df["Player"].map(cle_nom)
    df["annee"] = pd.to_numeric(df["Born"], errors="coerce")
    for c in set(SOMMES.values()) | {c for c, _ in MOYENNES.values()} | {p for _, p in MOYENNES.values()}:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
        else:
            print(f"  colonne absente : {c}")
            df[c] = 0.0
    return df


def agreger(df):
    """Un joueur peut avoir joue dans deux clubs : on additionne ses totaux sur la saison."""
    lignes = []
    for (nom_cle, annee), g in df.groupby(["nom_cle", "annee"], dropna=False):
        g = g.sort_values("Min", ascending=False)
        t = {k: float(g[col].sum()) for k, col in SOMMES.items()}
        for k, (col, poids) in MOYENNES.items():
            w = g[poids].sum()
            t[k] = float((g[col] * g[poids]).sum() / w) if w else float("nan")
        principal = g.iloc[0]
        lignes.append(dict(
            nom_cle=nom_cle, nom=principal["Player"], annee=annee,
            nation_fbref=str(principal["Nation"]).split()[-1] if pd.notna(principal["Nation"]) else "",
            pos_fbref=principal["Pos"], age=principal["Age"],
            club=principal["Squad"], ligue=principal["ligue"],
            clubs=" / ".join(dict.fromkeys(g["Squad"].tolist())),
            nb_clubs=g["Squad"].nunique(), totaux=t))
    return lignes


def charger_transfermarkt():
    tm = pd.read_csv(SQUADS, encoding="utf-8")
    val = pd.read_csv(VALEURS, encoding="utf-8") if os.path.exists(VALEURS) else pd.DataFrame()
    if not val.empty:
        tm = tm.merge(val, on="tm_id", how="left")
    tm["nom_cle"] = tm["tm_nom"].map(cle_nom)
    tm["annee"] = tm["tm_naissance"].str.extract(r"(\d{4})").astype(float)
    tm["minutes_ref"] = 0
    # un joueur transfere apparait dans deux effectifs : on garde la fiche la plus complete
    tm = tm.sort_values(["tm_id", "tm_valeur_affichee"]).drop_duplicates("tm_id", keep="last")
    return tm


def apparier(joueurs, tm):
    """Appariement en trois passes : nom + annee, puis nom seul, puis approchant dans la ligue."""
    par_nom_annee, par_nom = {}, {}
    for i, r in tm.iterrows():
        par_nom_annee.setdefault((r["nom_cle"], r["annee"]), []).append(i)
        par_nom.setdefault(r["nom_cle"], []).append(i)
    par_ligue = {}
    for i, r in tm.iterrows():
        par_ligue.setdefault(r["ligue"], []).append(i)

    pris, stats = set(), {"nom_annee": 0, "nom": 0, "approche": 0, "surnom": 0, "patronyme": 0, "echec": 0}
    for j in joueurs:
        idx = None
        cands = par_nom_annee.get((j["nom_cle"], j["annee"]), [])
        cands = [c for c in cands if c not in pris]
        if len(cands) >= 1:
            idx, quoi = cands[0], "nom_annee"
        else:
            cands = [c for c in par_nom.get(j["nom_cle"], []) if c not in pris]
            if len(cands) == 1:
                idx, quoi = cands[0], "nom"
            elif len(cands) > 1:  # homonymes : on tranche sur la ligue
                meme = [c for c in cands if tm.at[c, "ligue"] == j["ligue"]]
                idx, quoi = (meme or cands)[0], "nom"
        if idx is None:
            meilleur, score = None, 0.0
            for c in par_ligue.get(j["ligue"], []):
                if c in pris:
                    continue
                a = tm.at[c, "annee"]
                if pd.notna(a) and pd.notna(j["annee"]) and abs(a - j["annee"]) > 1:
                    continue
                s = proximite(j["nom_cle"], tm.at[c, "nom_cle"])
                if s > score:
                    meilleur, score = c, s
            if meilleur is not None and score >= 0.82:
                idx, quoi = meilleur, "approche"
        if idx is None and pd.notna(j["annee"]):
            # derniere passe : surnoms et diminutifs, on exige l'annee exacte
            candidats = []
            for c in par_ligue.get(j["ligue"], []):
                if c in pris or tm.at[c, "annee"] != j["annee"]:
                    continue
                if tokens_compatibles(j["nom_cle"], tm.at[c, "nom_cle"]):
                    candidats.append((clubs_proches(j["club"], tm.at[c, "tm_club"]),
                                      proximite(j["nom_cle"], tm.at[c, "nom_cle"]), c))
            if candidats:
                candidats.sort(reverse=True)
                idx, quoi = candidats[0][2], "surnom"
        if idx is None and pd.notna(j["annee"]):
            # prenoms differents entre les deux sources : on exige le meme club,
            # la meme annee de naissance et un patronyme commun
            candidats = []
            mots_j = {m for m in j["nom_cle"].split() if len(m) >= 4}
            for c in par_ligue.get(j["ligue"], []):
                if c in pris or tm.at[c, "annee"] != j["annee"]:
                    continue
                if not clubs_proches(j["club"], tm.at[c, "tm_club"]):
                    continue
                if mots_j & {m for m in tm.at[c, "nom_cle"].split() if len(m) >= 4}:
                    candidats.append((proximite(j["nom_cle"], tm.at[c, "nom_cle"]), c))
            if candidats:
                candidats.sort(reverse=True)
                idx, quoi = candidats[0][1], "patronyme"
        if idx is None:
            j["tm"] = None
            stats["echec"] += 1
        else:
            pris.add(idx)
            j["tm"] = tm.loc[idx].to_dict()
            stats[quoi] += 1
    print(f"  appariement : {stats}")
    return joueurs


# ---------------------------------------------------------------- calculs
def calculer_variables(joueurs):
    for j in joueurs:
        defs = GARDIEN if j["poste"] == "GB" else CHAMP
        vals = {}
        for cle, (_, _, fonction, _) in defs.items():
            try:
                v = fonction(j["totaux"])
            except Exception:
                v = float("nan")
            vals[cle] = None if v is None or (isinstance(v, float) and not np.isfinite(v)) else round(float(v), 3)
        j["variables"] = vals
    return joueurs


def calculer_percentiles(joueurs):
    """Percentile de chaque variable a l'interieur du poste.

    L'echelle est fixee par les joueurs qui ont depasse MIN_MINUTES_REFERENCE, pour
    qu'elle ne bouge pas quand on elargit. Les joueurs entre MIN_MINUTES_INCLUS et ce
    seuil sont situes sur cette meme echelle, avec un drapeau d'echantillon reduit.
    """
    for poste in POSTES:
        defs = GARDIEN if poste == "GB" else CHAMP
        du_poste = [j for j in joueurs if j["poste"] == poste]
        reference = [j for j in du_poste if j["totaux"]["Min"] >= MIN_MINUTES_REFERENCE]
        affiches = [j for j in du_poste if j["totaux"]["Min"] >= MIN_MINUTES_INCLUS]
        for cle, (_, _, _, inverse) in defs.items():
            echelle = np.array([j["variables"].get(cle) for j in reference
                                if j["variables"].get(cle) is not None], dtype=float)
            echelle = echelle[np.isfinite(echelle)]
            for j in affiches:
                v = j["variables"].get(cle)
                if v is None or not np.isfinite(v) or echelle.size == 0:
                    j.setdefault("percentiles", {})[cle] = None
                    continue
                p = (100.0 * (echelle < v).sum() + 50.0 * (echelle == v).sum()) / echelle.size
                j.setdefault("percentiles", {})[cle] = round(100.0 - p if inverse else p, 1)
        for j in affiches:
            j["comparable"] = True
            j["echantillon_reduit"] = j["totaux"]["Min"] < MIN_MINUTES_REFERENCE
    for j in joueurs:
        j.setdefault("percentiles", {})
        j.setdefault("comparable", False)
        j.setdefault("echantillon_reduit", False)


def calculer_descriptives(joueurs):
    """Meme mecanique que les variables de comparaison, mais pour les variables
    qui ne servent qu'a remplir la fiche."""
    for j in joueurs:
        defs = DESCRIPTIVES_GARDIEN if j["poste"] == "GB" else DESCRIPTIVES
        vals = {}
        for cle, (_, _, fonction, _) in defs.items():
            try:
                v = fonction(j["totaux"])
            except Exception:
                v = float("nan")
            vals[cle] = None if v is None or (isinstance(v, float) and not np.isfinite(v))                 else round(float(v), 3)
        j["descriptives"] = vals


def percentiles_descriptives(joueurs):
    """L'echelle est la meme que pour les variables de comparaison : la population
    du poste au-dela de MIN_MINUTES_REFERENCE."""
    for poste in POSTES:
        defs = DESCRIPTIVES_GARDIEN if poste == "GB" else DESCRIPTIVES
        du_poste = [j for j in joueurs if j["poste"] == poste]
        reference = [j for j in du_poste if j["totaux"]["Min"] >= MIN_MINUTES_REFERENCE]
        affiches = [j for j in du_poste if j["totaux"]["Min"] >= MIN_MINUTES_INCLUS]
        for cle, (_, _, _, inverse) in defs.items():
            echelle = np.array([j["descriptives"].get(cle) for j in reference
                                if j["descriptives"].get(cle) is not None], dtype=float)
            echelle = echelle[np.isfinite(echelle)]
            for j in affiches:
                v = j["descriptives"].get(cle)
                if v is None or not np.isfinite(v) or echelle.size == 0:
                    j.setdefault("percentiles_desc", {})[cle] = None
                    continue
                pc = (100.0 * (echelle < v).sum() + 50.0 * (echelle == v).sum()) / echelle.size
                j.setdefault("percentiles_desc", {})[cle] = round(100.0 - pc if inverse else pc, 1)
    for j in joueurs:
        j.setdefault("percentiles_desc", {})


def charger_medias():
    """Adresses des portraits, drapeaux et logos, collectees par scrape_medias.py."""
    if not os.path.exists(MEDIAS):
        print("   pas de tm_medias.csv, le site affichera des avatars par initiales")
        return {}
    m = pd.read_csv(MEDIAS, encoding="utf-8", dtype=str).fillna("")
    return {r["tm_id"]: r.to_dict() for _, r in m.iterrows()}


def charger_profils():
    """Contrat, club du jour, postes declares : collectes par scrape_profils.py."""
    if not os.path.exists(PROFILS):
        print("   pas de tm_profils.csv, la fiche se passera des contrats")
        return {}
    d = pd.read_csv(PROFILS, encoding="utf-8", dtype=str).fillna("")
    return {r["tm_id"]: r.to_dict() for _, r in d.iterrows()}


def attacher_profils(joueurs, profils):
    trouves = 0
    for j in joueurs:
        tm_id = str((j["tm"] or {}).get("tm_id", "") or "")
        p = profils.get(tm_id)
        j["profil"] = p or {}
        trouves += 1 if p else 0
    print(f"   {trouves} / {len(joueurs)} joueurs avec fiche d identite")


def attacher_medias(joueurs, medias):
    trouves = 0
    for j in joueurs:
        tm_id = str((j["tm"] or {}).get("tm_id", "") or "")
        m = medias.get(tm_id)
        j["medias"] = m or {}
        trouves += 1 if m else 0
    print(f"   {trouves} / {len(joueurs)} joueurs avec portrait")


def valeur_en_euros(x):
    """Accepte un nombre brut ou le format affiche par Transfermarkt ('1,20 mio. EUR', '800 K EUR')."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    try:
        v = float(x)
        return int(v) if v > 0 else None
    except (TypeError, ValueError):
        pass
    s = str(x).replace("\xa0", " ").strip()
    m = re.search(r"([\d.,]+)\s*(mio|mrd|k)?", s, re.IGNORECASE)
    if not m or not m.group(1).strip(".,"):
        return None
    nombre = float(m.group(1).replace(".", "").replace(",", "."))
    facteur = {"mio": 1e6, "mrd": 1e9, "k": 1e3}.get((m.group(2) or "").lower(), 1)
    v = int(nombre * facteur)
    return v if v > 0 else None


def main():
    print("1. lecture FBref")
    df = charger_fbref()
    joueurs = agreger(df)
    print(f"   {len(df)} lignes -> {len(joueurs)} joueurs")

    print("2. lecture Transfermarkt")
    tm = charger_transfermarkt()
    print(f"   {len(tm)} fiches")

    print("3. appariement")
    joueurs = apparier(joueurs, tm)

    print("4. postes")
    origine = {"transfermarkt": 0, "deduit": 0}
    for j in joueurs:
        p = code_poste(j["tm"]["tm_poste"]) if j["tm"] else ""
        if p:
            origine["transfermarkt"] += 1
            j["poste_source"] = "Transfermarkt"
        else:
            p = poste_de_secours(j["pos_fbref"], j["totaux"])
            origine["deduit"] += 1
            j["poste_source"] = "deduit des stats"
        j["poste"] = p
    print(f"   {origine}")

    print("5. variables et percentiles")
    calculer_variables(joueurs)
    calculer_percentiles(joueurs)
    calculer_descriptives(joueurs)
    percentiles_descriptives(joueurs)

    print("6. images et fiches d identite")
    attacher_medias(joueurs, charger_medias())
    attacher_profils(joueurs, charger_profils())

    print("7. ecriture des fichiers")
    ecrire_csv(joueurs)
    ecrire_js(joueurs)
    ecrire_fiches(joueurs)
    manquants = [j for j in joueurs if not j["tm"]]
    with open(NON_APP, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["joueur", "annee_naissance", "club", "ligue", "minutes"])
        for j in sorted(manquants, key=lambda x: -x["totaux"]["Min"]):
            w.writerow([j["nom"], j["annee"], j["club"], j["ligue"], int(j["totaux"]["Min"])])
    print(f"   {len(manquants)} joueurs sans fiche Transfermarkt (voir _non_apparies.csv)")


def ligne_export(j):
    tmd = j["tm"] or {}
    base = {
        "joueur": j["nom"],
        "poste": j["poste"],
        "poste_libelle": POSTES_LIBELLE.get(j["poste"], ""),
        "poste_transfermarkt": tmd.get("tm_poste", ""),
        "source_poste": j["poste_source"],
        "club": j["club"],
        "tous_les_clubs": j["clubs"],
        "ligue": j["ligue"],
        "nationalite": tmd.get("tm_nationalites", "") or j["nation_fbref"],
        "annee_naissance": int(j["annee"]) if pd.notna(j["annee"]) else "",
        "age": int(j["age"]) if pd.notna(j["age"]) else "",
        "taille": tmd.get("tm_taille", ""),
        "pied": tmd.get("tm_pied", ""),
        "numero": tmd.get("tm_numero", ""),
        "valeur_marchande_fin_2024_25_eur": valeur_en_euros(tmd.get("valeur_fin_saison")),
        "date_valeur_2024_25": tmd.get("date_valeur_fin_saison", ""),
        "valeur_marchande_actuelle_eur": valeur_en_euros(tmd.get("valeur_actuelle")),
        "valeur_marchande_max_eur": valeur_en_euros(tmd.get("valeur_max")),
        "date_valeur_max": tmd.get("date_valeur_max", ""),
        "transfermarkt_id": tmd.get("tm_id", ""),
        "portrait_url": (j.get("medias") or {}).get("portrait", ""),
        "club_logo_url": (j.get("medias") or {}).get("club_logo", ""),
        "club_transfermarkt_id": (j.get("medias") or {}).get("club_id", ""),
        "drapeau_id": (j.get("medias") or {}).get("drapeau", ""),
        "club_actuel": (j.get("profil") or {}).get("club_actuel", ""),
        "contrat_jusqu_a": (j.get("profil") or {}).get("contrat_fin", ""),
        "au_club_depuis": (j.get("profil") or {}).get("au_club_depuis", ""),
        "lieu_naissance": (j.get("profil") or {}).get("lieu_naissance", ""),
        "selections": (j.get("profil") or {}).get("selections", ""),
        "buts_en_selection": (j.get("profil") or {}).get("buts_selection", ""),
        "postes_secondaires": (j.get("profil") or {}).get("postes_secondaires", ""),
        "position_fbref": j["pos_fbref"],
        "matchs": int(j["totaux"]["MP"]),
        "titularisations": int(j["totaux"]["Starts"]),
        "minutes": int(j["totaux"]["Min"]),
        "buts": int(j["totaux"]["Gls"]),
        "passes_decisives": int(j["totaux"]["Ast"]),
        "xg": round(j["totaux"]["xG"], 2),
        "xag": round(j["totaux"]["xAG"], 2),
        "cartons_jaunes": int(j["totaux"]["CrdY"]),
        "cartons_rouges": int(j["totaux"]["CrdR"]),
        "compare_dans_le_site": "oui" if j["comparable"] else "non",
        "echantillon_reduit": "oui" if j["echantillon_reduit"] else "non",
    }
    defs = GARDIEN if j["poste"] == "GB" else CHAMP
    toutes = dict(CHAMP)
    toutes.update(GARDIEN)
    for cle in toutes:
        base[cle] = j["variables"].get(cle) if cle in defs else None
        # prefixe explicite : 'pct_' designe deja des variables qui sont des pourcentages
        base["percentile_" + cle] = j["percentiles"].get(cle) if cle in defs else None

    # les variables de fiche suivent, prefixees pour qu'on les distingue au premier coup d oeil
    defs_d = DESCRIPTIVES_GARDIEN if j["poste"] == "GB" else DESCRIPTIVES
    toutes_d = dict(DESCRIPTIVES)
    toutes_d.update(DESCRIPTIVES_GARDIEN)
    for cle in toutes_d:
        base["fiche_" + cle] = j.get("descriptives", {}).get(cle) if cle in defs_d else None
        base["fiche_percentile_" + cle] = (j.get("percentiles_desc", {}).get(cle)
                                           if cle in defs_d else None)
    return base


def ecrire_csv(joueurs):
    lignes = [ligne_export(j) for j in sorted(joueurs, key=lambda x: (-x["totaux"]["Min"]))]
    champs = list(lignes[0].keys())
    with open(CSV_OUT, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=champs)
        w.writeheader()
        w.writerows(lignes)
    print(f"   CSV : {len(lignes)} joueurs, {len(champs)} colonnes -> {CSV_OUT}")


def propre(valeur):
    """Remplace les NaN de pandas par None, recursivement.

    Ecrits tels quels, ils donnent `NaN` dans le fichier : JavaScript l'accepte a
    la lecture d'un litteral, mais JSON.parse le refuse, et la version artefact
    relit justement les donnees avec JSON.parse."""
    if isinstance(valeur, dict):
        return {k: propre(v) for k, v in valeur.items()}
    if isinstance(valeur, (list, tuple)):
        return [propre(v) for v in valeur]
    if isinstance(valeur, float) and not np.isfinite(valeur):
        return None
    if valeur is pd.NaT or (valeur is not None and valeur is not True and valeur is not False
                            and not isinstance(valeur, (str, int, float, dict, list))
                            and pd.isna(valeur)):
        return None
    return valeur


PREFIXE_PORTRAIT = "https://img.a.transfermarkt.technology/portrait/big/"
PREFIXE_DRAPEAU = "https://img.a.transfermarkt.technology/flagge/small/"
PREFIXE_LOGO = "https://tmssl.akamaized.net/images/wappen/head/"


def ecrire_js(joueurs):
    """Format compact : les variables sont des tableaux paralleles, pas des objets
    repetes, et les adresses d'images sont reduites a ce qui les distingue."""
    meta_vars, meta_desc = {}, {}
    for nom_groupe, defs in (("champ", CHAMP), ("gardien", GARDIEN)):
        meta_vars[nom_groupe] = [{"cle": k, "libelle": v[0], "famille": v[1], "inverse": v[3]}
                                 for k, v in defs.items()]
    for nom_groupe, defs in (("champ", DESCRIPTIVES), ("gardien", DESCRIPTIVES_GARDIEN)):
        meta_desc[nom_groupe] = [{"cle": k, "libelle": v[0], "famille": v[1], "inverse": v[3]}
                                 for k, v in defs.items()]
    cles_champ = [v["cle"] for v in meta_vars["champ"]]
    cles_gk = [v["cle"] for v in meta_vars["gardien"]]
    cles_dchamp = [v["cle"] for v in meta_desc["champ"]]
    cles_dgk = [v["cle"] for v in meta_desc["gardien"]]

    clubs = {}
    out = []
    for j in sorted(joueurs, key=lambda x: x["nom"]):
        if not j["comparable"]:
            continue
        gk = j["poste"] == "GB"
        cles = cles_gk if gk else cles_champ
        cles_d = cles_dgk if gk else cles_dchamp
        tmd = j["tm"] or {}
        med = j.get("medias") or {}
        prof = j.get("profil") or {}
        t = j["totaux"]

        # postes declares sur Transfermarkt, principal d'abord, ramenes a la grille.
        # Le principal vient de la page d'effectif, donc il existe pour tout le monde ;
        # les secondaires viennent du profil, qui n'est pas toujours collecte.
        declares = []
        for libelle in ([prof.get("poste_principal", "") or tmd.get("tm_poste", "")] +
                        [x.strip() for x in (prof.get("postes_secondaires", "") or "").split("/")]):
            code = POSTE_TM_VERS_UNDERSTAT.get(cle_nom(libelle))
            if code and code not in declares:
                declares.append(code)

        if j["club"] not in clubs and med.get("club_id"):
            clubs[j["club"]] = {"id": med["club_id"], "l": j["ligue"]}

        out.append({
            "n": j["nom"], "p": j["poste"], "c": j["club"], "l": j["ligue"],
            "na": tmd.get("tm_nationalites", "") or j["nation_fbref"],
            "a": int(j["age"]) if pd.notna(j["age"]) else None,
            "an": int(j["annee"]) if pd.notna(j["annee"]) else None,
            "t": tmd.get("tm_taille", ""), "pi": tmd.get("tm_pied", ""),
            "nb": str(tmd.get("tm_numero", "") or "").strip(),
            "v": valeur_en_euros(tmd.get("valeur_fin_saison")),
            "vn": valeur_en_euros(tmd.get("valeur_actuelle")),
            "vx": valeur_en_euros(tmd.get("valeur_max")),
            "dx": tmd.get("date_valeur_max", "") or "",
            "m": int(t["Min"]), "mj": int(t["MP"]), "ti": int(t["Starts"]),
            "er": 1 if j["echantillon_reduit"] else 0,
            "b": int(t["Gls"]), "pd": int(t["Ast"]),
            "bp": int(t["PK"]),                       # buts sur penalty
            "xg": round(t["xG"], 2), "xa": round(t["xAG"], 2),
            "cj": int(t["CrdY"]), "cr": int(t["CrdR"]),
            "cl": j["clubs"] if j["nb_clubs"] > 1 else "",
            "src": j["poste_source"],
            "id": tmd.get("tm_id", ""),
            # adresses d images reduites a leur partie variable
            "ct": prof.get("contrat_fin", ""), "ca": prof.get("club_actuel", ""),
            "ln": prof.get("lieu_naissance", ""),
            "sel": prof.get("selections", ""), "selb": prof.get("buts_selection", ""),
            "pd_tm": declares,            # postes declares par Transfermarkt
            "ph": (med.get("portrait", "") or "").replace(PREFIXE_PORTRAIT, ""),
            "fl": med.get("drapeau", "") or "",
            "ci": med.get("club_id", "") or "",
            "x": [j["percentiles"].get(k) for k in cles],
            "r": [j["variables"].get(k) for k in cles],
            "xd": [j.get("percentiles_desc", {}).get(k) for k in cles_d],
            "rd": [j.get("descriptives", {}).get(k) for k in cles_d],
        })

    payload = {
        "saison": "2024-2025", "variables": meta_vars, "descriptives": meta_desc,
        "poids": POIDS_POSTE, "postes": POSTES, "postes_libelle": POSTES_LIBELLE,
        "postes_pluriel": POSTES_PLURIEL, "postes_understat": POSTES_UNDERSTAT,
        "familles_ordre": ORDRE_FAMILLES, "familles_explications": EXPLICATIONS_FAMILLES,
        "prefixes": {"portrait": PREFIXE_PORTRAIT, "drapeau": PREFIXE_DRAPEAU,
                     "logo": PREFIXE_LOGO},
        "clubs": clubs, "joueurs": out,
        "seuil_minutes": MIN_MINUTES_INCLUS, "seuil_reference": MIN_MINUTES_REFERENCE,
    }
    with open(JS_OUT, "w", encoding="utf-8") as f:
        f.write("const DATA = ")
        json.dump(propre(payload), f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
        f.write(";" + chr(10))
    print(f"   site : {len(out)} joueurs comparables, {len(clubs)} clubs -> {JS_OUT} "
          f"({os.path.getsize(JS_OUT) / 1e6:.1f} Mo)")


def ecrire_fiches(joueurs):
    """Second fichier : tirs, postes occupes et match par match, venus d'Understat.

    Il est separe de data.js parce qu'il pese plus lourd et qu'il ne sert qu'a la
    fiche d'un joueur, jamais au calcul de ressemblance. Les noms d'equipe sont
    remplaces par leur rang dans une liste commune : ecrits en clair, ils
    representaient a eux seuls pres de la moitie du fichier."""
    if not os.path.exists(UNDERSTAT):
        print("   pas de understat_2024_25.json, la fiche se passera des cartes de tirs")
        return
    with open(UNDERSTAT, encoding="utf-8") as f:
        brut = json.load(f)
    fiches_source = brut.get("joueurs", {})

    comparables = {j["nom"] for j in joueurs if j["comparable"]}
    equipes, rang = [], {}

    def code_equipe(nom):
        nom = nom or ""
        if nom not in rang:
            rang[nom] = len(equipes)
            equipes.append(nom)
        return rang[nom]

    fiches = {}
    for nom, f in fiches_source.items():
        if nom not in comparables:
            continue
        f = dict(f)
        f["tirs"] = [[t[0], t[1], round(t[2], 3), t[3], t[4], t[5], t[6], code_equipe(t[7])]
                     for t in f.get("tirs", [])]
        # tableaux plutot qu'objets : repeter treize noms de champ pour chacun des
        # 72 000 matchs pesait plus lourd que les donnees elles-memes
        f["matchs"] = [[m["d"], code_equipe(m["h"]), code_equipe(m["a"]), m["sh"], m["sa"],
                        m["min"], m["b"], m["pd"], m["xg"], m["xa"], m["t"], m["pc"], m["p"]]
                       for m in f.get("matchs", [])]
        f["saisons"] = [[v["s"], code_equipe(v.get("eq", "")), v["min"], v["matchs"],
                         v["b"], v["pd"], v["xg"], v["xa"]]
                        for v in f.get("saisons", [])]
        fiches[nom] = f

    payload = {"equipes": equipes, "joueurs": fiches}
    with open(FICHES_OUT, "w", encoding="utf-8") as f:
        f.write("const FICHES = ")
        json.dump(propre(payload), f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
        f.write(";" + chr(10))
    tirs = sum(len(v.get("tirs", [])) for v in fiches.values())
    print(f"   fiches : {len(fiches)} joueurs, {tirs} tirs localises, {len(equipes)} equipes "
          f"-> {FICHES_OUT} ({os.path.getsize(FICHES_OUT) / 1e6:.1f} Mo)")


if __name__ == "__main__":
    main()
