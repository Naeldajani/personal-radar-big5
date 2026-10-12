/* Radar Big 5 — la fiche d'un joueur.
   Tout ce qu'on regarde avant d'acheter : l'identite, les cartes de terrain,
   la toile de percentiles, le detail de toutes les variables, la saison match
   par match, et les profils les plus proches. */

/* ══════════════════════════════════════════════════ geometrie du terrain */
/* Un terrain fait 68 metres sur 105. Les reperes ci-dessous sont exprimes en
   fraction de ces dimensions, ce qui permet de dessiner a n'importe quelle taille. */
const TERRAIN = {
  surface_prof: 16.5 / 105, surface_larg: 40.32 / 68,
  six_prof: 5.5 / 105, six_larg: 18.32 / 68,
  point_pen: 11 / 105, rond: 9.15 / 68, but_larg: 7.32 / 68,
};

/* Dessine les lignes et rend les convertisseurs de coordonnees.
   x va de 0 (aile gauche) a 1 (aile droite), y de 0 (sa cage) a 1 (la cage adverse). */
function dessinerTerrain(svg, larg, haut, y0, y1, fond) {
  y0 = y0 ?? 0; y1 = y1 ?? 1;
  fond = fond !== false;
  const pad = 8;
  const W = larg - 2 * pad, H = haut - 2 * pad;
  const X = (x) => pad + x * W;
  const Y = (y) => pad + (1 - (y - y0) / (y1 - y0)) * H;
  const L = (a) => ({ fill: "none", stroke: C("terrain-trait"), "stroke-width": 1.1, ...a });

  if (svg.tagName === "svg") svg.setAttribute("viewBox", `0 0 ${larg} ${haut}`);
  if (fond) svgEl(svg, "rect", { x: 0, y: 0, width: larg, height: haut, rx: 10, fill: C("terrain-fond") });
  svgEl(svg, "rect", L({ x: X(0), y: Y(y1), width: W, height: H, rx: 2 }));

  const T = TERRAIN;
  // les deux surfaces, dessinees seulement si elles entrent dans la fenetre demandee
  [[0, 1], [1, -1]].forEach(([base, sens]) => {
    const yS = base + sens * T.surface_prof, y6 = base + sens * T.six_prof;
    if (Math.max(base, yS) < y0 || Math.min(base, yS) > y1) return;
    svgEl(svg, "rect", L({
      x: X(0.5 - T.surface_larg / 2), y: Y(Math.max(base, yS)),
      width: W * T.surface_larg, height: Math.abs(Y(yS) - Y(base)) }));
    svgEl(svg, "rect", L({
      x: X(0.5 - T.six_larg / 2), y: Y(Math.max(base, y6)),
      width: W * T.six_larg, height: Math.abs(Y(y6) - Y(base)) }));
    svgEl(svg, "circle", { cx: X(0.5), cy: Y(base + sens * T.point_pen), r: 1.8,
                           fill: C("terrain-trait") });
    svgEl(svg, "line", L({ x1: X(0.5 - T.but_larg / 2), y1: Y(base),
                           x2: X(0.5 + T.but_larg / 2), y2: Y(base),
                           "stroke-width": 2.6, stroke: C("terrain-trait2") }));
  });
  if (y0 < 0.5 && y1 > 0.5) {
    svgEl(svg, "line", L({ x1: X(0), y1: Y(0.5), x2: X(1), y2: Y(0.5) }));
    svgEl(svg, "ellipse", L({ cx: X(0.5), cy: Y(0.5),
                             rx: W * T.rond, ry: Math.abs(Y(0.5 + T.rond * 68 / 105) - Y(0.5)) }));
  }
  return { X, Y, W, H, pad };
}

/* ═══════════════════════════════════════════════ carte des postes occupes */
/* Reprend la logique de l'encart de Transfermarkt : une grille de postes sur un
   terrain, celui ou le joueur a le plus joue mis en avant. La difference est
   qu'ici chaque case porte de vraies minutes, celles relevees par Understat. */
function dessinerCartePostes(svg, joueur, fiche) {
  svg.innerHTML = "";
  const g = dessinerTerrain(svg, 300, 420);
  const postes = (fiche && fiche.postes) || {};
  const declares = joueur.pd_tm || [];
  const utiles = Object.entries(postes).filter(([p]) => p !== "Sub" && DATA.postes_understat[p]);
  const total = utiles.reduce((s, [, v]) => s + v.min, 0) || 1;
  const maxi = Math.max(...utiles.map(([, v]) => v.min), 1);

  const lg = 46, ht = 26;
  Object.entries(DATA.postes_understat).forEach(([code, pos]) => {
    if (code === "Sub") return;
    const v = postes[code];
    const part = v ? v.min / maxi : 0;
    const x = g.X(pos.x) - lg / 2, y = g.Y(pos.y) - ht / 2;
    const principal = v && v.min === maxi;
    const declare = declares.includes(code);
    const r = svgEl(svg, "rect", {
      x, y, width: lg, height: ht, rx: 6,
      fill: v ? C("a") : C("case-vide"),
      "fill-opacity": v ? (0.22 + 0.62 * part) : 0.28,
      // un poste declare par Transfermarkt mais jamais joue reste visible, en pointilles
      stroke: v ? C("a") : declare ? C("b") : C("case-vide-bord"),
      "stroke-dasharray": !v && declare ? "3 3" : null,
      "stroke-width": principal ? 1.8 : 1,
      "stroke-opacity": v ? 0.9 : declare ? 0.85 : 0.6,
    });
    if (!v && declare) {
      r.style.cursor = "help";
      r.dataset.bulle = `<b>${pos.libelle}</b><br><span>Poste déclaré sur Transfermarkt,` +
        ` mais aucune minute relevée à ce poste en ${SAISON}.</span>`;
    }
    if (v) {
      r.style.cursor = "help";
      r.dataset.bulle = `<b>${pos.libelle}</b><br><span>${v.min} minutes sur ${
        total} · ${v.matchs} matchs<br>${v.buts} but${v.buts > 1 ? "s" : ""}, ${
        v.pd} passe${v.pd > 1 ? "s" : ""} décisive${v.pd > 1 ? "s" : ""}<br>${
        nb(v.xg, 2)} xG · ${nb(v.xa, 2)} xA</span>`;
    }
    // la case porte l'abréviation française, celle de FIFA, et non le code anglais
    // d'Understat qui sert de clé : AVG se lit, FWL non
    svgEl(svg, "text", {
      x: g.X(pos.x), y: g.Y(pos.y) + 1, "text-anchor": "middle", "dominant-baseline": "middle",
      fill: v ? C("sur-accent") : C("svg-eteint"), "font-size": 10.5,
      "font-weight": principal ? 700 : 500, "pointer-events": "none",
    }, pos.court || code);
    if (v) svgEl(svg, "text", {
      x: g.X(pos.x), y: g.Y(pos.y) + ht / 2 + 9, "text-anchor": "middle",
      fill: C("svg-faible"), "font-size": 8.5, "pointer-events": "none",
    }, v.min + "′");
  });
  return { utiles, total, remplacant: postes.Sub || null };
}

/* ═══════════════════════════════════════════════════ carte d'occupation */
/* Deux sources se completent ici, et il faut savoir laquelle fait quoi.
   La hauteur sur le terrain vient des touches de balle par tiers relevees par
   FBref : c'est une mesure, pas une estimation. La repartition gauche-droite
   vient des postes occupes, minutes a l'appui. On ne dispose d'aucune donnee
   d'evenements gratuite pour cette saison, donc pas de vraie carte de chaleur :
   celle-ci est une reconstitution, et le texte sous la carte le dit. */
function dessinerCarteZone(svg, joueur, fiche) {
  svg.innerHTML = "";
  const g = dessinerTerrain(svg, 300, 420);

  const meta = metaDesc(joueur.p);
  const val = (cle) => {
    const i = meta.findIndex((m) => m.cle === cle);
    return i < 0 || !joueur.rd ? 0 : (joueur.rd[i] || 0);
  };
  // cinq bandes, de sa propre surface a celle d'en face
  const surfDef = val("touches_surface_def_90");
  const tiersDef = Math.max(val("touches_tiers_def_90") - surfDef, 0);
  const tiersMed = val("touches_tiers_med_90");
  const iSurfOff = metaVars(joueur.p).findIndex((m) => m.cle === "touches_surface_off_90");
  const surfOff = iSurfOff >= 0 ? (joueur.r[iSurfOff] || 0) : 0;
  const tiersOff = Math.max(val("touches_tiers_att_90") - surfOff, 0);

  const bandes = [
    { y0: 0, y1: TERRAIN.surface_prof, poids: surfDef, nom: "sa surface" },
    { y0: TERRAIN.surface_prof, y1: 1 / 3, poids: tiersDef, nom: "tiers défensif" },
    { y0: 1 / 3, y1: 2 / 3, poids: tiersMed, nom: "tiers médian" },
    { y0: 2 / 3, y1: 1 - TERRAIN.surface_prof, poids: tiersOff, nom: "tiers offensif" },
    { y0: 1 - TERRAIN.surface_prof, y1: 1, poids: surfOff, nom: "surface adverse" },
  ];
  const somme = bandes.reduce((s, b) => s + b.poids, 0);
  if (!somme) {
    svgEl(svg, "text", { x: 150, y: 210, "text-anchor": "middle", fill: C("svg-faible"),
      "font-size": 12 }, "répartition des touches indisponible");
    return null;
  }
  // densite par unite de hauteur : une bande courte tres frequentee doit ressortir
  bandes.forEach((b) => { b.densite = (b.poids / somme) / (b.y1 - b.y0); });
  const densiteEn = (y) => (bandes.find((b) => y >= b.y0 && y <= b.y1) || bandes[2]).densite;

  const postes = (fiche && fiche.postes) || {};
  let ancres = Object.entries(postes)
    .filter(([p]) => p !== "Sub" && DATA.postes_understat[p])
    .map(([p, v]) => ({ ...DATA.postes_understat[p], w: v.min }));
  if (!ancres.length) {                     // sans Understat, on retombe sur le poste principal
    const c = { G: "GK", DG: "DL", DC: "DC", DD: "DR", MDC: "DMC", MC: "MC",
                MOC: "AMC", AG: "AML", AD: "AMR", BU: "FW" }[joueur.p];
    ancres = [{ ...DATA.postes_understat[c], w: 1 }];
  }
  const sx = 0.17, sy = 0.15;
  const lateral = (x, y) => ancres.reduce((s, a) =>
    s + a.w * Math.exp(-((x - a.x) ** 2) / (2 * sx * sx) - ((y - a.y) ** 2) / (2 * sy * sy)), 0);

  const cols = 14, lignes = 22;
  const grille = [];
  let maxi = 0;
  for (let r = 0; r < lignes; r++) {
    const y = (r + 0.5) / lignes;
    const brut = [];
    for (let c = 0; c < cols; c++) brut.push(lateral((c + 0.5) / cols, y) + 1e-6);
    const sLigne = brut.reduce((a, b) => a + b, 0);
    const d = densiteEn(y);
    const ligne = brut.map((v) => (v / sLigne) * d);
    maxi = Math.max(maxi, ...ligne);
    grille.push(ligne);
  }

  const idf = "flou-" + Math.random().toString(36).slice(2, 8);
  const defs = svgEl(svg, "defs", {});
  const filtre = svgEl(defs, "filter", { id: idf, x: "-20%", y: "-20%",
                                         width: "140%", height: "140%" });
  svgEl(filtre, "feGaussianBlur", { stdDeviation: 9 });
  const groupe = svgEl(svg, "g", { filter: `url(#${idf})`, opacity: 0.88 });

  const cw = g.W / cols, ch = g.H / lignes;
  for (let r = 0; r < lignes; r++) for (let c = 0; c < cols; c++) {
    const t = grille[r][c] / maxi;
    if (t < 0.06) continue;
    svgEl(groupe, "rect", {
      x: g.pad + c * cw, y: g.pad + (lignes - 1 - r) * ch, width: cw + 1, height: ch + 1,
      fill: couleurChaleur(t), "fill-opacity": Math.min(1, 0.25 + t * 0.85),
    });
  }
  // les lignes du terrain repassent par-dessus la chaleur, sinon on ne les voit plus
  dessinerTerrain(svgEl(svg, "g", {}), 300, 420, 0, 1, false);

  bandes.forEach((b) => {
    const part = Math.round(100 * b.poids / somme);
    if (part < 1) return;
    svgEl(svg, "text", {
      x: 300 - 12, y: g.Y((b.y0 + b.y1) / 2) + 3, "text-anchor": "end",
      fill: C("svg-fort"), "font-size": 10, "font-weight": 600,
    }, part + " %");
  });
  return bandes.map((b) => ({ nom: b.nom, part: b.poids / somme }));
}

/* ═════════════════════════════════════════════════════════ carte des tirs */
const LIB_SITUATION = { J: "Jeu courant", C: "Corner", A: "Coup de pied arrêté",
                        F: "Coup franc direct", P: "Pénalty" };
const LIB_PIED = { D: "Pied droit", G: "Pied gauche", T: "Tête", X: "Autre" };
const LIB_RESULTAT = { B: "But", A: "Arrêté", R: "Raté", C: "Contré",
                       P: "Sur le poteau", O: "Contre son camp" };

function filtrerTirs(fiche, f) {
  return (fiche.tirs || []).filter((t) =>
    (!f.situation || t[4] === f.situation) &&
    (!f.pied || t[5] === f.pied) &&
    (!f.resultat || (f.resultat === "B" ? t[3] === "B" : t[3] !== "B")));
}

/* Un but se marque d'un ballon, a la taille du xG. L'emoji du systeme est plus
   propre que tout ce qu'on dessinerait a cette echelle, et il reste net quel que
   soit le zoom. En dessous de treize pixels il n'est plus qu'une tache : les buts
   partis de tres loin recoivent donc un plancher de taille. */
function ballon(parent, cx, cy, r) {
  const taille = Math.max(2.2 * r, 13);
  return svgEl(parent, "text", {
    x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central",
    "font-size": taille, "font-family": '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif',
  }, "⚽");
}

function dessinerCarteTirs(svg, tirs) {
  svg.innerHTML = "";
  const g = dessinerTerrain(svg, 360, 330, 0.47, 1.005);
  if (!tirs.length) {
    svgEl(svg, "text", { x: 180, y: 170, "text-anchor": "middle", fill: C("svg-faible"),
                         "font-size": 12 }, "aucun tir avec ce filtre");
    return;
  }
  // les buts se dessinent en dernier pour rester lisibles au-dessus de la masse
  const ordre = tirs.slice().sort((a, b) => (a[3] === "B") - (b[3] === "B"));
  ordre.forEach((t, i) => {
    const [X, Y, xg, res, sit, pied, minute, adv] = t;
    const but = res === "B";
    // des marques discretes : un buteur prend plus de cent tirs dans la saison, et
    // de gros cercles finissent par se recouvrir au point de cacher la zone de frappe
    const r = 1.7 + 8 * Math.sqrt(Math.min(xg, 1));
    // Chez Understat la coordonnee laterale croit vers la GAUCHE de l'equipe qui
    // attaque : sur l'ensemble du jeu de donnees les ailiers gauches tirent a 0,56
    // et les ailiers droits a 0,45, les lateraux gauches a 0,58 et les droits a
    // 0,43. Le terrain etant dessine attaque vers le haut, la gauche du joueur est
    // aussi celle du lecteur : il faut donc retourner l'axe, sinon toute la carte
    // est en miroir et les tirs changent de cote.
    const cx = g.X(1 - Y);
    const c = but
      ? ballon(svg, cx, g.Y(X), r)
      : svgEl(svg, "circle", {
          cx, cy: g.Y(X), r,
          // sur fond clair il faut appuyer : les memes opacites qu'en sombre
          // laisseraient des cercles quasi invisibles
          fill: C("tir"), "fill-opacity": themeSombre() ? 0.14 : 0.26,
          stroke: C("tir"), "stroke-width": 0.9,
          "stroke-opacity": themeSombre() ? 0.5 : 0.72,
        });
    c.style.cursor = "help";
    c.dataset.bulle = `<b>${LIB_RESULTAT[res] || res}</b> · ${nb(xg, 2)} xG<br>` +
      `<span>${LIB_SITUATION[sit] || ""} · ${LIB_PIED[pied] || ""}<br>` +
      `${minute}′ contre ${echapper(equipe(adv))}</span>`;
    if (!doux) {
      c.style.transformBox = "fill-box";
      c.style.transformOrigin = "center";
      c.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "none" }],
        { duration: 320, delay: Math.min(i * 6, 500), fill: "forwards",
          easing: "cubic-bezier(.22,.61,.36,1)" });
    }
  });
}

/* Distance au but en metres, deduite des coordonnees Understat. */
const distanceTir = (t) => Math.hypot((1 - t[0]) * 105, (t[1] - 0.5) * 68);

/* ═════════════════════════════════════════════════════════ les deux toiles */
/* Une toile se lit bien jusqu'a huit axes. Au-dela, les rayons se resserrent,
   les etiquettes se chevauchent et la forme ne veut plus rien dire : c'est le
   cas des 59 variables de comparaison. Le detail passe donc par des axes
   paralleles, qui gardent une graduation lisible quel que soit leur nombre.

   Deuxieme regle suivie ici : deux joueurs ne se distinguent jamais par la
   seule couleur. Le premier a un trait plein et des points ronds, le second un
   trait tirete et des losanges, et chaque trace porte son nom a meme le
   graphique. */

function courtLibelle(s) {
  s = s.replace(/ \(.*\)$/, "").replace(/^Pourcentage de /, "% ").replace(/^Part des /, "% ")
       .replace(/^Part de /, "% ").replace(/^Distance /, "Dist. ");
  return s.length > 22 ? s.slice(0, 21) + "…" : s;
}

/* Un losange, pour marquer le second joueur sans recourir a la couleur. */
const losange = (x, y, r) =>
  `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;

function dessinerToile(svg, joueurA, joueurB, mode) {
  const zone = svg.closest(".radar-zone");
  if (zone) zone.classList.toggle("detail", mode === "detail");
  // logee dans la rangee des terrains, la toile n'a qu'un tiers de largeur : les
  // axes paralleles y seraient illisibles, le bloc reprend alors toute la ligne
  const bloc = svg.closest(".bloc.au-terrain");
  if (bloc) bloc.classList.toggle("large", mode === "detail");
  const phrase = document.getElementById(svg.id === "radar" ? "dit-toile" : "dit-toile-cmp");
  if (phrase) phrase.innerHTML = EXPLICATION_TOILE[mode] || "";
  if (mode === "detail") return dessinerParalleles(svg, joueurA, joueurB);
  return dessinerRadar(svg, joueurA, joueurB);
}

const EXPLICATION_TOILE = {
  familles: `Chaque branche est une famille de variables, et sa note est la moyenne des
    percentiles qu'elle contient. Seules les familles qui comptent à ce poste sont
    tracées, et les percentiles sont corrigés de l'effet du club, pour qu'un joueur
    d'une grosse équipe ne soit pas avantagé par le simple volume de jeu de ses
    coéquipiers. Le bord extérieur vaut 100, le centre 0. Le cercle en
    pointillés marque le <b>joueur médian de son poste</b> : tout ce qui dépasse est
    au-dessus de la moitié des joueurs du même poste.`,
  detail: `Un axe vertical par variable, gradué de 0 en bas à 100 en haut, et une ligne
    brisée par joueur. Une toile à autant de branches serait illisible, alors qu'ici la
    graduation tient et on voit d'un coup d'œil où le profil décroche. Les bandeaux
    colorés en haut regroupent les variables par <b>famille</b>.`,
};

/* ─────────────────────────────────────────────── la toile de synthese */
function dessinerRadar(svg, a, b) {
  svg.innerHTML = "";
  svg.classList.remove("large");
  // la note d'une branche ne moyenne que les variables jugees au poste : une
  // variable ecartee ne doit pas peser sur la famille qu'elle appartenait
  const juges = varsJugees(a.p);
  const axes = famillesDe(a.p).map((f) => ({
    libelle: f, famille: f,
    indices: juges.filter((m) => m.famille === f).map((m) => m.i),
  }));

  const cx = 330, cy = 320, R = 196;
  const n = axes.length;
  svg.setAttribute("viewBox", "0 0 660 620");
  const ang = (i) => (-90 + (360 * i) / n) * (Math.PI / 180);
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];

  // ── graduations. Le cercle median est le repere le plus utile : on le nomme.
  [20, 40, 60, 80, 100].forEach((r) =>
    svgEl(svg, "circle", { cx, cy, r: (R * r) / 100, fill: "none",
      stroke: r === 100 ? "var(--bord2)" : "var(--bord)", "stroke-width": 1 }));
  svgEl(svg, "circle", { cx, cy, r: R / 2, fill: "none", stroke: "var(--bord3)",
                         "stroke-dasharray": "2 5", "stroke-width": 1.2 });
  svgEl(svg, "text", { x: cx + 5, y: cy - R / 2 - 5, fill: "var(--gris2)",
                       "font-size": 9.5, "letter-spacing": ".06em" }, "médiane du poste");
  [25, 50, 75, 100].forEach((r) =>
    svgEl(svg, "text", { x: cx + 5, y: cy - (R * r) / 100 + 12, fill: "var(--gris3)",
                         "font-size": 9 }, r));

  // ── rayons et etiquettes de famille
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, 100);
    svgEl(svg, "line", { x1: cx, y1: cy, x2: x, y2: y,
                         stroke: "var(--bord)", "stroke-width": 1 });
    const couleur = couleurFamille(ax.famille) || "var(--gris)";
    const [lx, ly] = [cx + Math.cos(ang(i)) * (R + 26), cy + Math.sin(ang(i)) * (R + 26)];
    const droite = Math.cos(ang(i)) > 0.08, gauche = Math.cos(ang(i)) < -0.08;
    const ancrage = droite ? "start" : gauche ? "end" : "middle";
    svgEl(svg, "text", { x: lx, y: ly - 6, "text-anchor": ancrage,
      "dominant-baseline": "middle", fill: couleur, "font-size": 13.5,
      "font-weight": 600 }, ax.libelle);
    // la note de chaque famille est ecrite sous son nom : plus besoin de survoler
    const brut = valeurAxe(a.x, ax);
    const brutB = b ? valeurAxe(vecteurDans(b, a.p), ax) : undefined;
    const note = brut === null ? "–" : Math.round(brut) + "e";
    const noteB = brutB === undefined ? null
                : brutB === null ? "–" : Math.round(brutB) + "e";
    svgEl(svg, "text", { x: lx, y: ly + 11, "text-anchor": ancrage,
      "dominant-baseline": "middle", fill: "var(--gris2)", "font-size": 11.5,
      "font-family": "var(--mono)" },
      noteB === null ? note : `${note} / ${noteB}`);
  });

  const trace = (joueur, vecteur, couleur, second) => {
    // une famille sans donnee ramene le sommet au centre : le creux se voit, et
    // l'etiquette de l'axe porte un tiret plutot qu'un chiffre invente
    const points = axes.map((ax, i) => pt(i, valeurAxe(vecteur, ax) ?? 0).join(",")).join(" ");
    // la classe declenche le deploiement depuis le centre, decrit dans la feuille
    // de style : le second joueur part un souffle apres le premier
    const groupe = svgEl(svg, "g", { class: "toile-trace",
                                     style: second ? "animation-delay:.16s" : null });
    svgEl(groupe, "polygon", {
      points, fill: couleur,
      "fill-opacity": themeSombre() ? (second ? 0.1 : 0.2) : (second ? 0.14 : 0.3),
      stroke: couleur,
      "stroke-width": second ? 2.2 : 2.4, "stroke-linejoin": "round",
      "stroke-dasharray": second ? "7 5" : null });
    axes.forEach((ax, i) => {
      const v = valeurAxe(vecteur, ax);
      const [x, y] = pt(i, v ?? 0);
      const marque = second
        ? svgEl(groupe, "polygon", { points: losange(x, y, 5.4), fill: couleur,
            stroke: "var(--fond)", "stroke-width": 1.2 })
        : svgEl(groupe, "circle", { cx: x, cy: y, r: 4.6, fill: couleur,
            stroke: "var(--fond)", "stroke-width": 1.2 });
      marque.style.cursor = "help";
      marque.dataset.bulle = `<b>${echapper(joueur.n)}</b><br><span>${ax.libelle} : ${
        v === null ? "aucune donnée dans ce championnat" : ordinal(v) + " percentile"
      }</span>`;
    });
    if (!doux) groupe.animate(
      [{ transform: `translate(${cx}px,${cy}px) scale(.05) translate(${-cx}px,${-cy}px)`,
         opacity: 0.2 }, { transform: "none", opacity: 1 }],
      { duration: 620, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" });
    return groupe;
  };
  if (b) trace(b, vecteurDans(b, a.p), C("b"), true);
  trace(a, a.x, C("a"), false);

  legendeSeries(svg, a, b, 330, 596);
}

/* Rien de connu sur cette famille : on renvoie null plutot que la mediane, pour
   que la branche se dessine vide au lieu de raconter un joueur moyen. */
function valeurAxe(vecteur, axe) {
  const v = axe.indices.map((i) => vecteur[i]).filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/* Legende commune aux deux graphiques : la forme du marqueur y figure, pas
   seulement sa couleur, pour rester lisible sans distinguer les teintes. */
function legendeSeries(svg, a, b, cx, y) {
  const g = svgEl(svg, "g", {});
  const entree = (x, joueur, couleur, second) => {
    if (second) svgEl(g, "polygon", { points: losange(x, y - 4, 5), fill: couleur });
    else svgEl(g, "circle", { cx: x, cy: y - 4, r: 4.6, fill: couleur });
    svgEl(g, "line", { x1: x - 15, y1: y - 4, x2: x + 15, y2: y - 4, stroke: couleur,
      "stroke-width": 2.2, "stroke-dasharray": second ? "6 4" : null });
    return svgEl(g, "text", { x: x + 21, y, fill: "var(--texte)", "font-size": 12.5 },
                 joueur.n);
  };
  if (!b) { entree(cx - 90, a, C("a"), false); return; }
  entree(cx - 250, a, C("a"), false);
  entree(cx + 20, b, C("b"), true);
}

/* ────────────────────────────────── les axes paralleles, pour le detail */
/* Chaque variable a son axe vertical, gradue de 0 en bas a 100 en haut, et
   chaque joueur est une ligne brisee qui les traverse. Les familles sont
   marquees par un bandeau colore en haut : on retrouve d'un coup d'oeil ou le
   trace decroche. */
function dessinerParalleles(svg, a, b) {
  svg.innerHTML = "";
  svg.classList.add("large");
  // seules les variables jugees au poste sont tracees : les autres ne decrivent
  // pas ce que fait ce joueur-la, les afficher brouillerait la lecture
  const meta = varsJugees(a.p);
  const vb = b ? vecteurDans(b, a.p) : null;

  const m = { g: 46, d: 22, h: 84, b: 128 };
  const pas = 15.5;
  const W = m.g + m.d + pas * (meta.length - 1);
  const H = 430;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const X = (i) => m.g + i * pas;
  const Y = (v) => H - m.b - ((v ?? 50) / 100) * (H - m.h - m.b);

  // ── graduation horizontale
  [0, 25, 50, 75, 100].forEach((v) => {
    const mediane = v === 50;
    svgEl(svg, "line", { x1: m.g - 8, y1: Y(v), x2: W - m.d + 8, y2: Y(v),
      stroke: mediane ? "var(--bord3)" : "var(--bord)", "stroke-width": mediane ? 1.2 : 1,
      "stroke-dasharray": mediane ? "2 5" : null });
    svgEl(svg, "text", { x: m.g - 13, y: Y(v) + 3.5, "text-anchor": "end",
      fill: mediane ? "var(--gris2)" : "var(--gris3)", "font-size": 10,
      "font-family": "var(--mono)" }, v);
  });
  svgEl(svg, "text", { x: m.g - 13, y: Y(50) - 9, "text-anchor": "end",
    fill: "var(--gris2)", "font-size": 9 }, "médiane");

  // ── bandeaux de famille
  let debut = 0;
  meta.forEach((v, i) => {
    if (i < meta.length - 1 && meta[i + 1].famille === v.famille) return;
    const couleur = couleurFamille(v.famille) || "var(--gris)";
    const x0 = X(debut) - pas / 2 + 1, x1 = X(i) + pas / 2 - 1;
    svgEl(svg, "rect", { x: x0, y: m.h - 34, width: Math.max(2, x1 - x0), height: 4,
      rx: 2, fill: couleur, "fill-opacity": 0.85 });
    // un bandeau etroit ne peut pas porter le nom entier : on l'abrege plutot
    // que de le laisser deborder sur la famille voisine
    const large = x1 - x0;
    const tient = Math.max(0, Math.floor(large / 6.1));
    const nom = v.famille.length <= tient ? v.famille
      : tient >= 5 ? v.famille.slice(0, tient - 1) + "…" : "";
    svgEl(svg, "text", { x: (x0 + x1) / 2, y: m.h - 42, "text-anchor": "middle",
      fill: couleur, "font-size": 10.5, "font-weight": 600 }, nom)
      .dataset.bulle = `<b>${echapper(v.famille)}</b>`;
    debut = i + 1;
  });

  // ── axes verticaux et zones de survol
  meta.forEach((v, i) => {
    svgEl(svg, "line", { x1: X(i), y1: Y(100), x2: X(i), y2: Y(0),
      stroke: "var(--bord)", "stroke-width": 1 });
    const etiquette = svgEl(svg, "text", {
      x: X(i), y: Y(0) + 12, "text-anchor": "end", fill: "var(--gris2)",
      "font-size": 10, transform: `rotate(-58 ${X(i)} ${Y(0) + 12})` },
      courtLibelle(v.libelle));
    etiquette.style.cursor = "help";
    const bulle = `<b>${echapper(v.libelle)}</b><br><span>${echapper(v.famille)}<br>` +
      `${echapper(a.n)} : ${ordinal(a.x[v.i])}` +
      (vb ? `<br>${echapper(b.n)} : ${ordinal(vb[v.i])}` : "") + `</span>`;
    etiquette.dataset.bulle = bulle;
    // bande invisible : viser une ligne de 1 pixel au survol serait pénible
    const zone = svgEl(svg, "rect", { x: X(i) - pas / 2, y: m.h - 38,
      width: pas, height: H - m.b - m.h + 50, fill: "transparent" });
    zone.style.cursor = "help";
    zone.dataset.bulle = bulle;
  });

  const trace = (joueur, vecteur, couleur, second) => {
    // X(i) est la position a l'ecran, vecteur[v.i] la valeur : la liste affichee
    // est filtree, le vecteur de percentiles ne l'est pas
    const d = meta.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(vecteur[v.i])}`).join(" ");
    const chemin = svgEl(svg, "path", { d, fill: "none", stroke: couleur,
      "stroke-width": second ? 1.9 : 2.1, "stroke-linejoin": "round",
      "stroke-linecap": "round", "stroke-dasharray": second ? "7 5" : null,
      "stroke-opacity": 0.95 });
    if (!doux) {
      const l = chemin.getTotalLength();
      chemin.style.setProperty("--long", l);
      chemin.classList.add("trace");
    }
    meta.forEach((v, i) => {
      if (second) svgEl(svg, "polygon", { points: losange(X(i), Y(vecteur[v.i]), 3.2),
        fill: couleur, "pointer-events": "none" });
      else svgEl(svg, "circle", { cx: X(i), cy: Y(vecteur[v.i]), r: 2.8, fill: couleur,
        "pointer-events": "none" });
    });
  };
  if (vb) trace(b, vb, C("b"), true);
  trace(a, a.x, C("a"), false);

  legendeSeries(svg, a, b, W / 2, 24);
}

/* ══════════════════════════════════════════ graphiques de la saison */
/* Buts et xG cumules match apres match : la courbe dit si le joueur marque
   plus ou moins que ce que ses occasions laissaient attendre, et quand. */
function dessinerCumul(svg, matchs) {
  svg.innerHTML = "";
  const W = 720, H = 250, m = { g: 38, d: 14, h: 14, b: 26 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (!matchs.length) return;

  let cb = 0, cx = 0;
  const serieB = [], serieX = [];
  matchs.forEach((mt, i) => { cb += mt.b; cx += mt.xg; serieB.push(cb); serieX.push(cx); });
  const maxi = Math.max(cb, cx, 1) * 1.08;
  const X = (i) => m.g + (i / Math.max(1, matchs.length - 1)) * (W - m.g - m.d);
  const Y = (v) => H - m.b - (v / maxi) * (H - m.h - m.b);

  for (let k = 0; k <= 4; k++) {
    const v = (maxi * k) / 4;
    svgEl(svg, "line", { x1: m.g, y1: Y(v), x2: W - m.d, y2: Y(v), class: "grille" });
    svgEl(svg, "text", { x: m.g - 7, y: Y(v) + 3.5, "text-anchor": "end",
                         "font-size": 9.5 }, nb(v, 0));
  }
  const chemin = (serie) => serie.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join(" ");
  const trace = (serie, couleur, pointille) => {
    const p = svgEl(svg, "path", { d: chemin(serie), fill: "none", stroke: couleur,
      "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round",
      "stroke-dasharray": pointille ? "5 4" : null });
    if (!doux && !pointille) {
      const l = p.getTotalLength();
      p.style.setProperty("--long", l);
      p.classList.add("trace");
    }
    return p;
  };
  trace(serieX, C("svg-faible2"), true);
  trace(serieB, C("a"), false);

  matchs.forEach((mt, i) => {
    if (!mt.b && !mt.pd) return;
    const c = svgEl(svg, "circle", { cx: X(i), cy: Y(serieB[i]), r: mt.b ? 4 : 2.6,
      fill: mt.b ? C("a") : C("fond2"), stroke: C("a"), "stroke-width": 1.6 });
    c.style.cursor = "help";
    c.dataset.bulle = `<b>${echapper(equipe(mt.h))} ${mt.sh}–${mt.sa} ${echapper(equipe(mt.a))}</b><br>` +
      `<span>${mt.d} · ${mt.min}′ · ${mt.p}<br>${mt.b} but${mt.b > 1 ? "s" : ""}, ${
        mt.pd} passe${mt.pd > 1 ? "s" : ""} déc. · ${nb(mt.xg, 2)} xG</span>`;
  });
  svgEl(svg, "text", { x: W - m.d, y: Y(serieB[serieB.length - 1]) - 8, "text-anchor": "end",
    fill: C("a"), "font-size": 11, "font-weight": 600 }, `${cb} buts`);
  svgEl(svg, "text", { x: W - m.d, y: Y(serieX[serieX.length - 1]) + 17, "text-anchor": "end",
    fill: C("svg-faible2"), "font-size": 11 }, `${nb(cx, 1)} xG attendus`);
  svgEl(svg, "line", { x1: m.g, y1: H - m.b, x2: W - m.d, y2: H - m.b, class: "axe" });
  svgEl(svg, "text", { x: m.g, y: H - 8, "font-size": 9.5 }, "1er match");
  svgEl(svg, "text", { x: W - m.d, y: H - 8, "text-anchor": "end", "font-size": 9.5 },
        `${matchs.length}e match`);
}

/* Le temps de jeu match par match, colore par poste occupe : on voit d'un coup
   d'oeil les blessures, les rotations, et les changements de role. */
const TEINTES_ZONE = { GK: "#7fa86b", D: "#5aa9d6", DM: "#77a5b8", M: "#9b8ec4",
                       AM: "#cf7ba9", FW: "#c98b5e" };
const COULEURS_ZONE = new Proxy({}, {
  get: (_, k) => (TEINTES_ZONE[k] ? pourTheme(TEINTES_ZONE[k]) : C("svg-eteint2")),
});
function couleurPoste(p) {
  if (!p) return C("svg-eteint2");
  if (p === "GK") return COULEURS_ZONE.GK;
  if (p === "Sub") return COULEURS_ZONE.Sub;
  const racine = p.replace(/[LRC]$/, "") || p;
  return COULEURS_ZONE[racine] || COULEURS_ZONE[p[0]] || C("svg-eteint2");
}

function dessinerMatchs(svg, matchs) {
  svg.innerHTML = "";
  const W = 720, H = 190, m = { g: 30, d: 12, h: 12, b: 30 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (!matchs.length) return;
  const lg = (W - m.g - m.d) / matchs.length;
  const Y = (v) => H - m.b - (v / 95) * (H - m.h - m.b);

  [0, 45, 90].forEach((v) => {
    svgEl(svg, "line", { x1: m.g, y1: Y(v), x2: W - m.d, y2: Y(v), class: "grille" });
    svgEl(svg, "text", { x: m.g - 6, y: Y(v) + 3.5, "text-anchor": "end",
                         "font-size": 9.5 }, v + "′");
  });
  matchs.forEach((mt, i) => {
    const x = m.g + i * lg;
    const h = Math.max(1.5, (H - m.h - m.b) * (Math.min(mt.min, 95) / 95));
    const r = svgEl(svg, "rect", { x: x + 0.6, y: H - m.b - h, width: Math.max(1.6, lg - 1.4),
      height: h, rx: 1.6, fill: couleurPoste(mt.p), "fill-opacity": 0.82 });
    r.style.cursor = "help";
    r.dataset.bulle = `<b>${echapper(equipe(mt.h))} ${mt.sh}–${mt.sa} ${echapper(equipe(mt.a))}</b><br>` +
      `<span>${mt.d} · ${mt.min}′ au poste ${mt.p}<br>${mt.b} but${mt.b > 1 ? "s" : ""}, ${
        mt.pd} passe${mt.pd > 1 ? "s" : ""} déc. · ${nb(mt.xg, 2)} xG · ${nb(mt.xa, 2)} xA</span>`;
    if (!doux) {
      r.style.transformBox = "fill-box";
      r.style.transformOrigin = "bottom";
      r.animate([{ transform: "scaleY(0)" }, { transform: "none" }],
        { duration: 420, delay: Math.min(i * 9, 420), fill: "backwards",
          easing: "cubic-bezier(.22,.61,.36,1)" });
    }
    // un point sous la barre a chaque but
    for (let k = 0; k < Math.min(mt.b, 3); k++)
      svgEl(svg, "circle", { cx: x + lg / 2, cy: H - m.b + 8 + k * 6, r: 2.3,
                             fill: C("b") });
  });
  svgEl(svg, "line", { x1: m.g, y1: H - m.b, x2: W - m.d, y2: H - m.b, class: "axe" });
}

/* L'historique de carriere, saison par saison : minutes en barres, buts et
   passes decisives en points. Understat remonte jusqu'au debut de la fiche. */
function dessinerSaisons(svg, saisons) {
  svg.innerHTML = "";
  const W = 720, H = 210, m = { g: 34, d: 34, h: 14, b: 30 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (!saisons.length) return;
  const lg = (W - m.g - m.d) / saisons.length;
  const maxMin = Math.max(...saisons.map((s) => s.min), 1);
  const maxBut = Math.max(...saisons.map((s) => Math.max(s.b, s.pd)), 1);
  const Ym = (v) => H - m.b - (v / maxMin) * (H - m.h - m.b);
  const Yb = (v) => H - m.b - (v / maxBut) * (H - m.h - m.b);

  saisons.forEach((s, i) => {
    const x = m.g + i * lg;
    const h = H - m.b - Ym(s.min);
    const r = svgEl(svg, "rect", { x: x + lg * 0.16, y: Ym(s.min), width: lg * 0.68,
      height: Math.max(1, h), rx: 3, fill: C("barre-min"), "fill-opacity": 0.9 });
    r.style.cursor = "help";
    r.dataset.bulle = `<b>${s.s}/${(+s.s + 1) % 100} · ${echapper(equipe(s.eq))}</b><br>` +
      `<span>${s.min} minutes, ${s.matchs} matchs<br>${s.b} buts, ${s.pd} passes décisives<br>` +
      `${nb(s.xg, 1)} xG · ${nb(s.xa, 1)} xA</span>`;
    svgEl(svg, "text", { x: x + lg / 2, y: H - 10, "text-anchor": "middle",
                         "font-size": 9.5 }, String(s.s).slice(2) + "/" + ((+s.s + 1) % 100));
  });
  const ligne = (cle, couleur) => {
    const d = saisons.map((s, i) =>
      `${i ? "L" : "M"}${m.g + i * lg + lg / 2},${Yb(s[cle])}`).join(" ");
    svgEl(svg, "path", { d, fill: "none", stroke: couleur, "stroke-width": 2.2,
                         "stroke-linejoin": "round" });
    saisons.forEach((s, i) => svgEl(svg, "circle", {
      cx: m.g + i * lg + lg / 2, cy: Yb(s[cle]), r: 3.2, fill: couleur,
      stroke: C("fond2"), "stroke-width": 1.2 }));
  };
  ligne("b", C("b"));
  ligne("pd", "#cf7ba9");
  svgEl(svg, "text", { x: 6, y: 16, "font-size": 9.5, fill: C("svg-faible") }, "minutes");
  svgEl(svg, "text", { x: W - 6, y: 16, "text-anchor": "end", "font-size": 9.5,
                       fill: C("svg-faible") }, "buts et passes");
}

/* ═════════════════════════════════════════════════════════════ le hero */
function heroHTML(j) {
  const drapeau = drapeauDe(j), logo = logoDe(j);
  const evolution = j.vn && j.v ? (j.vn - j.v) / j.v : null;
  const note = Math.round(j.x.filter((v) => v !== null).reduce((s, v, _, t) =>
    s + v / t.length, 0));
  return `
  <div class="hero" style="--teinte:${teinteDe(j.c)}">
    <div class="hero-fond"></div>
    <div class="hero-in">
      <div class="portrait">
        ${imgJoueur(j, "", null, true)}
        ${j.nb ? `<span class="numero">${echapper(j.nb)}</span>` : ""}
        ${logo ? `<span class="ecusson"><img src="${logo}" alt="" data-retirer="1"></span>` : ""}
      </div>
      <div class="hero-id">
        <p class="ligne1">
          ${drapeau ? `<img src="${drapeau}" alt="" data-retirer="1">` : ""}
          ${echapper(j.na || "")} ${j.an ? `· né en ${j.an}` : ""}${
            j.ln ? ` à ${echapper(j.ln)}` : ""}${
            j.sel ? ` · ${j.sel} sélection${+j.sel > 1 ? "s" : ""}${
              j.selb ? ` et ${j.selb} but${Math.abs(+j.selb) > 1 ? "s" : ""}` : ""}` : ""}
        </p>
        <h2>${echapper(j.n)}${j.er ? `<span class="reduit" title="Moins de ${
          DATA.seuil_reference} minutes jouées : les percentiles sont moins fiables">!</span>` : ""}</h2>
        <div class="badges">
          <span class="badge fort"><b>${DATA.postes_libelle[j.p]}</b></span>
          <span class="badge">${echapper(j.c)} · ${echapper(j.l)}</span>
          <span class="badge"><b>${j.a ?? "–"}</b> ans</span>
          ${j.t ? `<span class="badge"><b>${echapper(j.t)}</b></span>` : ""}
          ${j.pi ? `<span class="badge">pied <b>${echapper(j.pi)}</b></span>` : ""}
          ${j.ct ? `<span class="badge">contrat jusqu'au <b>${echapper(j.ct)}</b></span>` : ""}
          ${j.cl ? `<span class="badge alerte">transféré en cours de saison : ${
            echapper(j.cl)}</span>` : ""}
          ${j.ca && j.ca !== j.c
            ? `<span class="badge alerte">aujourd'hui à <b>${echapper(j.ca)}</b></span>` : ""}
        </div>
      </div>
      <div class="hero-prix">
        <p class="gros" data-compte="${j.v || 0}" data-format="euros">${euros(j.v)}</p>
        <p class="lab">valeur marchande au ${FIN_SAISON}</p>
        <p class="sous">
          ${j.vn ? `aujourd'hui <i>${euros(j.vn)}</i>${evolution !== null
            ? ` <i style="color:${evolution >= 0 ? "var(--pos)" : "var(--neg)"}">(${
                evolution >= 0 ? "+" : ""}${Math.round(evolution * 100)} %)</i>` : ""}` : ""}
          ${j.vx ? `<br>pic <i>${euros(j.vx)}</i>${j.dx ? ` en ${echapper(j.dx)}` : ""}` : ""}
        </p>
      </div>
    </div>
    <div class="kpis">
      ${kpi("Minutes", j.m, "entier", j.m / 3420)}
      ${kpi("Matchs joués", j.mj, "entier", j.mj / 38)}
      ${kpi("Titularisations", j.ti, "entier", j.ti / 38)}
      ${j.p === "GB" ? `
        ${kpi("Clean sheets", valeurDe(j, "clean_sheets"), "entier", null,
              `${Math.round(valeurDe(j, "pct_clean_sheets") || 0)} % des matchs`)}
        ${kpi("Buts encaissés", valeurDe(j, "buts_encaisses"), "entier")}
        ${kpi("Arrêts / 90 min", valeurDe(j, "arrets_90"), "un")}
        ${kpi("% d'arrêts", valeurDe(j, "pct_arrets"), "un")}
      ` : `
        ${kpi("Buts", j.b, "entier", null, j.bp ? `dont ${j.bp} pénalty` : "")}
        ${kpi("Passes décisives", j.pd, "entier")}
        ${kpi("xG", j.xg, "un")}
        ${kpi(LIB_XA, j.xa, "un")}
      `}
      ${j.nv != null
        ? kpi("Niveau", j.nv, "entier", j.nv / 100, "dans son poste")
        : kpi("Note moyenne", note, "entier", note / 100, "percentile moyen")}
    </div>
  </div>`;
}
function kpi(libelle, valeur, format, part, sous) {
  return `<div class="kpi">
    <p class="v" data-compte="${valeur ?? 0}" data-format="${format}">${
      format === "un" ? nb(valeur, 1) : entier(valeur)}</p>
    <p class="l">${libelle}${sous ? ` <span style="opacity:.7">· ${sous}</span>` : ""}</p>
    ${part !== null && part !== undefined
      ? `<p class="p"><i data-largeur="${Math.min(100, Math.round(part * 100))}%"></i></p>` : ""}
  </div>`;
}

/* ══════════════════════════════════════════════════ la phrase de synthese */
/* Elle n'invente rien : elle lit les percentiles par famille et nomme les deux
   plus hauts et le plus bas, pour donner une entree en matiere a quelqu'un qui
   ne lit pas les graphiques. */
function syntheseHTML(j) {
  const notes = notesFamilles(j).sort((a, b) => b.note - a.note);
  const forts = notes.slice(0, 2), faible = notes[notes.length - 1];
  const f = ficheDe(j);
  const postes = f && f.postes
    ? Object.entries(f.postes).filter(([p]) => p !== "Sub")
        .sort((a, b) => b[1].min - a[1].min) : [];
  const phrasePostes = postes.length > 1
    ? ` Il a été aligné à <b>${postes.length} postes différents</b>, surtout ${
        (DATA.postes_understat[postes[0][0]] || {}).libelle || postes[0][0]
      } (${postes[0][1].min} minutes).`
    : postes.length === 1
      ? ` Il a joué l'intégralité de sa saison ${(
          (DATA.postes_understat[postes[0][0]] || {}).libelle || postes[0][0]).toLowerCase()}.`
      : "";
  const ouverture = `<b>${echapper(j.n)}</b>, ${DATA.postes_libelle[j.p].toLowerCase()} de ${
    j.a} ans, a joué <b>${entier(j.m)} minute${j.m > 1 ? "s" : ""}</b> en ${echapper(j.l)}
    sur la saison ${DATA.saison}.`;

  /* En dessous du seuil de reference, les percentiles reposent sur trop peu de
     matchs pour vouloir dire quoi que ce soit : on le dit au lieu de nommer des
     points forts que le joueur n'a pas eu le temps de montrer. */
  if (j.m < (DATA.seuil_reference || 450)) {
    return `<div class="synthese monte">${ouverture}
      C'est trop peu pour en tirer un profil : ses percentiles sont calculés sur la même
      échelle que les autres, mais quelques dizaines de minutes suffisent à les faire varier
      du tout au tout. Ils sont affichés pour situer le joueur, pas pour le juger.
      ${phrasePostes}</div>`;
  }
  return `<div class="synthese monte">${ouverture}
    Comparé aux autres ${DATA.postes_pluriel[j.p].toLowerCase()} des cinq grands championnats,
    il se distingue en <span class="fort">${forts[0].famille.toLowerCase()}</span>
    (${ordinal(forts[0].note)} percentile) et en
    <span class="fort">${forts[1].famille.toLowerCase()}</span> (${ordinal(forts[1].note)}).
    Il décroche en <span class="faible">${faible.famille.toLowerCase()}</span>
    (${ordinal(faible.note)}).${phrasePostes}
    <br><span style="font-size:12.5px;color:var(--gris2)">Un percentile de 50 désigne le joueur
    médian de son poste. Au-dessus de 80, il fait partie du cinquième le plus fourni sur cette
    famille de variables.</span>
  </div>`;
}

/* ════════════════════════════════════════════════════ toutes les variables */
function statsHTML(j) {
  const vars = toutesLesVariables(j);
  const familles = [...new Set(vars.map((v) => v.famille))];
  return `<div class="bloc monte">
    <header><h3>Toutes les statistiques</h3></header>
    <p class="dit">Chaque variable est ramenée à 90 minutes puis comparée aux autres
      ${DATA.postes_pluriel[j.p].toLowerCase()} des cinq championnats. Le nombre à gauche est la
      valeur réelle, la barre à droite est le rang du joueur dans son poste, de 0 à 100.
      Les variables où une valeur basse vaut mieux, comme les ballons perdus ou les pénaltys
      concédés, sont retournées : la barre pleine reste la bonne nouvelle.</p>
    <div class="familles-onglets" id="fam-onglets">
      <button aria-pressed="true" data-fam="">Tout</button>
      ${familles.map((f) => `<button aria-pressed="false" data-fam="${echapper(f)}">${
        echapper(f)}</button>`).join("")}
    </div>
    <p class="dit" id="fam-explication"></p>
    <div class="stats-grille" id="stats-grille"></div>
  </div>`;
}
function remplirStats(j, famille) {
  const vars = toutesLesVariables(j).filter((v) => !famille || v.famille === famille);
  $("#stats-grille").innerHTML = vars.map((v) => {
    const p = v.percentile;
    const c = couleurFamille(v.famille) || C("a");
    return `<div class="stat-l" data-bulle="<b>${echapper(v.libelle)}</b><br><span>${
      echapper(v.famille)}${v.inverse ? " · une valeur basse est meilleure" : ""}${
      v.comparaison ? "<br>entre dans le calcul de ressemblance" : ""}</span>">
      <span class="lib">${echapper(v.libelle)}</span>
      <span class="brut">${v.valeur === null || v.valeur === undefined
        ? "–" : nb(v.valeur, Math.abs(v.valeur) >= 100 ? 0 : 2)}</span>
      <span class="jauge-p${p === null || p === undefined ? " vide" : ""}">
        <i data-largeur="${p ?? 0}%" style="background:${c}"></i><u>${
          p === null || p === undefined ? "–" : ordinal(p)}</u></span>
    </div>`;
  }).join("");
  $("#fam-explication").textContent =
    famille ? (DATA.familles_explications[famille] || "") : "";
  lancerBarres($("#stats-grille"));
}

/* ═════════════════════════════════════════════════════════ assemblage */
function dessinerFiche() {
  const j = etat.joueur, zone = $("#vue-fiche");
  if (!j) { zone.innerHTML = `<p class="vide">Choisis un joueur dans la recherche.</p>`; return; }
  const f = ficheDe(j);
  const matchs = matchsDe(f);
  const saisons = saisonsDe(f);
  const proches = plusProches(j, 6);

  zone.innerHTML = `
    ${heroHTML(j)}
    ${syntheseHTML(j)}

    <div class="terrains">
      <div class="bloc terrain monte" style="margin-top:0">
        <header><h3>Postes occupés</h3></header>
        <p class="dit">Les minutes réellement jouées à chaque poste, relevées match par match.
          Le poste le plus utilisé est encadré.${(j.pd_tm || []).length
            ? " Les cases en pointillés orange sont les postes que Transfermarkt lui attribue" +
              " mais où il n'a pas joué une minute en " + SAISON + "." : ""} Les cases éteintes sont
          les postes qu'il n'occupe pas.</p>
        <svg id="carte-postes" role="img" aria-label="Postes occupés sur le terrain"></svg>
        <div class="postes-liste" id="liste-postes"></div>
      </div>

      <div class="bloc terrain monte" style="margin-top:0">
        <header><h3>Où il touche le ballon</h3></header>
        <p class="dit">La <b>hauteur</b> de la zone rouge est mesurée : c'est la répartition
          réelle de ses touches de balle entre sa surface, les trois tiers du terrain et la
          surface adverse. La <b>largeur</b> est reconstituée à partir des postes qu'il a
          occupés. Aucune donnée d'événements gratuite n'existe pour cette saison, ce n'est
          donc pas une carte de chaleur au sens strict.</p>
        <svg id="carte-zone" role="img" aria-label="Zones de ballon"></svg>
        <div class="legende-zones"><span>peu</span><span class="echelle"></span><span>souvent</span></div>
      </div>

      <div class="bloc terrain monte" style="margin-top:0">
        <header>
          <h3>Carte des tirs</h3>
          <div class="filtres-tirs">
            <select id="tir-situation">
              <option value="">Toutes situations</option>
              <option value="J">Jeu courant</option>
              <option value="C">Corner</option>
              <option value="A">Coup de pied arrêté</option>
              <option value="F">Coup franc direct</option>
              <option value="P">Pénalty</option>
            </select>
            <select id="tir-pied">
              <option value="">Pied et tête</option>
              <option value="D">Pied droit</option>
              <option value="G">Pied gauche</option>
              <option value="T">Tête</option>
            </select>
            <select id="tir-resultat">
              <option value="">Tous les tirs</option>
              <option value="B">Buts seulement</option>
              <option value="N">Tirs non marqués</option>
            </select>
          </div>
        </header>
        <p class="dit">Chaque marque est un tir, placé là où il a été frappé. Sa taille suit
          le xG, c'est-à-dire la probabilité qu'un tir de cette position finisse au fond.
          <b>Un ballon signale un but</b>, un cercle vide un tir non marqué. Le xG affiché ici
          vient d'Understat et diffère un peu de celui de FBref plus haut : les deux mesurent
          la même chose avec deux modèles différents.</p>
        <svg id="carte-tirs" role="img" aria-label="Carte des tirs"></svg>
        <div class="stats-tirs" id="stats-tirs"></div>
      </div>
    </div>

    <div class="bloc monte" id="bloc-toile">
      <header>
        <h3>La toile des percentiles</h3>
        <div class="segments">
          <label><input type="radio" name="mode-toile" value="familles"
            ${etat.mode === "familles" ? "checked" : ""}>${
              famillesDe(j.p).length} familles</label>
          <label><input type="radio" name="mode-toile" value="detail"
            ${etat.mode === "detail" ? "checked" : ""}>${
              varsJugees(j.p).length} variables</label>
        </div>
      </header>
      <p class="dit" id="dit-toile"></p>
      <div class="radar-zone">
        <svg id="radar" role="img" aria-label="Toile des percentiles"></svg>
        <div class="familles-liste" id="familles-liste"></div>
      </div>
    </div>

    ${statsHTML(j)}

    ${matchs.length ? `
    <div class="bloc monte">
      <header><h3>Buts et xG cumulés au fil de la saison</h3></header>
      <p class="dit">La ligne pleine compte les buts, la ligne en pointillés les xG cumulés.
        Quand la ligne pleine passe au-dessus, le joueur a marqué plus que ce que ses positions
        de tir laissaient attendre. En dessous, il a été moins efficace, ou moins chanceux.</p>
      <svg class="graph" id="graph-cumul" role="img" aria-label="Buts et xG cumulés"></svg>
    </div>

    <div class="bloc monte">
      <header><h3>Le temps de jeu, match par match</h3></header>
      <p class="dit">Une barre par match de championnat, sa hauteur donne les minutes jouées et
        sa couleur le poste occupé ce jour-là. Les points sous une barre marquent les buts.
        Les trous signalent les matchs manqués, blessure, suspension ou choix du coach.</p>
      <svg class="graph" id="graph-matchs" role="img" aria-label="Minutes par match"></svg>
      <div class="legende-zones" id="legende-postes"></div>
    </div>` : ""}

    ${saisons.length > 1 ? `
    <div class="bloc monte">
      <header><h3>Sa carrière saison par saison</h3></header>
      <p class="dit">Les barres donnent les minutes jouées, les deux courbes les buts et les
        passes décisives. Seules les saisons passées dans un des cinq grands championnats
        apparaissent, un passage dans un autre pays laisse un trou. La dernière saison peut
        être en cours, auquel cas elle n'est pas comparable aux précédentes.</p>
      <svg class="graph" id="graph-saisons" role="img" aria-label="Carrière saison par saison"></svg>
    </div>` : ""}

    ${f && f.situations && Object.keys(f.situations).length ? `
    <div class="grille2">
      <div class="bloc monte">
        <header><h3>D'où viennent ses tirs</h3></header>
        <p class="dit">Répartition des tirs selon la situation de jeu. Un buteur qui vit du
          jeu courant ne se recrute pas comme un spécialiste des coups de pied arrêtés.</p>
        <div id="situations"></div>
      </div>
      <div class="bloc monte">
        <header><h3>À quelle distance il tire</h3></header>
        <p class="dit">Six mètres, surface, hors surface : le rendement d'un tir dépend
          d'abord de l'endroit d'où il part.</p>
        <div id="zones-tir"></div>
      </div>
    </div>` : ""}

    <div class="bloc monte">
      <header><h3>Les profils les plus proches, tous prix confondus</h3></header>
      <p class="dit">Les six joueurs du même poste qui <b>jouent comme lui</b>. La comparaison
        porte sur la <b>forme</b> du profil, pas sur son niveau : chaque toile est ramenée à sa
        propre moyenne, si bien qu'un espoir peut ressembler à un international confirmé dès
        lors qu'il répartit son jeu de la même façon. S'y ajoutent le gabarit, l'âge et le pied,
        pour un quart du calcul. Le prix n'entre pas en compte, et seuls les joueurs ayant
        dépassé ${DATA.seuil_reference} minutes sont proposés, en dessous les percentiles ne
        mesurent plus un style. <b>Le niveau affiché à côté du prix est une mesure à part</b> :
        deux joueurs peuvent jouer pareil sans valoir pareil, compare-les avant de conclure.
        Pour filtrer sur le niveau et sur le budget, passe par l'onglet Comparer.</p>
      <div class="pistes" id="proches"></div>
    </div>`;

  // ── cartes de terrain
  const infoPostes = dessinerCartePostes($("#carte-postes"), j, f);
  remplirListePostes(infoPostes);
  // Sans touches de balle par tiers du terrain, la carte n'a rien a montrer et son
  // texte promettrait une mesure qui n'existe pas : on retire le bloc entier.
  if (!dessinerCarteZone($("#carte-zone"), j, f)) {
    $("#carte-zone").closest(".bloc").remove();
    // la place ainsi liberee a droite de la carte des tirs accueille la toile,
    // plutot que de laisser une colonne vide et de renvoyer le radar plus bas
    const toile = $("#bloc-toile");
    $(".terrains").appendChild(toile);
    toile.classList.add("terrain", "au-terrain");
  }
  initTirs(j, f);

  // ── toile
  dessinerToile($("#radar"), j, null, etat.mode);
  remplirFamilles(j);
  cascade($("#familles-liste"), ".barre i");
  $$("[name=mode-toile]").forEach((r) => r.addEventListener("change", () => {
    etat.mode = r.value;
    dessinerToile($("#radar"), j, null, etat.mode);
  }));

  // ── tableaux
  remplirStats(j, "");
  cascade($("#stats-grille"), ".jauge-p i");
  $$("#fam-onglets button").forEach((b) => b.addEventListener("click", () => {
    $$("#fam-onglets button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    remplirStats(j, b.dataset.fam);
  }));

  // ── graphiques de saison
  if (matchs.length) {
    dessinerCumul($("#graph-cumul"), matchs);
    dessinerMatchs($("#graph-matchs"), matchs);
    legendePostes(matchs);
  }
  if (saisons.length > 1) dessinerSaisons($("#graph-saisons"), saisons);
  if (f && f.situations && Object.keys(f.situations).length) {
    barresSituations($("#situations"), f.situations, LIB_SITUATION_LONG);
    barresSituations($("#zones-tir"), f.zones || {}, LIB_ZONES);
  }

  // ── voisins
  $("#proches").innerHTML = proches.map(({ j: p, score }, i) => ligneJoueur(p, i + 1, score)).join("");
  $$("#proches .piste").forEach((e) =>
    e.addEventListener("click", () => voirJoueur(e.dataset.nom)));

  animerEntree(zone);
  lancerBarres(zone);
  lancerCompteurs(zone);
}

function ligneJoueur(p, rang, score) {
  return `<div class="piste" data-nom="${echapper(p.n)}" tabindex="0" role="button">
    <span class="rang">${rang}</span>
    ${imgJoueur(p, "")}
    <span class="piste-nom">${echapper(p.n)}${p.er
      ? `<span class="reduit" title="Moins de ${DATA.seuil_reference} minutes">!</span>` : ""}
      <em>${echapper(p.c)} · ${p.a} ans · ${DATA.postes_libelle[p.p]}</em></span>
    <span class="piste-prix">${euros(p.v)}${p.nv != null
      ? `<span class="niv">niveau ${Math.round(p.nv)}</span>` : ""}</span>
    <span class="score" style="--s:${Math.max(0, (score - 55) * 2.2)}%">${score.toFixed(1)}</span>
  </div>`;
}

function remplirListePostes(info) {
  const zone = $("#liste-postes");
  if (!info || !info.utiles.length) {
    zone.innerHTML = `<p class="dit">Aucun relevé de poste pour ce joueur chez Understat.
      Le poste affiché plus haut vient de Transfermarkt.</p>`;
    return;
  }
  const maxi = Math.max(...info.utiles.map(([, v]) => v.min));
  zone.innerHTML = info.utiles.sort((a, b) => b[1].min - a[1].min).map(([code, v]) => `
    <div class="poste-l">
      <span class="nom"><i style="background:${couleurPoste(code)}"></i>${
        (DATA.postes_understat[code] || {}).libelle || code}</span>
      <span class="barre"><i data-largeur="${Math.round(100 * v.min / maxi)}%"
        style="background:${couleurPoste(code)}"></i></span>
      <span class="min">${v.min}′ · ${Math.round(100 * v.min / info.total)} %</span>
    </div>`).join("") +
    (info.remplacant ? `<p class="dit" style="margin-top:7px">${info.remplacant.min} minutes
      supplémentaires disputées après être entré en cours de match, sans poste relevé.</p>` : "");
  lancerBarres(zone);
}

/* Un decalage croissant sur les barres : elles se remplissent de haut en bas
   plutot que toutes d'un bloc, ce qui laisse le temps de lire les valeurs. */
function cascade(racine, selecteur) {
  $$(selecteur, racine).forEach((e, i) => {
    e.style.setProperty("--retard", Math.min(i * 55, 620) + "ms");
  });
}

function remplirFamilles(j) {
  const notes = notesFamilles(j).sort((a, b) => b.note - a.note);
  $("#familles-liste").innerHTML = notes.map((f) => `
    <div class="fam-l" data-bulle="<b>${echapper(f.famille)}</b><br><span>${
      echapper(DATA.familles_explications[f.famille] || "")}</span>">
      <span class="nom"><i style="background:${couleurFamille(f.famille)}"></i>${
        echapper(f.famille)}</span>
      <span class="barre"><i data-largeur="${Math.round(f.note)}%"
        style="background:${couleurFamille(f.famille)}"></i></span>
      <span class="val" style="color:${f.note >= 70 ? "var(--pos)"
        : f.note <= 30 ? "var(--neg)" : "var(--gris)"}">${ordinal(f.note)}</span>
    </div>`).join("");
  lancerBarres($("#familles-liste"));
}

function initTirs(j, f) {
  const svg = $("#carte-tirs"), stats = $("#stats-tirs");
  if (!f || !f.tirs) {
    svg.innerHTML = "";
    dessinerTerrain(svg, 360, 330, 0.47, 1.005);
    svgEl(svg, "text", { x: 180, y: 160, "text-anchor": "middle", fill: C("svg-faible"),
      "font-size": 12 }, j.p === "GB" ? "un gardien ne tire pas"
        : "pas de tirs localisés pour ce joueur");
    if (j.p !== "GB") svgEl(svg, "text", { x: 180, y: 178, "text-anchor": "middle",
      fill: C("svg-eteint2"), "font-size": 10.5 }, "sa fiche Understat n'a pas été retrouvée");
    stats.innerHTML = "";
    return;
  }
  const maj = () => {
    const tirs = filtrerTirs(f, {
      situation: $("#tir-situation").value, pied: $("#tir-pied").value,
      resultat: $("#tir-resultat").value });
    dessinerCarteTirs(svg, tirs);
    const buts = tirs.filter((t) => t[3] === "B").length;
    const xg = tirs.reduce((s, t) => s + t[2], 0);
    const dist = tirs.length
      ? tirs.reduce((s, t) => s + distanceTir(t), 0) / tirs.length : 0;
    stats.innerHTML = `
      <div><b>${tirs.length}</b><span>tirs</span></div>
      <div><b>${buts}</b><span>buts</span></div>
      <div><b>${nb(xg, 1)}</b><span>xG cumulés</span></div>
      <div><b>${nb(dist, 0)} m</b><span>distance moyenne</span></div>`;
  };
  ["#tir-situation", "#tir-pied", "#tir-resultat"].forEach((s) =>
    $(s).addEventListener("change", maj));
  maj();
}

function legendePostes(matchs) {
  const vus = [...new Set(matchs.map((m) => m.p))];
  $("#legende-postes").innerHTML = vus.map((p) =>
    `<span style="display:inline-flex;align-items:center;gap:6px">
      <i style="width:9px;height:9px;border-radius:2px;background:${couleurPoste(p)};
        display:inline-block"></i>${(DATA.postes_understat[p] || {}).libelle || p}</span>`).join("");
}

const LIB_SITUATION_LONG = { OpenPlay: "Jeu courant", FromCorner: "Sur corner",
  SetPiece: "Coup de pied arrêté", DirectFreekick: "Coup franc direct", Penalty: "Pénalty" };
const LIB_ZONES = { shotSixYardBox: "Dans les six mètres", shotPenaltyArea: "Dans la surface",
  shotOboxTotal: "Hors de la surface", shotOwnGoals: "Contre son camp" };

function barresSituations(zone, bloc, libelles) {
  const lignes = Object.entries(bloc)
    .map(([k, v]) => ({ nom: libelles[k] || k, ...v }))
    .filter((l) => l.tirs > 0)
    .sort((a, b) => b.tirs - a.tirs);
  if (!lignes.length) { zone.innerHTML = `<p class="dit">Aucun tir relevé.</p>`; return; }
  const maxi = Math.max(...lignes.map((l) => l.tirs));
  zone.innerHTML = `<div class="postes-liste">` + lignes.map((l) => `
    <div class="poste-l" data-bulle="<b>${echapper(l.nom)}</b><br><span>${l.tirs} tirs, ${
      l.buts} but${l.buts > 1 ? "s" : ""}, ${nb(l.xg, 2)} xG<br>soit ${
      nb(l.xg / l.tirs, 3)} xG par tir</span>">
      <span class="nom">${echapper(l.nom)}</span>
      <span class="barre" style="width:110px"><i data-largeur="${
        Math.round(100 * l.tirs / maxi)}%" style="background:${C("b")}"></i></span>
      <span class="min">${l.tirs} tirs · ${l.buts} but${l.buts > 1 ? "s" : ""}</span>
    </div>`).join("") + `</div>`;
  lancerBarres(zone);
}
