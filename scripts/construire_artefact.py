# -*- coding: utf-8 -*-
"""Etape 6 : assemble la version publiable en artefact.

Un artefact impose deux contraintes que le site heberge n'a pas.

1. Aucune image externe n'est autorisee. Les portraits, ecussons et drapeaux
   doivent voyager dans la page, en base64 : c'est le role de images.js, produit
   par telecharger_images.py.
2. La page entiere doit tenir sous 16 Mo. Les donnees brutes en pesent deja 9,5 a
   elles seules, et les images 7 de plus. On compresse donc les deux gros JSON en
   gzip base64, que la page decompresse au chargement avec DecompressionStream.
   Le gain est net : du JSON se compresse d'un facteur quatre, une photo JPEG ne
   se compresse plus du tout, d'ou le traitement different des deux.

Comme la decompression est asynchrone, le code du site ne peut plus s'executer
tel quel a la lecture de la balise. Il est enveloppe dans une fonction que le
demarreur appelle une fois DATA et FICHES disponibles.

Sortie : site/radar-big5-artefact.html
"""
import base64, gzip, json, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(ICI, "..", "site"))
# La saison se donne en argument : `python construire_artefact.py 2526`.
SAISON = next((a for a in sys.argv[1:] if a.isdigit()), "2425")
SUFFIXE = "" if SAISON == "2425" else f"_{SAISON}"
MARQUE = "" if SAISON == "2425" else f"-{SAISON}"
SORTIE = os.path.join(SITE, f"radar-big5{MARQUE}-artefact.html")
# meme page, mais avec le squelette HTML que l'hote de l'artefact fournit d'habitude :
# elle sert uniquement a verifier le rendu en local avant de publier
ESSAI = os.path.join(SITE, f"radar-big5{MARQUE}-artefact-essai.html")

CODE = ["app.js", "fiche.js", "comparer.js", "explorer.js"]
# la derniere ligne d'app.js, que le constructeur doit neutraliser (voir main)
QUEUE_APP = ('if (document.readyState === "loading")' + chr(10) +
             '  document.addEventListener("DOMContentLoaded", init);' + chr(10) +
             'else init();')
NL = chr(10)


def lire(nom):
    with open(os.path.join(SITE, nom), encoding="utf-8") as f:
        return f.read()


def refuser(constante):
    """JSON.parse, cote navigateur, refuse NaN et Infinity. Autant s'en apercevoir
    ici plutot que devant une page blanche."""
    raise ValueError(f"{constante} dans les donnees : JSON.parse le refusera")


def en_lignes(b64, largeur=200):
    """Coupe le base64 en lignes courtes. Un flot d'un million de caracteres sur
    une seule ligne fait trebucher certains analyseurs HTML ; atob, lui, ignore
    les espaces et les retours a la ligne."""
    return NL.join(b64[i:i + largeur] for i in range(0, len(b64), largeur))


def sans_images(json_texte):
    """Version publique : aucune image Transfermarkt, ni embarquee ni appelee sur
    leur CDN. Sans adresse de portrait, de drapeau ni de logo, le site affiche
    les initiales et retire simplement drapeaux et ecussons."""
    donnees = json.loads(json_texte, parse_constant=refuser)
    donnees["prefixes"] = {}
    for j in donnees["joueurs"]:
        for cle in ("ph", "fl", "ci"):
            j.pop(cle, None)
    return json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))


def charge_utile(nom, prefixe, transformer=None):
    """data.js et fiches.js sont des affectations JavaScript. On ne garde que le
    JSON, qu'on comprime et qu'on encode."""
    brut = lire(nom).strip()
    assert brut.startswith(prefixe), f"{nom} ne commence pas par {prefixe}"
    json_texte = brut[len(prefixe):].rstrip().rstrip(";")
    if transformer:
        json_texte = transformer(json_texte)
    json.loads(json_texte, parse_constant=refuser)   # verification avant de compresser
    comprime = gzip.compress(json_texte.encode("utf-8"), 9)
    return base64.b64encode(comprime).decode(), len(json_texte), len(comprime)


DEMARREUR = """
/* Les donnees voyagent compressees : une page d'artefact ne peut rien aller
   chercher dehors, et 9,5 Mo de JSON brut ne tiendraient pas dans le budget.
   DecompressionStream fait le travail, sans bibliotheque. */
(async () => {
  const ecran = document.getElementById("chargement");
  const dire = (t) => { const e = document.getElementById("chargement-etat");
                        if (e) e.textContent = t; };
  const inflater = async (id) => {
    const b64 = document.getElementById(id).textContent.trim();
    const binaire = atob(b64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    const flux = new Blob([octets]).stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(flux).text());
  };
  try {
    if (typeof DecompressionStream === "undefined")
      throw new Error("navigateur trop ancien");
    dire("Lecture des 2155 joueurs");
    window.DATA = await inflater("donnees-joueurs");
    dire("Lecture des 42 352 tirs");
    window.FICHES = await inflater("donnees-fiches");
    dire("Mise en place");
    /* Un cadre d'artefact demarre a 0 x 0 et n'est dimensionne qu'ensuite. Tant
       qu'il n'a aucune surface, le navigateur n'appelle jamais les callbacks
       d'animation : attendre requestAnimationFrame seul bloquerait la page pour
       toujours. On laisse donc un delai gagner la course. */
    await new Promise((r) => {
      let fait = false;
      const finir = () => { if (!fait) { fait = true; r(); } };
      requestAnimationFrame(finir);
      setTimeout(finir, 80);
    });
    demarrerRadarBig5();
    if (ecran) ecran.remove();
  } catch (e) {
    dire("");
    if (ecran) ecran.innerHTML =
      '<p class="chargement-titre">Cette page ne s\\'affiche pas ici</p>' +
      '<p class="chargement-detail">Elle a besoin d\\'un navigateur recent, ' +
      'Chrome 80, Safari 16.4 ou Firefox 113 au minimum. Erreur : ' +
      String(e.message || e) + '</p>';
    throw e;
  }
})();
"""

ECRAN = """
<div id="chargement">
  <div class="chargement-boite">
    <p class="chargement-titre">Comparateur <span>Player</span></p>
    <p class="chargement-detail" id="chargement-etat">Ouverture</p>
    <div class="chargement-barre"><i></i></div>
  </div>
</div>
"""

TEMOIN = """
<div id="temoin" style="position:fixed;left:0;right:0;top:0;z-index:999;
  background:#38bdf8;color:#04121a;font:600 12px/1.4 monospace;padding:7px 12px">
  demarrage en cours
</div>
<script>
  (function(){
    const t = document.getElementById("temoin");
    const dire = (m) => { t.textContent = m; };
    addEventListener("error", (e) => dire("ERREUR " + e.message));
    addEventListener("unhandledrejection", (e) => dire("REJET " + (e.reason && e.reason.message)));
    setInterval(() => {
      const v = document.getElementById("vue-fiche");
      if (!t.textContent.startsWith("ERREUR") && !t.textContent.startsWith("REJET"))
        dire("blocs=" + (v ? v.children.length : "?") +
             " cadre=" + innerWidth + "x" + innerHeight +
             " data=" + (typeof DATA) + " images=" + (typeof IMAGES));
    }, 900);
  })();
</script>
"""

STYLE_ECRAN = """
/* ═══════════════════════════════ ecran d'attente de la version artefact */
/* Les donnees arrivent compressees et mettent une seconde ou deux a s'ouvrir.
   Mieux vaut le dire que laisser une page noire. */
#chargement{position:fixed;inset:0;z-index:300;display:grid;place-content:center;
            background:var(--fond);text-align:center}
.chargement-titre{font:700 22px/1 var(--cond);letter-spacing:.1em;
                  text-transform:uppercase;color:var(--texte)}
.chargement-titre span{color:var(--a)}
.chargement-detail{margin-top:11px;color:var(--gris2);font-size:13px;max-width:34ch}
.chargement-barre{margin:18px auto 0;width:190px;height:3px;border-radius:2px;
                  background:var(--bord);overflow:hidden}
.chargement-barre i{display:block;width:40%;height:100%;border-radius:2px;
                    background:var(--a);animation:glisse 1.15s ease-in-out infinite}
@keyframes glisse{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}
@media (prefers-reduced-motion:reduce){.chargement-barre i{animation:none;width:100%}}
"""


def main():
    html = lire("index.html")

    # feuille de style, augmentee de l'ecran d'attente
    balise_css = '<link rel="stylesheet" href="style.css">'
    assert balise_css in html, "la balise de la feuille de style a change"
    css = lire("style.css") + STYLE_ECRAN
    html = html.replace(balise_css, "<style>" + NL + css + NL + "</style>")

    # le squelette de page est fourni par l'hote de l'artefact
    for motif in (r"<!doctype html>\s*", r"</?html[^>]*>\s*", r"<head>\s*", r"</head>\s*",
                  r"</?body>\s*", r'<meta charset="utf-8">\s*',
                  r'<meta name="viewport"[^>]*>\s*'):
        html = re.sub(motif, "", html, flags=re.IGNORECASE)

    public = "--public" in sys.argv
    donnees, brut1, zip1 = charge_utile(f"data{SUFFIXE}.js", "const DATA = ",
                                        sans_images if public else None)
    print(f"  donnees : {brut1/1e6:.1f} Mo -> {zip1/1e6:.1f} Mo comprimes")
    if "--sans-fiches" in sys.argv:
        fiches = base64.b64encode(gzip.compress(b'{"equipes":[],"joueurs":{}}', 9)).decode()
        print("  fiches  : aucune (mode diagnostic)")
    else:
        fiches, brut2, zip2 = charge_utile(f"fiches{SUFFIXE}.js", "const FICHES = ")
        print(f"  fiches  : {brut2/1e6:.1f} Mo -> {zip2/1e6:.1f} Mo comprimes")

    # --sans-images sert au diagnostic : le visualiseur d'artefact a une limite de
    # poids bien plus basse que les 16 Mo annonces, et les images en sont l'essentiel
    if "--sans-images" in sys.argv or public:
        images = "const IMAGES = {p:{},c:{},d:{}};"
        print("  images  : aucune (mode diagnostic)")
    else:
        images = lire(f"images{SUFFIXE}.js")
        print(f"  images  : {len(images)/1e6:.1f} Mo")

    corps_js = (NL * 2).join(lire(n) for n in CODE)
    assert "</script" not in corps_js, "du code contient une balise de fermeture de script"

    # Les quatre fichiers se retrouvent dans une seule portee. app.js appelle init()
    # a sa derniere ligne, ce qui marchait tant que chaque fichier avait sa propre
    # balise : ici les constantes de fiche.js ne seraient pas encore initialisees.
    # On deplace donc l'appel tout a la fin.
    assert QUEUE_APP in corps_js, "le demarrage d'app.js a change, verifier construire_artefact"
    corps_js = corps_js.replace(QUEUE_APP, "/* demarrage deplace en fin de fichier */")
    corps_js = ("function demarrerRadarBig5() {" + NL + corps_js + NL +
                "  init();" + NL + "}" + NL)

    temoin = TEMOIN if "--temoin" in sys.argv else ""
    blocs = [
        ECRAN, temoin,
        '<script id="donnees-joueurs" type="application/gzip-base64">' + NL +
        en_lignes(donnees) + NL + '</script>',
        '<script id="donnees-fiches" type="application/gzip-base64">' + NL +
        en_lignes(fiches) + NL + '</script>',
        "<script>" + NL + images + NL + "</script>",
        "<script>" + NL + corps_js + NL + "</script>",
        "<script>" + NL + DEMARREUR + NL + "</script>",
    ]

    balises = NL.join(f'<script src="{n}"></script>'
                      for n in ["data.js", "fiches.js"] + CODE)
    assert balises in html, "les balises de script ont change"
    html = html.replace(balises, NL.join(blocs))

    if public:
        # page complete servie par GitHub Pages depuis le dossier docs/
        docs = os.path.abspath(os.path.join(ICI, "..", "docs"))
        os.makedirs(docs, exist_ok=True)
        sortie = os.path.join(docs, "index.html")
        with open(sortie, "w", encoding="utf-8") as f:
            f.write('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
                    '<meta name="viewport" content="width=device-width, initial-scale=1">'
                    "<title>Radar Big 5</title></head><body>" + NL + html.strip() + NL +
                    "</body></html>" + NL)
        print(f"  docs/index.html : {os.path.getsize(sortie)/1e6:.2f} Mo")
        return

    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(html.strip() + NL)
    with open(ESSAI, "w", encoding="utf-8") as f:
        f.write('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width, initial-scale=1">'
                "</head><body>" + NL + html.strip() + NL + "</body></html>" + NL)
    poids = os.path.getsize(SORTIE) / 1e6
    print(f"  {os.path.basename(SORTIE)} : {poids:.2f} Mo "
          f"({'sous' if poids < 16 else 'AU-DESSUS DE'} la limite de 16 Mo)")


if __name__ == "__main__":
    main()
