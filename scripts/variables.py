# -*- coding: utf-8 -*-
"""Definition des variables de comparaison, calculees par 90 minutes a partir des totaux FBref.

Chaque entree : cle -> (libelle FR, famille, fonction(totaux) -> valeur, inverse)
`inverse=True` signifie qu'une valeur basse est meilleure : le percentile est retourne.
"""


def d(num, den):
    """Division protegee."""
    return num / den if den else float("nan")


# ---- joueurs de champ -------------------------------------------------------
CHAMP = {
    # Finition
    "buts_90":            ("Buts (hors pénalty)", "Finition", lambda t: d(t["G-PK"], t["n90"]), False),
    "tirs_90":            ("Tirs", "Finition", lambda t: d(t["Sh"], t["n90"]), False),
    "tirs_cadres_90":     ("Tirs cadrés", "Finition", lambda t: d(t["SoT"], t["n90"]), False),
    "pct_tirs_cadres":    ("Pourcentage de tirs cadrés", "Finition", lambda t: 100 * d(t["SoT"], t["Sh"]), False),
    "npxg_90":            ("xG hors pénalty", "Finition", lambda t: d(t["npxG"], t["n90"]), False),
    "npxg_par_tir":       ("xG par tir (qualité des positions)", "Finition", lambda t: d(t["npxG"], t["Sh"]), False),
    "surperf_finition_90": ("Buts moins xG (efficacité)", "Finition", lambda t: d(t["G-PK"] - t["npxG"], t["n90"]), False),
    "distance_tir":       ("Distance moyenne de tir", "Finition", lambda t: t["Dist_moy"], True),

    # Creation
    "passes_dec_90":      ("Passes décisives", "Création", lambda t: d(t["Ast"], t["n90"]), False),
    "xag_90":             ("xAG, passes décisives attendues", "Création", lambda t: d(t["xAG"], t["n90"]), False),
    "xa_90":              ("xA, qualité des occasions créées", "Création", lambda t: d(t["xA"], t["n90"]), False),
    "passes_cles_90":     ("Passes clés", "Création", lambda t: d(t["KP"], t["n90"]), False),
    "sca_90":             ("Actions menant à un tir", "Création", lambda t: d(t["SCA"], t["n90"]), False),
    "gca_90":             ("Actions menant à un but", "Création", lambda t: d(t["GCA"], t["n90"]), False),
    "passes_surface_90":  ("Passes dans la surface", "Création", lambda t: d(t["PPA"], t["n90"]), False),
    "centres_surface_90": ("Centres dans la surface", "Création", lambda t: d(t["CrsPA"], t["n90"]), False),
    "passes_tiers_off_90": ("Passes vers le tiers offensif", "Création", lambda t: d(t["1/3"], t["n90"]), False),

    # Passe
    "passes_90":          ("Passes tentées", "Passe", lambda t: d(t["Att_pass"], t["n90"]), False),
    "pct_passes":         ("Pourcentage de passes réussies", "Passe", lambda t: 100 * d(t["Cmp"], t["Att_pass"]), False),
    "passes_prog_90":     ("Passes progressives", "Passe", lambda t: d(t["PrgP"], t["n90"]), False),
    "dist_passes_90":     ("Distance de passe totale (m)", "Passe", lambda t: d(t["TotDist"], t["n90"]), False),
    "dist_prog_passes_90": ("Distance de passe vers l'avant (m)", "Passe", lambda t: d(t["PrgDist"], t["n90"]), False),
    "changements_aile_90": ("Changements d'aile", "Passe", lambda t: d(t["Sw"], t["n90"]), False),
    "passes_profondeur_90": ("Passes en profondeur", "Passe", lambda t: d(t["TB"], t["n90"]), False),
    "centres_90":         ("Centres", "Passe", lambda t: d(t["Crs"], t["n90"]), False),
    "corners_90":         ("Corners tirés", "Passe", lambda t: d(t["CK"], t["n90"]), False),
    "coups_francs_90":    ("Coups francs joués", "Passe", lambda t: d(t["FK"], t["n90"]), False),

    # Conduite de balle
    "conduites_90":       ("Conduites de balle", "Conduite", lambda t: d(t["Carries"], t["n90"]), False),
    "conduites_prog_90":  ("Conduites progressives", "Conduite", lambda t: d(t["PrgC"], t["n90"]), False),
    "dist_prog_conduite_90": ("Distance conduite vers l'avant (m)", "Conduite", lambda t: d(t["PrgDist_car"], t["n90"]), False),
    "conduites_surface_90": ("Conduites jusqu'à la surface", "Conduite", lambda t: d(t["CPA"], t["n90"]), False),
    "conduites_tiers_off_90": ("Conduites vers le tiers offensif", "Conduite", lambda t: d(t["1/3_car"], t["n90"]), False),
    "dribbles_90":        ("Dribbles tentés", "Conduite", lambda t: d(t["Att_drib"], t["n90"]), False),
    "pct_dribbles":       ("Pourcentage de dribbles réussis", "Conduite", lambda t: 100 * d(t["Succ"], t["Att_drib"]), False),
    "pertes_balle_90":    ("Ballons perdus au contrôle", "Conduite", lambda t: d(t["Mis"] + t["Dis"], t["n90"]), True),

    # Volume et positionnement
    "touches_90":         ("Touches de balle", "Volume", lambda t: d(t["Touches"], t["n90"]), False),
    "receptions_prog_90": ("Ballons progressifs reçus", "Volume", lambda t: d(t["PrgR"], t["n90"]), False),
    "touches_surface_off_90": ("Touches dans la surface adverse", "Volume", lambda t: d(t["Att Pen"], t["n90"]), False),
    "pct_touches_off":    ("Part des touches dans le tiers offensif", "Volume", lambda t: 100 * d(t["Att 3rd_p"], t["Touches"]), False),
    "pct_touches_def":    ("Part des touches dans le tiers défensif", "Volume", lambda t: 100 * d(t["Def 3rd_p"], t["Touches"]), False),

    # Defense
    "tacles_90":          ("Tacles", "Défense", lambda t: d(t["Tkl"], t["n90"]), False),
    "tacles_gagnes_90":   ("Tacles gagnants", "Défense", lambda t: d(t["TklW"], t["n90"]), False),
    "interceptions_90":   ("Interceptions", "Défense", lambda t: d(t["Int"], t["n90"]), False),
    "tacles_int_90":      ("Tacles plus interceptions", "Défense", lambda t: d(t["Tkl+Int"], t["n90"]), False),
    "contres_90":         ("Contres", "Défense", lambda t: d(t["Blocks_def"], t["n90"]), False),
    "tirs_contres_90":    ("Tirs contrés", "Défense", lambda t: d(t["Sh_blk"], t["n90"]), False),
    "degagements_90":     ("Dégagements", "Défense", lambda t: d(t["Clr"], t["n90"]), False),
    "recuperations_90":   ("Ballons récupérés", "Défense", lambda t: d(t["Recov"], t["n90"]), False),
    "pct_duels_dribble":  ("Pourcentage de duels de dribble gagnés", "Défense", lambda t: t["Tkl%_moy"], False),
    "erreurs_90":         ("Erreurs menant à un tir", "Défense", lambda t: d(t["Err"], t["n90"]), True),

    # Zones defensives
    "tacles_tiers_def_90": ("Tacles dans le tiers défensif", "Zone défensive", lambda t: d(t["Def 3rd_d"], t["n90"]), False),
    "tacles_tiers_med_90": ("Tacles dans le tiers médian", "Zone défensive", lambda t: d(t["Mid 3rd_d"], t["n90"]), False),
    "tacles_tiers_off_90": ("Tacles dans le tiers offensif (pressing haut)", "Zone défensive", lambda t: d(t["Att 3rd_d"], t["n90"]), False),

    # Duels et discipline
    "duels_aeriens_90":   ("Duels aériens gagnés", "Duel", lambda t: d(t["Won"], t["n90"]), False),
    "pct_duels_aeriens":  ("Pourcentage de duels aériens gagnés", "Duel", lambda t: 100 * d(t["Won"], t["Won"] + t["Lost_air"]), False),
    "fautes_90":          ("Fautes commises", "Duel", lambda t: d(t["Fls"], t["n90"]), True),
    "fautes_subies_90":   ("Fautes subies", "Duel", lambda t: d(t["Fld"], t["n90"]), False),
    "cartons_jaunes_90":  ("Cartons jaunes", "Duel", lambda t: d(t["CrdY"], t["n90"]), True),
    "hors_jeu_90":        ("Hors-jeu", "Duel", lambda t: d(t["Off"], t["n90"]), True),
}

# ---- gardiens ---------------------------------------------------------------
GARDIEN = {
    "arrets_90":          ("Arrêts", "Arrêts", lambda t: d(t["Saves"], t["n90"]), False),
    "pct_arrets":         ("Pourcentage d'arrêts", "Arrêts", lambda t: 100 * d(t["Saves"], t["SoTA"]), False),
    "tirs_cadres_subis_90": ("Tirs cadrés subis", "Arrêts", lambda t: d(t["SoTA"], t["n90"]), False),
    "buts_encaisses_90":  ("Buts encaissés", "Arrêts", lambda t: d(t["GA"], t["n90"]), True),
    "surperf_psxg_90":    ("Buts évités par rapport au xG après tir", "Arrêts", lambda t: d(t["PSxG"] - t["GA"], t["n90"]), False),
    "psxg_par_tir":       ("Difficulté moyenne des tirs subis", "Arrêts", lambda t: d(t["PSxG"], t["SoTA"]), False),
    "pct_clean_sheets":   ("Pourcentage de clean sheets", "Arrêts", lambda t: 100 * d(t["CS"], t["MP"]), False),
    "pct_penaltys_arretes": ("Pourcentage de pénaltys arrêtés", "Arrêts", lambda t: 100 * d(t["PKsv"], t["PKatt_gk"]), False),
    "passes_90":          ("Passes tentées", "Relance", lambda t: d(t["Att_pass"], t["n90"]), False),
    "pct_passes":         ("Pourcentage de passes réussies", "Relance", lambda t: 100 * d(t["Cmp"], t["Att_pass"]), False),
    "relances_longues_90": ("Relances longues (plus de 40 yards)", "Relance", lambda t: d(t["Att_long"], t["n90"]), False),
    "pct_relances_longues": ("Pourcentage de relances longues réussies", "Relance", lambda t: 100 * d(t["Cmp_long"], t["Att_long"]), False),
    "pct_jeu_long":       ("Part de jeu long", "Relance", lambda t: t["Launch%_moy"], False),
    "longueur_relance":   ("Longueur moyenne de relance (m)", "Relance", lambda t: t["AvgLen_moy"], False),
    "sorties_aeriennes_90": ("Sorties aériennes", "Sorties", lambda t: d(t["Stp"], t["n90"]), False),
    "pct_sorties_aeriennes": ("Pourcentage de centres captés", "Sorties", lambda t: t["Stp%_moy"], False),
    "sorties_hors_surface_90": ("Sorties hors de la surface", "Sorties", lambda t: d(t["#OPA"], t["n90"]), False),
    "dist_moy_sorties":   ("Distance moyenne d'intervention (m)", "Sorties", lambda t: t["AvgDist_moy"], False),
}
# Le poids de chaque famille selon le poste, et surtout : les familles absentes
# ne sont pas jugees du tout. On ne demande pas a un defenseur central son sens du
# but, ni a un buteur son volume defensif ; les faire figurer sur la toile avec un
# poids symbolique revenait a comparer des joueurs sur ce qu'on ne leur demande
# pas. Une famille absente ici disparait de la toile et du calcul de ressemblance,
# ses variables restent consultables dans le tableau detaille.
POIDS_POSTE = {
    "GB":  {"Arrêts": 1.0, "Relance": 1.0, "Sorties": 1.0},
    "DC":  {"Défense": 1.5, "Duel": 1.3, "Passe": 1.0, "Volume": 0.8,
            "Conduite": 0.7},
    "DG":  {"Défense": 1.2, "Duel": 0.8, "Passe": 1.1, "Volume": 1.0,
            "Conduite": 1.2, "Création": 1.2, "Finition": 0.6},
    "DD":  {"Défense": 1.2, "Duel": 0.8, "Passe": 1.1, "Volume": 1.0,
            "Conduite": 1.2, "Création": 1.2, "Finition": 0.6},
    "MDC": {"Défense": 1.4, "Passe": 1.3, "Volume": 1.0, "Duel": 1.0,
            "Conduite": 0.9, "Création": 0.8},
    "MC":  {"Passe": 1.3, "Volume": 1.1, "Conduite": 1.1, "Défense": 1.0, "Création": 1.0,
            "Duel": 0.8, "Finition": 0.7},
    "MOC": {"Création": 1.4, "Conduite": 1.2, "Passe": 1.1, "Finition": 1.1, "Volume": 1.0,
            "Défense": 0.7, "Duel": 0.6},
    "AG":  {"Conduite": 1.3, "Création": 1.3, "Finition": 1.1, "Volume": 1.1, "Passe": 0.9,
            "Défense": 0.7, "Duel": 0.6},
    "AD":  {"Conduite": 1.3, "Création": 1.3, "Finition": 1.1, "Volume": 1.1, "Passe": 0.9,
            "Défense": 0.7, "Duel": 0.6},
    "BU":  {"Finition": 1.5, "Volume": 1.2, "Duel": 1.0, "Création": 0.9, "Conduite": 0.9,
            "Passe": 0.7},
}


POSTES = ["GB", "DG", "DC", "DD", "MDC", "MC", "MOC", "AG", "AD", "BU"]
# le pluriel est irregulier d'un poste a l'autre, on le stocke plutot que de l'inventer
POSTES_PLURIEL = {
    "GB": "Gardiens de but", "DG": "Défenseurs gauches", "DC": "Défenseurs centraux",
    "DD": "Défenseurs droits", "MDC": "Milieux défensifs centraux",
    "MC": "Milieux centraux", "MOC": "Milieux offensifs centraux",
    "AG": "Ailiers gauches", "AD": "Ailiers droits", "BU": "Buteurs",
}
POSTES_LIBELLE = {
    "GB": "Gardien de but", "DG": "Défenseur gauche", "DC": "Défenseur central",
    "DD": "Défenseur droit", "MDC": "Milieu défensif central", "MC": "Milieu central",
    "MOC": "Milieu offensif central", "AG": "Ailier gauche", "AD": "Ailier droit",
    "BU": "Buteur",
}
