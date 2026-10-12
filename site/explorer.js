/* Radar Big 5 — l'exploration.
   Tous les joueurs dans un tableau que l'on trie et filtre, plus un nuage de
   points pour situer un joueur sur deux variables au choix. C'est la vue qui
   sert quand on ne sait pas encore quel nom chercher. */

/* Les deux axes du nuage et le plancher de minutes suivent le jeu de donnees
   charge : le radar 2024-2025 et celui de 2025-2026 n'ont ni les memes variables
   ni le meme seuil d'entree, et un defaut ecrit en dur y laisserait un axe vide. */
const AXE_PAR_DEFAUT = (rang) => {
  const cles = (DATA.variables.champ || []).map((m) => m.cle);
  const souhaits = rang ? ["xag_90", "xa_90", "passes_dec_90"] : ["npxg_90", "buts_90"];
  return souhaits.find((c) => cles.includes(c)) || cles[rang] || "";
};

const exp = {
  poste: "", ligue: "", ageMax: 45, minutesMin: DATA.seuil_minutes || 270, valeurMax: 0,
  critere: "", tri: "m", sens: -1, texte: "",
  axeX: AXE_PAR_DEFAUT(0), axeY: AXE_PAR_DEFAUT(1),
};

/* Toutes les variables d'un poste, comparaison et fiche confondues, pour les
   listes deroulantes. La cle est prefixee pour savoir dans quel tableau lire. */
function variablesDisponibles(poste) {
  return metaVars(poste).map((m, i) => ({ ...m, source: "x", i }))
    .concat(metaDesc(poste).map((m, i) => ({ ...m, source: "xd", i })));
}
function lireVariable(j, ref) {
  if (!ref) return null;
  const tab = ref.source === "x" ? j.r : j.rd;
  return tab ? tab[ref.i] : null;
}
function lirePercentile(j, ref) {
  if (!ref) return null;
  const tab = ref.source === "x" ? j.x : j.xd;
  return tab ? tab[ref.i] : null;
}
function trouverRef(poste, cle) {
  return variablesDisponibles(poste).find((v) => v.cle === cle) || null;
}

function joueursFiltres() {
  const t = normal(exp.texte);
  return DATA.joueurs.filter((j) =>
    (!exp.poste || j.p === exp.poste) &&
    (!exp.ligue || j.l === exp.ligue) &&
    (j.a === null || j.a <= exp.ageMax) &&
    j.m >= exp.minutesMin &&
    (!exp.valeurMax || (j.v && j.v <= exp.valeurMax)) &&
    (!t || normal(j.n + " " + j.c).includes(t)));
}

const COLONNES = [
  { cle: "n", titre: "Joueur", type: "texte" },
  { cle: "p", titre: "Poste", type: "texte" },
  { cle: "c", titre: "Club", type: "texte" },
  { cle: "a", titre: "Âge", type: "num" },
  { cle: "m", titre: "Minutes", type: "num" },
  { cle: "v", titre: "Valeur", type: "num" },
  { cle: "b", titre: "Buts", type: "num" },
  { cle: "pd", titre: "Passes déc.", type: "num" },
  { cle: "xg", titre: "xG", type: "num" },
  { cle: "xa", titre: LIB_XA, type: "num" },
];

function dessinerExplorer() {
  const zone = $("#vue-explorer");
  zone.innerHTML = `
    <div class="bloc" style="margin-top:0">
      <header><h3>Explorer les ${DATA.joueurs.length} joueurs</h3></header>
      <p class="dit">Filtre la population, trie sur la colonne de ton choix, puis clique une
        ligne pour ouvrir la fiche. Le critère de percentile ajoute une colonne classée à
        l'intérieur du poste : un 90e percentile de tacles ne veut pas dire la même chose
        pour un défenseur central et pour un ailier.</p>
      <div class="barre-outils">
        <label class="champ-groupe"><span>Poste</span>
          <select class="champ" id="e-poste">
            <option value="">Tous les postes</option>
            ${DATA.postes.map((p) => `<option value="${p}"${p === exp.poste ? " selected" : ""}>${
              DATA.postes_libelle[p]}</option>`).join("")}
          </select></label>
        <label class="champ-groupe"><span>Championnat</span>
          <select class="champ" id="e-ligue">
            <option value="">Tous</option>
            ${[...new Set(DATA.joueurs.map((j) => j.l))].sort()
              .map((l) => `<option${l === exp.ligue ? " selected" : ""}>${l}</option>`).join("")}
          </select></label>
        <label class="champ-groupe"><span>Valeur maximale</span>
          <select class="champ" id="e-valeur">
            <option value="0">Sans limite</option>
            <option value="1000000">1 M€</option>
            <option value="5000000">5 M€</option>
            <option value="10000000">10 M€</option>
            <option value="20000000">20 M€</option>
            <option value="40000000">40 M€</option>
            <option value="80000000">80 M€</option>
          </select></label>
        <label class="champ-groupe" style="min-width:150px">
          <span>Âge maximum : <b id="e-v-age"></b></span>
          <input type="range" id="e-age" min="16" max="45" value="${exp.ageMax}"></label>
        <label class="champ-groupe" style="min-width:150px">
          <span>Minutes : <b id="e-v-min"></b></span>
          <input type="range" id="e-minutes" min="${DATA.seuil_minutes || 270}" max="3000" step="30"
                 value="${exp.minutesMin}"></label>
        <label class="champ-groupe" style="min-width:210px"><span>Critère de percentile</span>
          <select class="champ" id="e-critere"></select></label>
        <label class="champ-groupe"><span>Filtrer par nom</span>
          <input class="champ" id="e-texte" placeholder="nom ou club"
                 style="padding:8px 10px;border-radius:8px;border:1px solid var(--bord2);
                        background:var(--surface2);color:var(--texte)"></label>
      </div>
      <p class="dit" id="e-compte"></p>
      <div class="tableau" id="e-tableau"></div>
    </div>

    <div class="bloc monte">
      <header>
        <h3>Situer les joueurs sur deux variables</h3>
        <div class="barre-outils">
          <label class="champ-groupe"><span>Axe horizontal</span>
            <select class="champ" id="e-axe-x"></select></label>
          <label class="champ-groupe"><span>Axe vertical</span>
            <select class="champ" id="e-axe-y"></select></label>
        </div>
      </header>
      <p class="dit">Chaque point est un joueur de la sélection, placé selon ses percentiles
        dans son poste. Les lignes grises marquent le joueur médian. Le quart en haut à droite
        rassemble ceux qui sont au-dessus de la moyenne sur les deux variables à la fois.
        Survole un point pour le nom, clique pour ouvrir la fiche.</p>
      <svg class="graph" id="e-nuage" role="img" aria-label="Nuage de points"></svg>
    </div>`;

  const remplirCriteres = () => {
    const poste = exp.poste || "MC";
    const vars = variablesDisponibles(poste);
    $("#e-critere").innerHTML = `<option value="">Aucun</option>` +
      vars.map((v) => `<option value="${v.cle}"${v.cle === exp.critere ? " selected" : ""}>${
        v.libelle}</option>`).join("");
    ["#e-axe-x", "#e-axe-y"].forEach((s, k) => {
      const courant = k ? exp.axeY : exp.axeX;
      $(s).innerHTML = vars.map((v) => `<option value="${v.cle}"${
        v.cle === courant ? " selected" : ""}>${v.libelle}</option>`).join("");
    });
  };
  remplirCriteres();

  const maj = () => {
    exp.poste = $("#e-poste").value;
    exp.ligue = $("#e-ligue").value;
    exp.valeurMax = +$("#e-valeur").value;
    exp.ageMax = +$("#e-age").value;
    exp.minutesMin = +$("#e-minutes").value;
    exp.critere = $("#e-critere").value;
    exp.texte = $("#e-texte").value.trim();
    exp.axeX = $("#e-axe-x").value;
    exp.axeY = $("#e-axe-y").value;
    $("#e-v-age").textContent = exp.ageMax >= 45 ? "sans limite" : exp.ageMax + " ans";
    $("#e-v-min").textContent = entier(exp.minutesMin) + " min";
    remplirTableau();
    dessinerNuage();
  };
  ["#e-poste", "#e-ligue", "#e-valeur", "#e-critere", "#e-axe-x", "#e-axe-y"]
    .forEach((s) => $(s).addEventListener("change", () => {
      if (s === "#e-poste") { exp.poste = $("#e-poste").value; remplirCriteres(); }
      maj();
    }));
  ["#e-age", "#e-minutes"].forEach((s) => $(s).addEventListener("input", maj));
  $("#e-texte").addEventListener("input", maj);
  maj();
  animerEntree(zone);
}

function remplirTableau() {
  const liste = joueursFiltres();
  const poste = exp.poste || "MC";
  const ref = exp.critere ? trouverRef(poste, exp.critere) : null;

  const valeurTri = (j) => {
    if (exp.tri === "critere") return ref ? (lirePercentile(j, ref) ?? -1) : 0;
    const v = j[exp.tri];
    return v === null || v === undefined ? -Infinity : v;
  };
  const triees = liste.slice().sort((x, y) => {
    const a = valeurTri(x), b = valeurTri(y);
    if (typeof a === "string") return exp.sens * a.localeCompare(b, "fr");
    return exp.sens * (a - b);
  }).slice(0, 400);

  $("#e-compte").textContent =
    `${liste.length} joueurs correspondent` +
    (liste.length > 400 ? `, les 400 premiers sont affichés.` : ".");

  const colonnes = COLONNES.concat(ref
    ? [{ cle: "critere", titre: ref.libelle, type: "num" }] : []);
  $("#e-tableau").innerHTML = `<table><thead><tr>${colonnes.map((c) => `
      <th class="${c.type === "num" ? "num" : ""}" data-cle="${c.cle}"
        ${exp.tri === c.cle ? `aria-sort="${exp.sens < 0 ? "descending" : "ascending"}"` : ""}
      >${c.titre}</th>`).join("")}</tr></thead>
    <tbody>${triees.map((j) => `
      <tr data-nom="${echapper(j.n)}">
        <td><span class="mini">${imgJoueur(j, "", 26)}<b>${echapper(j.n)}</b>${j.er
          ? `<span class="reduit" title="Moins de ${DATA.seuil_reference} minutes">!</span>`
          : ""}</span></td>
        <td>${DATA.postes_libelle[j.p]}</td>
        <td>${echapper(j.c)}</td>
        <td class="num">${j.a ?? "–"}</td>
        <td class="num">${entier(j.m)}</td>
        <td class="num">${eurosCourt(j.v)}</td>
        <td class="num">${j.b}</td>
        <td class="num">${j.pd}</td>
        <td class="num">${nb(j.xg, 1)}</td>
        <td class="num">${nb(j.xa, 1)}</td>
        ${ref ? `<td class="num">${(() => {
          const p = lirePercentile(j, ref), v = lireVariable(j, ref);
          return `<span class="mini-barre"><i style="width:${p ?? 0}%;background:${
            couleurFamille(ref.famille) || C("a")}"></i></span> ${
            v === null || v === undefined ? "–" : nb(v, 2)}`;
        })()}</td>` : ""}
      </tr>`).join("")}</tbody></table>`;

  $$("#e-tableau th").forEach((th) => th.addEventListener("click", () => {
    const c = th.dataset.cle;
    if (exp.tri === c) exp.sens = -exp.sens;
    else { exp.tri = c; exp.sens = c === "n" || c === "c" || c === "p" ? 1 : -1; }
    remplirTableau();
  }));
  $$("#e-tableau tbody tr").forEach((tr) =>
    tr.addEventListener("click", () => voirJoueur(tr.dataset.nom)));
}

/* Nuage de points : deux percentiles, la population filtree, le joueur courant
   mis en avant s'il en fait partie. */
function dessinerNuage() {
  const svg = $("#e-nuage");
  svg.innerHTML = "";
  const W = 900, H = 460, m = { g: 52, d: 20, h: 18, b: 46 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const poste = exp.poste || "MC";
  const rx = trouverRef(poste, exp.axeX), ry = trouverRef(poste, exp.axeY);
  if (!rx || !ry) return;
  const liste = joueursFiltres().filter((j) =>
    lirePercentile(j, rx) !== null && lirePercentile(j, ry) !== null);
  if (!liste.length) {
    svgEl(svg, "text", { x: W / 2, y: H / 2, "text-anchor": "middle", fill: C("svg-faible"),
                         "font-size": 13 }, "aucun joueur dans cette sélection");
    return;
  }
  const X = (p) => m.g + (p / 100) * (W - m.g - m.d);
  const Y = (p) => H - m.b - (p / 100) * (H - m.h - m.b);

  [0, 25, 50, 75, 100].forEach((v) => {
    svgEl(svg, "line", { x1: X(v), y1: m.h, x2: X(v), y2: H - m.b,
      stroke: v === 50 ? C("case-vide-bord") : C("voile1"), "stroke-width": 1,
      "stroke-dasharray": v === 50 ? "4 4" : null });
    svgEl(svg, "line", { x1: m.g, y1: Y(v), x2: W - m.d, y2: Y(v),
      stroke: v === 50 ? C("case-vide-bord") : C("voile1"), "stroke-width": 1,
      "stroke-dasharray": v === 50 ? "4 4" : null });
    svgEl(svg, "text", { x: X(v), y: H - m.b + 15, "text-anchor": "middle",
                         "font-size": 9.5 }, v);
    svgEl(svg, "text", { x: m.g - 8, y: Y(v) + 3.5, "text-anchor": "end",
                         "font-size": 9.5 }, v);
  });
  svgEl(svg, "text", { x: (m.g + W - m.d) / 2, y: H - 10, "text-anchor": "middle",
    "font-size": 11.5, fill: C("svg-faible2") }, rx.libelle + " — percentile");
  svgEl(svg, "text", { x: 14, y: (m.h + H - m.b) / 2, "text-anchor": "middle",
    "font-size": 11.5, fill: C("svg-faible2"),
    transform: `rotate(-90 14 ${(m.h + H - m.b) / 2})` }, ry.libelle + " — percentile");

  liste.forEach((j, i) => {
    const px = lirePercentile(j, rx), py = lirePercentile(j, ry);
    const courant = etat.joueur && j.n === etat.joueur.n;
    const c = svgEl(svg, "circle", {
      cx: X(px), cy: Y(py), r: courant ? 7 : 3.4,
      fill: courant ? C("b") : C("a"),
      "fill-opacity": courant ? 0.95 : 0.34,
      stroke: courant ? C("surbrillance") : "none", "stroke-width": courant ? 2 : 0 });
    c.style.cursor = "pointer";
    c.dataset.bulle = `<b>${echapper(j.n)}</b><br><span>${echapper(j.c)} · ${
      DATA.postes_libelle[j.p]} · ${euros(j.v)}<br>${rx.libelle} : ${ordinal(px)}<br>${
      ry.libelle} : ${ordinal(py)}</span>`;
    c.addEventListener("click", () => voirJoueur(j.n));
    c.style.transformBox = "fill-box";
    c.style.transformOrigin = "center";
    if (!doux && liste.length < 900)
      c.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "none" }],
        { duration: 300, delay: Math.min(i * 1.6, 550), fill: "backwards",
          easing: "cubic-bezier(.22,.61,.36,1)" });
  });
}
