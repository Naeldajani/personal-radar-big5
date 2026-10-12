/* Radar Big 5 — noyau commun.
   Ce fichier ne dessine rien : il tient l'etat, la recherche, la navigation, et
   les outils que les trois vues (fiche, comparer, explorer) se partagent.
   Les donnees arrivent par data.js (DATA) et fiches.js (FICHES, facultatif). */

/* fiches.js est facultatif : sans lui, le site fonctionne, il perd seulement les
   cartes de tirs et le detail match par match. Les noms d'equipe y sont stockes
   une fois dans une liste, les fiches n'en gardent que le rang. */
const _F = (typeof FICHES !== "undefined") ? FICHES : {};
const FICHES_JOUEURS = _F.joueurs || {};
const EQUIPES = _F.equipes || [];
const equipe = (i) => EQUIPES[i] || "";
const ficheDe = (j) => FICHES_JOUEURS[j.n] || null;

/* Dans le fichier, un match et une saison sont des tableaux : on ne repete pas les
   noms de champ 72 000 fois. On les redonne ici, pour le seul joueur affiche. */
const matchsDe = (f) => (f && f.matchs ? f.matchs : []).map((m) => ({
  d: m[0], h: m[1], a: m[2], sh: m[3], sa: m[4], min: m[5], b: m[6],
  pd: m[7], xg: m[8], xa: m[9], t: m[10], pc: m[11], p: m[12] }));
const saisonsDe = (f) => (f && f.saisons ? f.saisons : []).map((v) => ({
  s: v[0], eq: v[1], min: v[2], matchs: v[3], b: v[4], pd: v[5], xg: v[6], xa: v[7] }));

/* ══════════════════════════════════════════════════════════════ les couleurs */
/* Aucune couleur n'est ecrite en dur dans le JS : tout vient de la feuille de
   style, ou les deux themes les redefinissent. Les valeurs sont relues une fois
   puis gardees, et le cache est vide au changement de theme, ce qui suffit a
   repeindre tous les graphiques sans recharger la page. */
const _couleurs = new Map();
function C(nom) {
  if (!_couleurs.has(nom))
    _couleurs.set(nom, getComputedStyle(document.documentElement)
      .getPropertyValue("--" + nom).trim() || "#888888");
  return _couleurs.get(nom);
}
const oublierCouleurs = () => _couleurs.clear();
const themeSombre = () => document.documentElement.dataset.theme === "sombre";

const chaleur = () => [C("h0"), C("h1"), C("h2"), C("h3"), C("h4"), C("h5")];

/* Les teintes de famille sont calibrees pour le fond sombre. Sur fond clair elles
   manqueraient de contraste : on les assombrit d'un cran plutot que d'entretenir
   deux palettes en parallele, qui finiraient par diverger. */
function pourTheme(hex) {
  if (themeSombre()) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, v = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, v, b), mn = Math.min(r, v, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((v - b) / d + (v < b ? 6 : 0)) : mx === v ? (b - r) / d + 2 : (r - v) / d + 4;
    h *= 60;
  }
  return `hsl(${h.toFixed(0)} ${Math.min(72, s * 100 + 12).toFixed(0)}% 34%)`;
}

/* Les familles restent sourdes : les deux couleurs vives sont reservees aux deux
   joueurs traces sur la toile, sinon on ne sait plus qui est qui. */
const TEINTES_FAMILLE = {
  "Finition": "#c98b5e", "Création": "#cf7ba9", "Passe": "#5aa9d6",
  "Conduite": "#9b8ec4", "Volume": "#6fb3a8", "Défense": "#7fa86b",
  "Zone défensive": "#a3c48c", "Duel": "#c2a44f", "Zone de ballon": "#7f9bc4",
  "Physique": "#8fa8b8",
  "Coup de pied arrêté": "#b98fa0", "Discipline": "#b0705f",
  "Impact collectif": "#77a5b8",
  "Arrêts": "#7fa86b", "Relance": "#5aa9d6", "Sorties": "#c98b5e", "Bilan": "#c2a44f",
};
/* Saison affichee et date de reference de la valeur marchande : elles suivent le
   jeu de donnees charge plutot que d'etre ecrites en dur dans les vues. */
const SAISON = DATA.saison;
const FIN_SAISON = "30 juin " + SAISON.slice(-4);
/* 2024-2025 mesurait les passes decisives attendues avec le xAG de FBref ; sur
   2025-2026 c'est le xA d'Understat, qui ne compte pas la meme chose. */
const LIB_XA = DATA.libelle_xa || "xAG";

const couleurFamille = (f) => (TEINTES_FAMILLE[f] ? pourTheme(TEINTES_FAMILLE[f]) : null);

/* Les paliers de budget, en millions. Un club raisonne en enveloppe, pas en
   pourcentage du prix de celui qui part : le curseur donne donc des euros. */
const PALIERS_BUDGET = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];
const SANS_LIMITE = PALIERS_BUDGET.length;

const etat = {
  vue: "comparer",
  joueur: null,        // le joueur qu'on cherche a remplacer
  jumeau: null,        // la piste retenue
  pistes: [],
  mode: "familles",    // toile en synthese ou variable par variable
  budget: SANS_LIMITE, // indice dans PALIERS_BUDGET, ou SANS_LIMITE
  niveauMin: 0,        // sur la meme echelle de 0 a 100 que le niveau affiche
  // Un recruteur n'a pas une question, il a une situation. Plutot que d'empiler
  // les curseurs, on lui fait choisir son intention : chacune regle d'un coup le
  // niveau exige, l'age et le sens du tri. Reste deux reglages manuels, le budget
  // et le championnat, les seuls qui dependent vraiment de son club.
  intention: "remplacer",
  // 0 = peu importe, sinon le nombre de mois restants au-dela duquel on ecarte
  contratMax: 0,
  joueurB: null,
  ageMax: 45,
  ligue: "",
};

/* Les quatre situations de recrutement. Chacune tient en une phrase et fixe ses
   propres contraintes : c'est ce qui permet de n'afficher que deux curseurs. */
const INTENTIONS = {
  remplacer: {
    titre: "Remplacer maintenant",
    dit: `Le joueur part, il faut quelqu'un d'opérationnel tout de suite. On écarte
      ceux dont le niveau descend de plus de dix points sous le sien.`,
  },
  succession: {
    titre: "Préparer la succession",
    dit: `On anticipe un départ. On ne garde que les <b>23 ans et moins</b> dont le
      temps de jeu ne recule pas, parce que la bascule est mesurée à 24 ans : avant,
      un joueur gagne des minutes chaque saison, après il en perd. Le niveau actuel
      compte moins que la pente. C'est la seule situation où l'on regarde aussi les
      <b>postes voisins</b>, chacun replacé dans le référentiel du poste à pourvoir :
      un successeur occupe souvent encore un rôle limitrophe. À style égal, celui qui
      tient déjà le poste passe devant, parce qu'une reconversion n'est jamais gratuite.`,
  },
  economie: {
    titre: "Renforcer moins cher",
    dit: `Même rôle, sans perdre en niveau, pour moins cher. On exige un niveau
      au plus cinq points sous le sien et un prix inférieur au sien.`,
  },
  duo: {
    titre: "Comparer deux joueurs",
    dit: `Choisis les deux joueurs à confronter. Ils peuvent occuper des postes
      différents : le second est alors replacé dans le référentiel du premier, ce qui
      répond à la question « peut-il tenir son rôle ? ».`,
  },
};
const enDuo = () => etat.intention === "duo";

/* Le nombre de mois qui restent a courir sur le contrat, ou null si on ne le
   connait pas. C'est la donnee qui separe un profil interessant d'un profil
   accessible : a six mois de la fin, un joueur ne coute plus d'indemnite. */
function moisDeContrat(j) {
  if (!j.cf) return null;
  const fin = new Date(j.cf + "T00:00:00"), maintenant = new Date();
  const m = (fin.getFullYear() - maintenant.getFullYear()) * 12 + (fin.getMonth() - maintenant.getMonth());
  return m < 0 ? 0 : m;
}
/* "juin 2028", plus lisible qu'une date complete pour une echeance. */
const MOIS_COURT = ["janv.", "févr.", "mars", "avril", "mai", "juin",
                    "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function finContrat(j) {
  if (!j.cf) return null;
  const d = new Date(j.cf + "T00:00:00");
  return `${MOIS_COURT[d.getMonth()]} ${d.getFullYear()}`;
}

/* Les postes voisins, ceux vers lesquels un jeune bascule couramment. On les
   ouvre a la seule intention "preparer la succession" : chercher un successeur,
   c'est accepter qu'il occupe aujourd'hui un role limitrophe qu'il quittera. Un
   remplacement immediat, lui, doit rester dans le poste.

   Le pied n'a pas besoin d'etre traite ici : un lateral droit propose pour un
   lateral gauche est deja lourdement penalise par le pied dans le score de
   ressemblance. Le gardien n'a aucun voisin, ses variables sont autres. */
const VOISINS = {
  GB: [],
  DG: ["DD", "AG", "DC"],
  DD: ["DG", "AD", "DC"],
  DC: ["MDC", "DG", "DD"],
  MDC: ["MC", "DC"],
  MC: ["MDC", "MOC"],
  MOC: ["MC", "AG", "AD", "BU"],
  AG: ["AD", "MOC", "BU", "DG"],
  AD: ["AG", "MOC", "BU", "DD"],
  BU: ["MOC", "AG", "AD"],
};

/* Le plafond de prix en euros, ou l'infini quand le curseur est au bout. */
const plafondBudget = () =>
  etat.budget >= SANS_LIMITE ? Infinity : PALIERS_BUDGET[etat.budget] * 1e6;

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

/* ══════════════════════════════════════════════════════════ mise en forme */
function euros(v) {
  if (!v) return "n.c.";
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",") + " M€";
  return Math.round(v / 1e3) + " k€";
}
function eurosCourt(v) {
  if (!v) return "–";
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",") + "M";
  return Math.round(v / 1e3) + "k";
}
const pct = (x) => (x === null || x === undefined ? "–" : Math.round(x));
const nb = (x, d = 2) =>
  (x === null || x === undefined || !isFinite(x)) ? "–" : (+x).toFixed(d).replace(".", ",");
const entier = (x) => (x === null || x === undefined ? "–" : Math.round(x).toLocaleString("fr-FR"));
const echapper = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const normal = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* Un percentile se lit mieux avec un ordinal : 88e, et non 88. */
const ordinal = (p) => (p === null || p === undefined ? "–" : Math.round(p) + "e");

/* ══════════════════════════════════════════════════════════════ images */
/* Deux facons de servir les images. Le site heberge appelle le CDN de
   Transfermarkt. La version publiee en artefact ne le peut pas, sa politique de
   securite refuse toute image externe : le constructeur y injecte alors un objet
   IMAGES contenant les memes images en base64, et c'est lui qui prime. */
const P = DATA.prefixes || {};
const EMBARQUEES = (typeof IMAGES !== "undefined") ? IMAGES : null;
const portraitDe = (j) =>
  (EMBARQUEES && EMBARQUEES.p[j.id]) || (j.ph ? (P.portrait || "") + j.ph : "");
const drapeauDe = (j) =>
  (EMBARQUEES && EMBARQUEES.d[j.fl]) || (j.fl ? (P.drapeau || "") + j.fl + ".png" : "");
const logoDe = (j) =>
  (EMBARQUEES && EMBARQUEES.c[j.ci]) || (j.ci ? (P.logo || "") + j.ci + ".png" : "");

function initiales(nom) {
  const mots = String(nom).split(/[\s-]+/).filter(Boolean);
  return ((mots[0] || "")[0] + (mots[mots.length - 1] || "")[0] || "?").toUpperCase();
}
/* Teinte stable par club : deux joueurs du meme club ont le meme fond de fiche. */
function teinteDe(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
/* Une image qui ne charge pas laisse la place aux initiales, jamais a un trou.
   Le remplacement passe par un seul ecouteur pose sur le document plutot que par
   un attribut onerror : les gestionnaires en ligne sont refuses par la politique
   de securite de certains hebergeurs, et l'image resterait alors cassee. */
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!img || img.tagName !== "IMG") return;
  if (img.dataset.retirer) { img.remove(); return; }
  const ini = img.dataset.initiales;
  if (!ini) return;
  const remplacant = document.createElement("span");
  remplacant.className = img.className + " initiales";
  remplacant.textContent = ini;
  if (img.style.width) { remplacant.style.width = img.style.width;
                         remplacant.style.height = img.style.height; }
  img.replaceWith(remplacant);
}, true);

function imgJoueur(j, classe, taille, avide) {
  const src = portraitDe(j);
  const ini = initiales(j.n);
  const style = taille ? ` style="width:${taille}px;height:${taille}px"` : "";
  if (!src) return `<span class="${classe} initiales"${style}>${ini}</span>`;
  /* Le chargement differe fait gagner du temps sur les vignettes d'une liste,
     qui viennent du reseau et sont nombreuses. Il n'a que des inconvenients
     ailleurs : le portrait de la fiche est toujours en haut de page et doit
     partir tout de suite, et une image deja embarquee dans la page n'a rien a
     aller chercher. Pire, dans un cadre encore sans hauteur, aucune image n'est
     jugee visible, donc aucune ne s'affiche jamais. */
  const differe = (avide || src.startsWith("data:")) ? "" : ' loading="lazy"';
  return `<img class="${classe}" src="${src}" alt=""${differe}${style}
    data-initiales="${ini}">`;
}

/* ═══════════════════════════════════════════════ populations et vecteurs */
const parPoste = {};
DATA.joueurs.forEach((j) => (parPoste[j.p] = parPoste[j.p] || []).push(j));
const parNom = {};
DATA.joueurs.forEach((j) => (parNom[j.n] = j));

const metaVars = (poste) => DATA.variables[poste === "GB" ? "gardien" : "champ"];
const metaDesc = (poste) => DATA.descriptives[poste === "GB" ? "gardien" : "champ"];
/* Les familles jugees a ce poste, dans l'ordre ou les variables les rencontrent.
   Une famille absente des poids n'est pas jugee : elle ne figure ni sur la toile
   ni dans le calcul de ressemblance. */
/* Les variables jugees a ce poste, avec leur position d'origine dans la liste :
   l'indice sert a retrouver la bonne valeur dans le vecteur de percentiles, qui
   lui reste complet. */
const varsJugees = (poste) => {
  const w = poidsDe(poste);
  return metaVars(poste).map((m, i) => ({ ...m, i })).filter((m) => w[m.i] > 0);
};

const famillesDe = (poste) => {
  const w = poidsDe(poste), meta = metaVars(poste);
  return [...new Set(meta.filter((m, i) => w[i] > 0).map((m) => m.famille))];
};

/* Toutes les variables d'un joueur, comparaison et fiche confondues, dans l'ordre
   d'affichage des familles. Sert aux tableaux de la fiche. */
function toutesLesVariables(j) {
  const out = [];
  metaVars(j.p).forEach((m, i) =>
    out.push({ ...m, valeur: j.r[i], percentile: j.x[i], comparaison: true }));
  metaDesc(j.p).forEach((m, i) =>
    out.push({ ...m, valeur: j.rd ? j.rd[i] : null, percentile: j.xd ? j.xd[i] : null,
               comparaison: false }));
  const rang = (f) => {
    const k = (DATA.familles_ordre || []).indexOf(f);
    return k < 0 ? 99 : k;
  };
  return out.sort((x, y) => rang(x.famille) - rang(y.famille));
}

/* Lire une variable par son nom, sans savoir dans quel tableau elle est rangee. */
function valeurDe(j, cle) {
  let i = metaVars(j.p).findIndex((m) => m.cle === cle);
  if (i >= 0) return j.r[i];
  i = metaDesc(j.p).findIndex((m) => m.cle === cle);
  return i >= 0 && j.rd ? j.rd[i] : null;
}
function percentileDe(j, cle) {
  let i = metaVars(j.p).findIndex((m) => m.cle === cle);
  if (i >= 0) return j.x[i];
  i = metaDesc(j.p).findIndex((m) => m.cle === cle);
  return i >= 0 && j.xd ? j.xd[i] : null;
}

/* Un joueur d'un autre poste doit etre juge sur la meme population que le joueur
   analyse, sinon les percentiles ne mesurent pas la meme chose. */
const cacheDistributions = {};
function distributions(poste) {
  if (cacheDistributions[poste]) return cacheDistributions[poste];
  const groupe = parPoste[poste] || [];
  return (cacheDistributions[poste] = metaVars(poste).map((m, i) =>
    groupe.map((j) => j.r[i]).filter((v) => v !== null && v !== undefined)
          .sort((x, y) => x - y)));
}
function bornes(tab, v) {
  let bas = 0, haut = tab.length;
  while (bas < haut) { const m = (bas + haut) >> 1; tab[m] < v ? (bas = m + 1) : (haut = m); }
  const inf = bas;
  haut = tab.length;
  while (bas < haut) { const m = (bas + haut) >> 1; tab[m] <= v ? (bas = m + 1) : (haut = m); }
  return { inf, eq: bas - inf };
}
function vecteurDans(joueur, poste) {
  if (joueur.p === poste) return joueur.x;
  const dist = distributions(poste);
  return metaVars(poste).map((m, i) => {
    const v = joueur.r[i];
    if (v === null || v === undefined || !dist[i].length) return null;
    const { inf, eq } = bornes(dist[i], v);
    const p = (100 * (inf + eq / 2)) / dist[i].length;
    return Math.round((m.inverse ? 100 - p : p) * 10) / 10;
  });
}

/* ═══════════════════════════════════════════════════ moteur de ressemblance */
/* Deux joueurs se ressemblent quand ils FONT la meme chose, pas quand ils la
   font aussi bien. Comparer les percentiles bruts revient a classer par niveau :
   un espoir de dix-huit ans ne peut alors jamais ressembler a un international
   confirme, meme avec exactement le meme jeu, parce que tous ses percentiles
   sont plus bas. On compare donc la FORME du profil, chaque vecteur ramene a sa
   propre moyenne, ce qui ne garde que ce que le joueur privilegie.

   Le style ne fait pas tout : un meneur d'1,70m et un relayeur d'1,93m ne se
   remplacent pas, et un joueur de trente-quatre ans n'est pas la piste d'un club
   qui cherche un espoir. Le gabarit, l'age et le pied entrent donc dans le
   calcul, derriere le style qui reste l'essentiel. */
const POIDS_RESSEMBLANCE = { style: 0.74, taille: 0.11, age: 0.10, pied: 0.05 };

/* Le poids de chaque variable a ce poste. Zero veut dire qu'on ne juge pas ce
   poste la-dessus : ni la toile, ni la ressemblance, ni les notes de famille ne
   la prennent en compte. Le jeu de donnees 2024-2025, plus ancien, ne porte que
   des poids par famille : on les etale alors sur ses variables. */
const poidsDe = (poste) => (DATA.poids_var && DATA.poids_var[poste])
  || metaVars(poste).map((m) => DATA.poids[poste][m.famille] || 0);

/* En dessous de ce volume de jeu, les percentiles ne mesurent plus un style mais
   le hasard de quelques ballons. Ces joueurs gardent leur fiche, mais ne sont
   jamais proposes comme profil proche de quelqu'un. */
const MINUTES_COMPARABLE = DATA.seuil_reference || 450;

/* La taille en centimetres, depuis le "1,78m" de Transfermarkt. */
function tailleCm(j) {
  const m = /^(\d)[,.](\d{2})/.exec(j.t || "");
  return m ? +m[1] * 100 + +m[2] : null;
}

/* Le niveau general du joueur : la moyenne ponderee de son profil. C'est ce
   qu'on retire de chaque vecteur pour n'en garder que la forme. */
/* Une variable inconnue est ecartee du calcul, elle ne vaut pas la mediane.
   La difference compte des qu'un joueur vient d'un championnat moins documente :
   lui preter cinquante partout reviendrait a inventer un profil moyen. */
function moyennePonderee(v, poids) {
  let s = 0, w = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === null || v[i] === undefined) continue;
    s += poids[i] * v[i];
    w += poids[i];
  }
  return w ? s / w : 50;
}

/* Distance de style : l'ecart entre deux profils une fois chacun ramene a sa
   propre moyenne. Zero veut dire deux joueurs qui repartissent leur jeu de la
   meme facon, quel que soit leur niveau. */
function distanceStyle(va, vb, poids) {
  const ma = moyennePonderee(va, poids), mb = moyennePonderee(vb, poids);
  let s = 0, w = 0;
  for (let i = 0; i < va.length; i++) {
    // on ne compare que ce que les deux joueurs ont en commun
    if (va[i] === null || va[i] === undefined) continue;
    if (vb[i] === null || vb[i] === undefined) continue;
    const d = (va[i] - ma) - (vb[i] - mb);
    s += poids[i] * d * d;
    w += poids[i];
  }
  // sans une seule variable partagee, il n'y a pas de comparaison a faire
  return w ? Math.sqrt(s / w) : 100;
}

/* Gabarit, age et pied, ramenes sur la meme echelle de 0 a 100 que la distance
   de style pour pouvoir se melanger. Une donnee manquante vaut une penalite
   moyenne : ni recompense ni exclusion. */
function penaliteTaille(a, b) {
  const ta = tailleCm(a), tb = tailleCm(b);
  return ta && tb ? Math.min(Math.abs(ta - tb) * 5, 100) : 30;
}
function penaliteAge(a, b) {
  return a.a != null && b.a != null ? Math.min(Math.abs(a.a - b.a) * 6, 100) : 30;
}
function penalitePied(a, b) {
  if (!a.pi || !b.pi) return 20;
  return a.pi === b.pi ? 0 : 45;
}

/* Le score affiche partout : 100 pour un jumeau parfait. */
/* vecteurB permet de comparer un joueur d'un autre poste : on lui passe alors son
   profil replace dans le referentiel de a, sinon on lit le sien tel quel. */
function ressemblance(a, b, poids, vecteurB) {
  const P = POIDS_RESSEMBLANCE;
  return 100 - (P.style * distanceStyle(a.x, vecteurB || b.x, poids)
              + P.taille * penaliteTaille(a, b)
              + P.age * penaliteAge(a, b)
              + P.pied * penalitePied(a, b));
}

/* Les joueurs les plus ressemblants, sans condition de prix. Sert a la fiche. */
function plusProches(cible, combien = 6) {
  const poids = poidsDe(cible.p);
  return (parPoste[cible.p] || [])
    .filter((j) => j !== cible && j.m >= MINUTES_COMPARABLE && !j.dp)
    .map((j) => ({ j, score: ressemblance(cible, j, poids) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, combien);
}

/* Les familles qu'on ne sait pas renseigner pour ce joueur : aucune de leurs
   variables jugees ne porte de valeur. C'est le cas d'un joueur venu d'un
   championnat que les sources du projet ne couvrent pas. */
function famillesAbsentes(j) {
  const w = poidsDe(j.p), meta = metaVars(j.p), vu = {};
  meta.forEach((m, i) => {
    if (w[i] <= 0) return;
    if (!(m.famille in vu)) vu[m.famille] = false;
    if (j.x[i] !== null && j.x[i] !== undefined) vu[m.famille] = true;
  });
  return Object.keys(vu).filter((f) => !vu[f]);
}

/* Moyenne des percentiles d'une famille : la note de synthese du radar. */
function noteFamille(joueur, famille, vecteur) {
  const meta = metaVars(joueur.p), v = vecteur || joueur.x, w = poidsDe(joueur.p);
  // seules les variables jugees a ce poste entrent dans la note de la famille
  const vals = meta.map((m, i) => (m.famille === famille && w[i] > 0 ? v[i] : null))
                   .filter((x) => x !== null && x !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
}
function notesFamilles(joueur, vecteur) {
  return famillesDe(joueur.p)
    .map((f) => ({ famille: f, note: noteFamille(joueur, f, vecteur) }));
}

/* ══════════════════════════════════════════════════════════ outils SVG */
const NS = "http://www.w3.org/2000/svg";
function svgEl(parent, tag, attrs, texte) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined)
    e.setAttribute(k, attrs[k]);
  if (texte !== undefined) e.textContent = texte;
  if (parent) parent.appendChild(e);
  return e;
}
function titreSvg(e, texte) {
  svgEl(e, "title", {}, texte);
  return e;
}
/* Interpolation dans l'echelle de chaleur, pour les cartes de terrain. */
function couleurChaleur(t) {
  t = Math.max(0, Math.min(1, t));
  const i = Math.min(chaleur().length - 2, Math.floor(t * (chaleur().length - 1)));
  const f = t * (chaleur().length - 1) - i;
  const lire = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const a = lire(chaleur()[i]), b = lire(chaleur()[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}

/* ══════════════════════════════════════════════════════════ infobulle */
const bulle = $("#infobulle");
function montrerBulle(evt, html) {
  bulle.innerHTML = html;
  bulle.classList.add("on");
  const m = 14;
  let x = evt.clientX + m, y = evt.clientY + m;
  const r = bulle.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - m;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - m;
  bulle.style.left = x + "px";
  bulle.style.top = y + "px";
}
const cacherBulle = () => bulle.classList.remove("on");
/* Un seul point d'accroche : tout element portant data-bulle declenche l'infobulle. */
document.addEventListener("mousemove", (e) => {
  const cible = e.target.closest ? e.target.closest("[data-bulle]") : null;
  if (cible) montrerBulle(e, cible.dataset.bulle);
  else cacherBulle();
});
document.addEventListener("mouseleave", cacherBulle);

/* ═══════════════════════════════════════════ animations d'entree */
const doux = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Les blocs montent quand ils entrent dans l'ecran : on voit ou on en est dans
   une page longue, sans que ca gene la lecture. */
const observateur = doux ? null : new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("vu"); observateur.unobserve(e.target); }
  });
}, { rootMargin: "0px 0px -40px 0px", threshold: 0.04 });

function animerEntree(racine) {
  const blocs = $$(".monte", racine);
  const montrer = () => blocs.forEach((e) => e.classList.add("vu"));
  if (!observateur) { montrer(); return; }
  blocs.forEach((e, i) => {
    e.style.transitionDelay = Math.min(i * 45, 320) + "ms";
    observateur.observe(e);
  });
  /* Filet de securite. Dans un cadre dont la hauteur vaut zero au chargement,
     comme celui d'un artefact avant son dimensionnement, l'observateur ne se
     declenche jamais : la page resterait entierement invisible. On revele tout
     au bout d'une seconde et demie, quoi qu'il arrive. */
  setTimeout(montrer, 1500);
}

/* Les barres partent de zero : la largeur finale est posee au tour suivant pour
   que le navigateur ait le temps de voir la transition. */
function lancerBarres(racine) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$("[data-largeur]", racine).forEach((e) => { e.style.width = e.dataset.largeur; });
  }));
}

/* Les grands nombres montent depuis zero, comme un compteur. */
function compter(el, valeur, format, duree) {
  if (doux) { el.textContent = format(valeur); return; }
  const t0 = performance.now(), d = duree || 750;
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / d);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(valeur * e);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}
function lancerCompteurs(racine) {
  $$("[data-compte]", racine).forEach((e) => {
    const v = parseFloat(e.dataset.compte);
    const type = e.dataset.format || "entier";
    const f = type === "euros" ? euros
      : type === "un" ? ((x) => nb(x, 1))
      : type === "deux" ? ((x) => nb(x, 2))
      : entier;
    compter(e, v, f);
  });
}

/* ══════════════════════════════════════════════════════════ navigation */
function ouvrir(vue, joueur) {
  if (joueur) etat.joueur = joueur;
  etat.vue = vue;
  $$(".onglets button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.vue === vue)));
  ["fiche", "comparer", "explorer"].forEach((v) => { $("#vue-" + v).hidden = v !== vue; });
  if (vue === "fiche") dessinerFiche();
  if (vue === "comparer") dessinerComparer();
  if (vue === "explorer") dessinerExplorer();
  const cible = etat.joueur ? "#" + vue + "/" + encodeURIComponent(etat.joueur.n) : "#" + vue;
  if (location.hash !== cible) history.replaceState(null, "", cible);
  scrollTo({ top: 0, behavior: doux ? "auto" : "smooth" });
}
/* ══════════════════════════════════════════════════════════════════ le theme */
/* Clair par defaut : la page se lit surtout de jour et le fond sombre d'origine
   noyait toutes les cartes dans la meme teinte. Le sombre reste a un clic.
   Changer de theme ne recharge rien : on vide le cache de couleurs et on
   redessine la vue courante, les graphiques relisent alors la nouvelle palette. */
function appliquerTheme(nom) {
  const sombre = nom === "sombre";
  document.documentElement.dataset.theme = sombre ? "sombre" : "clair";
  const b = $("#bascule-theme");
  if (b) {
    b.setAttribute("aria-pressed", String(sombre));
    b.textContent = sombre ? "☀" : "☾";
    const t = sombre ? "Passer au thème clair" : "Passer au thème sombre";
    b.title = t; b.setAttribute("aria-label", t);
  }
  oublierCouleurs();
  try { localStorage.setItem("radar-theme", nom); } catch (e) { /* navigation privée */ }
}

function basculerTheme() {
  const y = window.scrollY;
  document.body.classList.add("vire");
  appliquerTheme(themeSombre() ? "clair" : "sombre");
  ouvrir(etat.vue);
  scrollTo({ top: y, behavior: "auto" });
  setTimeout(() => document.body.classList.remove("vire"), 420);
}

/* Cliquer un joueur, d'ou qu'on vienne, revient a le placer au depart de la
   comparaison : c'est devenu la seule question que pose cet outil. */
function voirJoueur(nom) {
  const j = parNom[nom];
  if (!j) return;
  etat.jumeau = null;
  ouvrir("comparer", j);
}

function lireAdresse() {
  const m = decodeURIComponent(location.hash.slice(1)).split("/");
  const vue = ["comparer", "explorer", "fiche"].includes(m[0]) ? m[0] : "comparer";
  const j = m[1] ? parNom[m[1]] : null;
  return { vue, j };
}

/* ══════════════════════════════════════════════════════════ recherche */
const index = DATA.joueurs.map((j) => ({ j, k: normal(j.n + " " + j.c + " " + j.l) }));
let resultats = [], surligne = -1;

function montrerSuggestions(q) {
  const liste = $("#suggestions"), champ = $("#recherche");
  if (!q) {
    liste.hidden = true; liste.innerHTML = ""; resultats = []; surligne = -1;
    champ.setAttribute("aria-expanded", "false");
    return;
  }
  const n = normal(q);
  // les joueurs qui commencent par la saisie remontent avant ceux qui la contiennent
  const debut = [], dedans = [];
  for (const x of index) {
    if (x.k.startsWith(n)) debut.push(x);
    else if (x.k.includes(n)) dedans.push(x);
    if (debut.length >= 12) break;
  }
  resultats = debut.concat(dedans).slice(0, 12);
  surligne = resultats.length ? 0 : -1;
  liste.hidden = !resultats.length;
  champ.setAttribute("aria-expanded", String(!!resultats.length));
  liste.innerHTML = resultats.map(({ j }, i) => `
    <li role="option" data-i="${i}" aria-selected="${i === surligne}">
      ${imgJoueur(j, "", 26)}
      <span class="sug-txt"><b>${echapper(j.n)}</b>
        <em>${DATA.postes_libelle[j.p]} · ${echapper(j.c)}</em></span>
      <span class="sug-val">${euros(j.v)}</span>
    </li>`).join("");
  $$("li", liste).forEach((li) =>
    li.addEventListener("mousedown", (e) => { e.preventDefault(); choisir(+li.dataset.i); }));
}

function choisir(i) {
  if (i < 0 || !resultats[i]) return;
  const j = resultats[i].j;
  $("#recherche").value = "";
  montrerSuggestions("");
  $("#recherche").blur();
  etat.jumeau = null;
  ouvrir(etat.vue === "explorer" ? "comparer" : etat.vue, j);
}

function initRecherche() {
  const champ = $("#recherche"), liste = $("#suggestions");
  champ.addEventListener("input", () => montrerSuggestions(champ.value.trim()));
  champ.addEventListener("focus", () => montrerSuggestions(champ.value.trim()));
  champ.addEventListener("blur", () => setTimeout(() => montrerSuggestions(""), 160));
  champ.addEventListener("keydown", (e) => {
    if (!resultats.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      surligne = (surligne + (e.key === "ArrowDown" ? 1 : -1) + resultats.length) % resultats.length;
      $$("li", liste).forEach((li, i) => li.setAttribute("aria-selected", String(i === surligne)));
      liste.children[surligne]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); choisir(surligne); }
    else if (e.key === "Escape") { montrerSuggestions(""); champ.blur(); }
  });
  // la barre de recherche est le point d'entree : on y accede au clavier depuis partout
  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== champ) { e.preventDefault(); champ.focus(); }
  });
}

/* ══════════════════════════════════════════════════════════════ demarrage */
function init() {
  $("#compteur").textContent =
    `${DATA.joueurs.length} joueurs · saison ${DATA.saison}`;
  document.title = "Comparateur Player";
  // le bas de page decrit les sources, qui ne sont pas les memes d'une saison a
  // l'autre : c'est le jeu de donnees qui porte son propre texte
  const bas = document.querySelector("footer");
  if (bas && DATA.notes) bas.innerHTML = DATA.notes;
  initRecherche();
  $$(".onglets button").forEach((b) =>
    b.addEventListener("click", () => ouvrir(b.dataset.vue)));

  // le theme est applique avant le premier dessin, sinon les graphiques
  // naitraient avec la palette claire puis changeraient sous les yeux
  let choisi = "clair";
  try { choisi = localStorage.getItem("radar-theme") || "clair"; } catch (e) { /* rien */ }
  appliquerTheme(choisi);
  $("#bascule-theme").addEventListener("click", basculerTheme);

  const { vue, j } = lireAdresse();
  // sans joueur choisi, on ouvre le plus cher : une fiche vide serait une mauvaise
  // premiere impression, et le joueur le plus cher est celui qu'on cherche le plus
  etat.joueur = j || DATA.joueurs.slice()
    .sort((a, b) => (b.v || 0) - (a.v || 0) || b.m - a.m)[0];
  ouvrir(vue);
}
// les vues sont definies dans les fichiers charges apres celui-ci : on attend que
// le document soit pret pour que dessinerFiche et ses voisines existent
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init);
else init();
