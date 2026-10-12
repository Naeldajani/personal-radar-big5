# -*- coding: utf-8 -*-
"""Variables descriptives : celles qui remplissent la fiche du joueur.

Elles n'entrent pas dans le calcul de ressemblance, qui reste fonde sur les 59
variables de `variables.py`. Elles existent parce qu'on ne recrute pas un joueur
sur un style de jeu : on regarde aussi ce qu'il coute (cartons, penaltys concedes),
ce qu'il rapporte au collectif, et ou il touche le ballon sur le terrain.

Meme forme que dans variables.py : cle -> (libelle FR, famille, fonction(totaux), inverse).
"""


def d(num, den):
    """Division protegee."""
    return num / den if den else float("nan")


# ---- joueurs de champ -------------------------------------------------------
DESCRIPTIVES = {
    # Finition, le detail que le radar laisse de cote
    "buts_tous_90":        ("Buts, pénaltys compris", "Finition", lambda t: d(t["Gls"], t["n90"]), False),
    "penaltys_marques":    ("Pénaltys marqués", "Finition", lambda t: t["PK"], False),
    "penaltys_tentes":     ("Pénaltys tirés", "Finition", lambda t: t["PKatt"], False),
    "pct_penaltys":        ("Pourcentage de pénaltys marqués", "Finition", lambda t: 100 * d(t["PK"], t["PKatt"]), False),
    "buts_par_tir":        ("Buts par tir", "Finition", lambda t: d(t["Gls"], t["Sh"]), False),
    "buts_par_tir_cadre":  ("Buts par tir cadré", "Finition", lambda t: d(t["Gls"], t["SoT"]), False),
    "coups_francs_tires_90": ("Coups francs tirés au but", "Finition", lambda t: d(t["FK_tirs"], t["n90"]), False),
    "xg_total":            ("xG cumulé sur la saison", "Finition", lambda t: t["xG"], False),

    # Creation, complements
    "surperf_passes_90":   ("Passes décisives moins xAG", "Création", lambda t: d(t["Ast"] - t["xAG"], t["n90"]), False),
    "xag_total":           ("xAG cumulé sur la saison", "Création", lambda t: t["xAG"], False),
    "sca_passe_90":        ("Actions de tir nées d'une passe", "Création", lambda t: d(t["SCA_pass"], t["n90"]), False),
    "sca_dribble_90":      ("Actions de tir nées d'un dribble", "Création", lambda t: d(t["SCA_drib"], t["n90"]), False),
    "sca_faute_90":        ("Actions de tir nées d'une faute subie", "Création", lambda t: d(t["SCA_fld"], t["n90"]), False),

    # Zones de ballon : ou le joueur touche le ballon sur le terrain
    "touches_surface_def_90": ("Touches dans sa propre surface", "Zone de ballon", lambda t: d(t["Def Pen"], t["n90"]), False),
    "touches_tiers_def_90": ("Touches dans le tiers défensif", "Zone de ballon", lambda t: d(t["Def 3rd_p"], t["n90"]), False),
    "touches_tiers_med_90": ("Touches dans le tiers médian", "Zone de ballon", lambda t: d(t["Mid 3rd_p"], t["n90"]), False),
    "touches_tiers_att_90": ("Touches dans le tiers offensif", "Zone de ballon", lambda t: d(t["Att 3rd_p"], t["n90"]), False),
    "pct_touches_med":     ("Part des touches dans le tiers médian", "Zone de ballon", lambda t: 100 * d(t["Mid 3rd_p"], t["Touches"]), False),
    "ballons_recus_90":    ("Ballons reçus", "Zone de ballon", lambda t: d(t["Rec"], t["n90"]), False),
    "dist_moy_conduite":   ("Distance moyenne par conduite (m)", "Zone de ballon", lambda t: d(t["TotDist_car"], t["Carries"]), False),

    # Coups de pied arretes et ballons rendus au jeu
    "corners_rentrants_90": ("Corners rentrants", "Coup de pied arrêté", lambda t: d(t["In"], t["n90"]), False),
    "corners_sortants_90": ("Corners sortants", "Coup de pied arrêté", lambda t: d(t["Out"], t["n90"]), False),
    "touches_ligne_90":    ("Touches de ligne jouées", "Coup de pied arrêté", lambda t: d(t["TI"], t["n90"]), False),
    "ballons_arretes_90":  ("Ballons joués à l'arrêt", "Coup de pied arrêté", lambda t: d(t["Dead"], t["n90"]), False),

    # Ce que ses actions coutent a son equipe
    "duels_dribble_90":    ("Duels de dribble subis", "Discipline", lambda t: d(t["Att_duel"], t["n90"]), False),
    "duels_dribble_perdus_90": ("Dribbles concédés", "Discipline", lambda t: d(t["Lost_duel"], t["n90"]), True),
    "duels_aeriens_perdus_90": ("Duels aériens perdus", "Discipline", lambda t: d(t["Lost_air"], t["n90"]), True),
    "passes_contrees_90":  ("Passes contrées", "Discipline", lambda t: d(t["Pass_blk"], t["n90"]), False),
    "cartons_rouges":      ("Cartons rouges", "Discipline", lambda t: t["CrdR"], True),
    "doubles_jaunes":      ("Expulsions pour deux jaunes", "Discipline", lambda t: t["2CrdY"], True),
    "penaltys_obtenus":    ("Pénaltys obtenus", "Discipline", lambda t: t["PKwon"], False),
    "penaltys_concedes":   ("Pénaltys concédés", "Discipline", lambda t: t["PKcon"], True),
    "csc":                 ("Buts contre son camp", "Discipline", lambda t: t["OG"], True),

    # Impact collectif : ce que devient l'equipe quand il est sur le terrain
    "points_par_match":    ("Points par match de l'équipe", "Impact collectif", lambda t: t["PPM_moy"], False),
    "diff_buts_90":        ("Différence de buts par 90 minutes", "Impact collectif", lambda t: t["diff_moy"], False),
    "diff_xg_90":          ("Différence de xG par 90 minutes", "Impact collectif", lambda t: t["diffxg_moy"], False),
    "on_off_xg":           ("Écart de xG entre avec et sans lui", "Impact collectif", lambda t: t["onoff_moy"], False),
    "pct_minutes_club":    ("Part des minutes du club jouées", "Impact collectif", lambda t: t["minpct_moy"], False),
    "matchs_complets":     ("Matchs joués en entier", "Impact collectif", lambda t: t["Compl"], False),
    "entrees_en_jeu":      ("Entrées en cours de match", "Impact collectif", lambda t: t["Subs"], False),
    "minutes_par_match":   ("Minutes par match joué", "Impact collectif", lambda t: d(t["Min"], t["MP"]), False),
}

# ---- gardiens ---------------------------------------------------------------
DESCRIPTIVES_GARDIEN = {
    "victoires":           ("Victoires", "Bilan", lambda t: t["W"], False),
    "nuls":                ("Matchs nuls", "Bilan", lambda t: t["D"], False),
    "defaites":            ("Défaites", "Bilan", lambda t: t["L"], True),
    "clean_sheets":        ("Clean sheets", "Bilan", lambda t: t["CS"], False),
    "buts_encaisses":      ("Buts encaissés sur la saison", "Bilan", lambda t: t["GA"], True),
    "penaltys_affrontes":  ("Pénaltys affrontés", "Bilan", lambda t: t["PKatt_gk"], False),
    "penaltys_encaisses":  ("Pénaltys encaissés", "Bilan", lambda t: t["PKA"], True),
    "penaltys_arretes":    ("Pénaltys arrêtés", "Bilan", lambda t: t["PKsv"], False),
    "encaisses_coup_franc": ("Buts encaissés sur coup franc", "Bilan", lambda t: t["FK_gk"], True),
    "encaisses_corner":    ("Buts encaissés sur corner", "Bilan", lambda t: t["CK_gk"], True),
    "relances_main_90":    ("Relances à la main", "Relance", lambda t: d(t["Thr"], t["n90"]), False),
    "degagements_pied_90": ("Dégagements au pied", "Relance", lambda t: d(t["Att_gk"], t["n90"]), False),
    "cpa_adverses_90":     ("Coups de pied arrêtés adverses affrontés", "Sorties", lambda t: d(t["Opp"], t["n90"]), False),
    # un gardien touche aussi le ballon ailleurs que dans sa surface : c'est ce qui
    # separe un gardien de ligne d'un gardien qui joue haut
    "touches_90":          ("Touches de balle", "Zone de ballon", lambda t: d(t["Touches"], t["n90"]), False),
    "touches_surface_def_90": ("Touches dans sa propre surface", "Zone de ballon", lambda t: d(t["Def Pen"], t["n90"]), False),
    "touches_tiers_def_90": ("Touches dans le tiers défensif", "Zone de ballon", lambda t: d(t["Def 3rd_p"], t["n90"]), False),
    "touches_tiers_med_90": ("Touches dans le tiers médian", "Zone de ballon", lambda t: d(t["Mid 3rd_p"], t["n90"]), False),
    "touches_tiers_att_90": ("Touches dans le tiers offensif", "Zone de ballon", lambda t: d(t["Att 3rd_p"], t["n90"]), False),
    "ballons_recus_90":    ("Ballons reçus", "Zone de ballon", lambda t: d(t["Rec"], t["n90"]), False),
    "points_par_match":    ("Points par match de l'équipe", "Impact collectif", lambda t: t["PPM_moy"], False),
    "pct_minutes_club":    ("Part des minutes du club jouées", "Impact collectif", lambda t: t["minpct_moy"], False),
    "matchs_complets":     ("Matchs joués en entier", "Impact collectif", lambda t: t["Compl"], False),
}

# ---- affichage --------------------------------------------------------------
# Ordre des familles dans la fiche, du plus offensif au plus defensif.
ORDRE_FAMILLES = [
    "Finition", "Création", "Passe", "Conduite", "Volume", "Zone de ballon",
    "Coup de pied arrêté", "Défense", "Zone défensive", "Duel", "Discipline",
    "Impact collectif", "Arrêts", "Relance", "Sorties", "Bilan",
]

# Une phrase par famille, ecrite pour quelqu'un qui ne lit pas de statistiques.
# Elle est affichee sous le titre de la famille dans la fiche.
EXPLICATIONS_FAMILLES = {
    "Finition": "Ce que le joueur fait quand il peut tirer : combien de fois, depuis où, et s'il marque plus ou moins que ce que ses positions de tir laissaient attendre.",
    "Création": "Ce qu'il crée pour les autres : passes qui amènent un tir, qualité des occasions offertes, ballons livrés dans la surface.",
    "Passe": "Sa façon de faire circuler le ballon : volume, précision, et capacité à faire avancer le jeu plutôt qu'à le faire tourner.",
    "Conduite": "Ce qu'il fait balle au pied : conduites, dribbles, mètres gagnés vers l'avant, ballons perdus au contrôle.",
    "Volume": "Sa présence dans le jeu : ballons touchés, ballons reçus en position avancée, présence dans la surface adverse.",
    "Zone de ballon": "Où il touche le ballon sur le terrain, de sa propre surface à celle d'en face. C'est ce qui sépare un milieu bas d'un milieu haut.",
    "Coup de pied arrêté": "Sa part dans le jeu arrêté : corners, touches de ligne, ballons remis en jeu.",
    "Défense": "Son travail sans le ballon : tacles, interceptions, contres, dégagements, ballons récupérés.",
    "Zone défensive": "À quelle hauteur du terrain il défend. Beaucoup de tacles dans le tiers offensif signale un joueur qui presse haut.",
    "Duel": "Les duels aériens, et le rapport aux fautes, commises comme subies.",
    "Discipline": "Ce que ses actions coûtent : dribbles concédés, cartons, pénaltys donnés, buts contre son camp.",
    "Impact collectif": "Ce que devient l'équipe quand il est sur le terrain : points pris, différence de buts et de xG, part des minutes du club.",
    "Arrêts": "Le cœur du métier de gardien : arrêts, buts encaissés, et surtout l'écart entre les buts encaissés et ceux attendus.",
    "Relance": "Sa participation au jeu au pied : volume, précision, choix entre le jeu court et le jeu long.",
    "Sorties": "Sa capacité à quitter sa ligne, sur les centres comme dans le dos de sa défense.",
    "Bilan": "Le décompte brut de la saison : résultats, clean sheets, pénaltys.",
}

# ---- carte des postes -------------------------------------------------------
# Understat code les postes occupes sur une grille de terrain. On leur donne ici
# une position : x va de 0 (aile gauche) a 1 (aile droite), y de 0 (sa propre cage)
# a 1 (la cage adverse). Ces reperes servent a dessiner la carte de la fiche.
POSTES_UNDERSTAT = {
    "GK":  {"x": 0.50, "y": 0.045, "court": "GB",  "libelle": "Gardien de but"},
    "DL":  {"x": 0.15, "y": 0.20,  "court": "DG",  "libelle": "Défenseur gauche"},
    "DC":  {"x": 0.50, "y": 0.17,  "court": "DC",  "libelle": "Défenseur central"},
    "DR":  {"x": 0.85, "y": 0.20,  "court": "DD",  "libelle": "Défenseur droit"},
    "DML": {"x": 0.20, "y": 0.34,  "court": "MDG", "libelle": "Milieu défensif gauche"},
    "DMC": {"x": 0.50, "y": 0.33,  "court": "MDC", "libelle": "Milieu défensif central"},
    "DMR": {"x": 0.80, "y": 0.34,  "court": "MDD", "libelle": "Milieu défensif droit"},
    "ML":  {"x": 0.13, "y": 0.50,  "court": "MG",  "libelle": "Milieu gauche"},
    "MC":  {"x": 0.50, "y": 0.49,  "court": "MC",  "libelle": "Milieu central"},
    "MR":  {"x": 0.87, "y": 0.50,  "court": "MD",  "libelle": "Milieu droit"},
    "AML": {"x": 0.15, "y": 0.68,  "court": "AG",  "libelle": "Ailier gauche"},
    "AMC": {"x": 0.50, "y": 0.66,  "court": "MOC", "libelle": "Milieu offensif central"},
    "AMR": {"x": 0.85, "y": 0.68,  "court": "AD",  "libelle": "Ailier droit"},
    "FWL": {"x": 0.28, "y": 0.83,  "court": "AVG", "libelle": "Avant gauche"},
    "FW":  {"x": 0.50, "y": 0.86,  "court": "BU",  "libelle": "Buteur"},
    "FWR": {"x": 0.72, "y": 0.83,  "court": "AVD", "libelle": "Avant droit"},
    "Sub": {"x": 0.50, "y": 0.50,  "court": "REM", "libelle": "Entré en cours de match"},
}

# Understat nomme ses cases en anglais (GK, DL, DMC, AMR, FW...). Le champ
# « court » donne l'abreviation francaise correspondante, celle qui s'affiche
# sur la carte des postes, et « libelle » le nom entier.

# Les libelles de poste de Transfermarkt, ramenes a la grille d'Understat, pour
# pouvoir superposer les postes declares et les postes reellement joues.
POSTE_TM_VERS_UNDERSTAT = {
    "gardien de but": "GK",
    "arriere gauche": "DL", "arriere droit": "DR", "defenseur central": "DC",
    "defenseur": "DC",
    "milieu defensif": "DMC", "milieu central": "MC", "milieu offensif": "AMC",
    "milieu gauche": "ML", "milieu droit": "MR", "milieu de terrain": "MC",
    "ailier gauche": "AML", "ailier droit": "AMR", "ailier": "AMR",
    "avant centre": "FW", "avant-centre": "FW",
    "deuxieme attaquant": "AMC", "second attaquant": "AMC",
    "attaquant": "FW", "buteur": "FW",
}
