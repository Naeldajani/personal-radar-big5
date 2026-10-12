# -*- coding: utf-8 -*-
"""Etape 4 : assemble le site en une page unique, sans fichier externe.

Sert a deux choses : la publication en ligne, et une copie que l'on peut ouvrir
par double clic ou envoyer par mail sans emporter le dossier autour.

Le dossier `site/` reste la version de travail, celle qu'on heberge : elle charge
ses fichiers separement, donc le navigateur les met en cache. La page autonome
inline tout, ce qui la rend lourde mais autoportante.
"""
import os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(ICI, "..", "site"))

# La saison se donne en argument : `python construire_page_autonome.py 2526`.
# Seuls les deux fichiers de donnees changent, le code du site est commun.
SAISON = sys.argv[1] if len(sys.argv) > 1 else "2425"
SUFFIXE = "" if SAISON == "2425" else f"_{SAISON}"
MARQUE = "" if SAISON == "2425" else f"-{SAISON}"
AUTONOME = os.path.join(SITE, f"radar-big5{MARQUE}-autonome.html")
PUBLICATION = os.path.join(SITE, f"radar-big5{MARQUE}-publication.html")

# l'ordre compte : data.js et fiches.js doivent exister avant que app.js les lise
SCRIPTS = [f"data{SUFFIXE}.js", f"fiches{SUFFIXE}.js",
           "app.js", "fiche.js", "comparer.js", "explorer.js"]
NL = chr(10)


def lire(nom):
    with open(os.path.join(SITE, nom), encoding="utf-8") as f:
        return f.read()


def main():
    html = lire("index.html")

    balise_css = '<link rel="stylesheet" href="style.css">'
    assert balise_css in html, "la balise de la feuille de style a change"
    html = html.replace(balise_css, "<style>" + NL + lire("style.css") + NL + "</style>")

    # index.html cite toujours data.js et fiches.js : c'est ce bloc qu'on remplace,
    # quelle que soit la saison dont on inline les donnees.
    balises = NL.join(f'<script src="{n}"></script>'
                      for n in ["data.js", "fiches.js", "app.js", "fiche.js",
                                "comparer.js", "explorer.js"])
    assert balises in html, "les balises de script ont change"
    corps_js = (NL * 2).join(lire(n) for n in SCRIPTS)
    complet = html.replace(balises, "<script>" + NL + corps_js + NL + "</script>")

    with open(AUTONOME, "w", encoding="utf-8") as f:
        f.write(complet)

    # version pour la publication : le squelette de page est fourni par l'hote
    corps = complet
    for motif in (r"<!doctype html>\s*", r"</?html[^>]*>\s*", r"</?head>\s*",
                  r"</?body>\s*", r'<meta charset="utf-8">\s*',
                  r'<meta name="viewport"[^>]*>\s*'):
        corps = re.sub(motif, "", corps, flags=re.IGNORECASE)
    with open(PUBLICATION, "w", encoding="utf-8") as f:
        f.write(corps.strip() + NL)

    for chemin in (AUTONOME, PUBLICATION):
        print(f"  {os.path.basename(chemin)} : {os.path.getsize(chemin) / 1e6:.2f} Mo")


if __name__ == "__main__":
    main()
