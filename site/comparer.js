/* Comparateur Player — la comparaison, seule vue de l'outil.
   Deux usages pour la meme machinerie. Trouver un remplacant : on donne un joueur
   et quatre contraintes, l'outil designe celui dont le style se rapproche le plus.
   Comparer deux joueurs : on les choisit tous les deux, y compris a des postes
   differents, le second etant alors mesure sur les criteres du premier. */

/* Les pistes, de la plus ressemblante a la moins ressemblante.

   Deux facons de chercher, selon qui pose la question. Un club qui compte veut le
   profil le plus proche parmi ceux qu'il peut payer : la contrainte de prix
   s'applique. Un club qui ne compte pas veut simplement le plus proche, et le
   prix ne doit alors rien filtrer du tout, pas meme ecarter les joueurs dont la
   valeur marchande est inconnue. */
function chercherJumeaux(cible, limite = 40) {
  const poids = poidsDe(cible.p);
  const plafond = plafondBudget();
  const quoi = etat.intention;
  // preparer une succession autorise les postes voisins : un jeune destine a
  // tenir un role l'occupe rarement deja
  const postes = quoi === "succession"
    ? [cible.p, ...(VOISINS[cible.p] || [])] : [cible.p];
  const liste = [];
  for (const poste of postes) {
    for (const j of parPoste[poste] || []) {
      if (j === cible) continue;
      // le plancher de minutes n'est pas un reglage : en dessous, les percentiles
      // ne mesurent plus un style mais le hasard de quelques ballons
      if (j.m < MINUTES_COMPARABLE) continue;
      if (plafond !== Infinity && (!j.v || j.v > plafond)) continue;
      if (etat.ligue && j.l !== etat.ligue) continue;
      if (etat.contratMax) {
        const mois = moisDeContrat(j);
        if (mois === null || mois > etat.contratMax) continue;
      }

      // les contraintes de l'intention, la ou l'utilisateur reglait quatre curseurs
      if (quoi === "remplacer" && cible.nv != null
          && (j.nv == null || j.nv < cible.nv - 10)) continue;
      if (quoi === "economie") {
        // cinq points de tolerance, sinon l'intention est un cul-de-sac pour les
        // joueurs du tout premier rang, que personne n'egale par definition
        if (cible.nv != null && (j.nv == null || j.nv < cible.nv - 5)) continue;
        if (!cible.v || !j.v || j.v >= cible.v) continue;
      }
      if (quoi === "succession") {
        if (j.a == null || j.a > 23) continue;
        const t = trajectoire(j);
        if (t && t.sens === "baisse") continue;
      }

      // un candidat d'un autre poste est juge sur les criteres du poste a pourvoir
      const horsPoste = poste !== cible.p;
      const vb = horsPoste ? vecteurDans(j, cible.p) : null;
      // changer un joueur de poste n'est jamais gratuit : a style egal, celui qui
      // occupe deja le role passe devant. Deux points suffisent a departager sans
      // ecraser un candidat nettement plus ressemblant.
      const malus = horsPoste ? 2 : 0;
      liste.push({ j, score: ressemblance(cible, j, poids, vb) - malus, horsPoste,
                   economie: (cible.v || 0) - (j.v || 0),
                   part: cible.v && j.v ? j.v / cible.v : null });
    }
  }
  liste.sort((x, y) => y.score - x.score);
  return { plafond, liste: liste.slice(0, limite) };
}

/* L'ecart de prix, dit dans le sens ou il tombe : le profil le plus proche peut
   parfaitement couter plus cher que celui qu'on remplace. */
function ecartPrix(cible, j) {
  if (!cible.v || !j.v) return null;
  const d = cible.v - j.v;
  if (d === 0) return { texte: "même valeur", detail: "", signe: 0 };
  return d > 0
    ? { texte: euros(d), detail: `économisés, soit ${Math.round((1 - j.v / cible.v) * 100)} % du prix`, signe: 1 }
    : { texte: euros(-d), detail: `de plus, soit ${Math.round((j.v / cible.v - 1) * 100)} % au-dessus`, signe: -1 };
}

/* Ce qui rapproche et ce qui separe les deux joueurs, famille par famille. */
/* Le nombre de variables que les deux joueurs portent tous les deux. Il vaut le
   nombre de variables du poste dans le cas courant, et chute des qu'un des deux
   vient d'un championnat que les sources ne documentent pas : annoncer trente-neuf
   variables quand la comparaison n'en a lu que treize serait faux. */
function communes(a, b) {
  const vb = vecteurDans(b, a.p);
  return varsJugees(a.p).filter((m) =>
    a.x[m.i] !== null && a.x[m.i] !== undefined
    && vb[m.i] !== null && vb[m.i] !== undefined).length;
}

function parFamille(a, b) {
  // on ne compare que les variables jugees au poste : citer la creation d'un
  // defenseur central alors que sa toile n'en porte pas la branche serait
  // incoherent avec tout le reste de la page
  const meta = varsJugees(a.p), vb = vecteurDans(b, a.p);
  const familles = {};
  meta.forEach((m) => {
    // une variable inconnue chez l'un des deux ne dit rien de leur ecart
    if (a.x[m.i] === null || a.x[m.i] === undefined) return;
    if (vb[m.i] === null || vb[m.i] === undefined) return;
    (familles[m.famille] = familles[m.famille] || [])
      .push(Math.abs(a.x[m.i] - vb[m.i]));
  });
  return Object.entries(familles)
    .filter(([, e]) => e.length)
    .map(([famille, e]) => ({
      famille,
      score: 100 - Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length) }))
    .sort((x, y) => y.score - x.score);
}

/* La trajectoire : le sens de la pente sur les dernieres saisons. Un joueur a
   niveau 85 qui monte et un joueur a 85 qui descend ne sont pas le meme dossier,
   c'est la premiere question que pose un recruteur. On lit la pente sur les
   minutes jouees, seule grandeur comparable d'une saison a l'autre quel que soit
   le poste : un joueur a qui l'on donne de plus en plus de temps progresse dans
   la hierarchie de son club. */
function trajectoire(j) {
  const s = saisonsDe(ficheDe(j)).filter((x) => x.min >= 500).slice(-4);
  if (s.length < 2) return null;
  const der = s[s.length - 1], avant = s.slice(0, -1);
  const moy = avant.reduce((t, x) => t + x.min, 0) / avant.length;
  const d = moy ? (der.min - moy) / moy : 0;
  return { saisons: s,
           sens: d > 0.2 ? "hausse" : d < -0.2 ? "baisse" : "stable",
           mot: d > 0.2 ? "en progression" : d < -0.2 ? "en recul" : "stable" };
}

/* La forme : ce que disent les derniers matchs de la saison. Un cumul annuel ne
   dit pas si le joueur jouait encore au moment ou on le regarde. */
function formeRecente(j, n = 6) {
  const m = matchsDe(ficheDe(j)).slice().sort((x, y) => (x.d < y.d ? -1 : 1)).slice(-n);
  if (!m.length) return null;
  return { n: m.length,
           titu: m.filter((x) => x.min >= 60).length,
           min: m.reduce((t, x) => t + x.min, 0),
           b: m.reduce((t, x) => t + x.b, 0),
           pd: m.reduce((t, x) => t + x.pd, 0) };
}

function carteJoueur(j, role, jumeau) {
  const logo = logoDe(j);
  return `<article class="carte-j${jumeau ? " jumeau" : ""}" data-nom="${echapper(j.n)}"
      tabindex="0" role="button" title="Ouvrir la fiche de ${echapper(j.n)}">
    <div class="tete">
      ${imgJoueur(j, "p")}
      <div style="min-width:0">
        <p class="role">${role}</p>
        <p class="nom">${echapper(j.n)}${j.er
          ? `<span class="reduit" title="Moins de ${DATA.seuil_reference} minutes">!</span>` : ""}</p>
        <p class="club">${logo
          ? `<img src="${logo}" alt="" data-retirer="1">` : ""}${
          echapper(j.c)} · ${echapper(j.l)}</p>
      </div>
    </div>
    ${(() => {
      // Le joueur vient d'un championnat que les sources du projet ne couvrent
      // pas. Dire lesquelles de ses familles manquent vaut mieux que de laisser
      // croire que la toile est complete.
      if (!j.dp) return "";
      const abs = famillesAbsentes(j);
      const trous = j.dt - j.dp;
      return `<p class="manque"><b>Hors des cinq grands championnats.</b>
        Ses chiffres viennent de la ${echapper(j.l)} et sont posés tels quels sur
        l'échelle des cinq grands championnats : ni convertis, ni corrigés de
        l'effet du club. À production égale, un joueur de ${echapper(j.l)} y paraît
        donc meilleur qu'il ne l'est.
        ${trous ? `${j.dp} variables renseignées sur les ${j.dt} de son poste.` : ""}
        ${abs.length ? `Rien sur ${abs.map((f) => f.toLowerCase()).join(", ")}.` : ""}</p>`;
    })()}
    <p class="prix">${euros(j.v)}</p>
    <p class="prix-lab">valeur au ${FIN_SAISON}</p>
    <dl class="infos">
      <dt>Poste</dt><dd>${DATA.postes_libelle[j.p]}</dd>
      <dt>Âge</dt><dd>${j.a ?? "–"} ans</dd>
      <dt>Nationalité</dt><dd>${echapper(j.na || "–")}</dd>
      <dt>Taille et pied</dt><dd>${echapper(j.t || "–")} · ${echapper(j.pi || "–")}</dd>
      <dt>Niveau dans son poste</dt><dd>${j.nv == null ? "–" : Math.round(j.nv)}</dd>
      <dt>Fin de contrat</dt><dd>${(() => {
        const f = finContrat(j), m = moisDeContrat(j);
        if (!f) return "–";
        // moins de douze mois : le joueur devient accessible sans indemnite,
        // c'est l'information la plus actionnable de toute la carte
        return m <= 12 ? `<b style="color:var(--b)">${f}</b>` : f;
      })()}</dd>
      <dt>Minutes</dt><dd>${entier(j.m)} (${j.mj} matchs)</dd>
      <dt>Buts / passes</dt><dd>${j.b} / ${j.pd}</dd>
      <dt>xG / ${LIB_XA}</dt><dd>${nb(j.xg, 1)} / ${nb(j.xa, 1)}</dd>
    </dl>
    ${(() => {
      const t = trajectoire(j), f = formeRecente(j);
      if (!t && !f) return "";
      return `<div class="suivi">
        ${t ? `<p class="suivi-l"><span class="pastille ${t.sens}"></span>
          <b>${t.mot}</b> · ${t.saisons.map((x) => `${x.s} ${entier(x.min)}′`).join(" · ")}</p>` : ""}
        ${f ? `<p class="suivi-l"><span class="pastille neutre"></span>
          <b>fin de saison</b> · ${f.titu} titularisation${f.titu > 1 ? "s" : ""} sur
          ${f.n} matchs, ${entier(f.min)}′${f.b + f.pd
            ? `, ${f.b} but${f.b > 1 ? "s" : ""} et ${f.pd} passe${f.pd > 1 ? "s" : ""}` : ""}</p>` : ""}
      </div>`;
    })()}
    </article>`;
}

/* En mode duo, la liste des pistes se reduit au seul joueur choisi. Le second est
   juge sur les criteres du premier : c'est ce qui permet de demander si un milieu
   pourrait tenir le role d'un ailier, et pas seulement de comparer deux joueurs
   du meme poste. */
function resultatDuo(a) {
  const b = etat.joueurB;
  if (!b || b === a) return { plafond: Infinity, duo: true, liste: [] };
  // un gardien et un joueur de champ n'ont pas les memes variables : la
  // comparaison n'aurait aucun sens
  if ((a.p === "GB") !== (b.p === "GB")) return { plafond: Infinity, duo: true, liste: [],
                                                  incompatible: true };
  return { plafond: Infinity, duo: true,
           liste: [{ j: b, score: ressemblance(a, b, poidsDe(a.p)),
                     economie: (a.v || 0) - (b.v || 0),
                     part: a.v && b.v ? b.v / a.v : null }] };
}

/* La liste de tous les joueurs, posee une fois dans le document et partagee par
   les deux champs de choix : 2691 options ne se reconstruisent pas a chaque
   redessin. */
function listeJoueurs() {
  if ($("#tous-les-joueurs")) return;
  const dl = document.createElement("datalist");
  dl.id = "tous-les-joueurs";
  dl.innerHTML = DATA.joueurs.slice()
    .sort((x, y) => x.n.localeCompare(y.n, "fr"))
    .map((j) => `<option value="${echapper(j.n)}">${echapper(j.c)} · ${
      DATA.postes_libelle[j.p]}</option>`).join("");
  document.body.appendChild(dl);
}

function dessinerComparer() {
  const zone = $("#vue-comparer"), a = etat.joueur;
  if (!a) { zone.innerHTML = `<p class="vide">Choisis un joueur dans la recherche.</p>`; return; }

  listeJoueurs();
  const res = enDuo() ? resultatDuo(a) : chercherJumeaux(a);
  etat.pistes = res.liste;
  if (!etat.jumeau || !res.liste.some((p) => p.j === etat.jumeau))
    etat.jumeau = res.liste.length ? res.liste[0].j : null;

  zone.innerHTML = `
    <div class="bloc" style="margin-top:0">
      <header>
        <h3>${enDuo() ? INTENTIONS.duo.titre
          : `${INTENTIONS[etat.intention].titre} : <b>${echapper(a.n)}</b>`}</h3>
      </header>
      <div class="intentions">
        ${Object.entries(INTENTIONS).map(([cle, o]) => `
          <label class="${cle === etat.intention ? "actif" : ""}">
            <input type="radio" name="intention" value="${cle}"
              ${cle === etat.intention ? "checked" : ""}>${o.titre}</label>`).join("")}
      </div>
      ${enDuo() ? "" : `<p class="rappel">${DATA.postes_libelle[a.p]} · ${a.a} ans ·
        niveau ${a.nv == null ? "–" : Math.round(a.nv)} · ${euros(a.v)}</p>`}
      <p class="dit">${INTENTIONS[etat.intention].dit}</p>
      ${enDuo() ? `
      <div class="duo-choix">
        <div>
          <label class="f" for="duo-a">Premier joueur</label>
          <input class="champ" id="duo-a" list="tous-les-joueurs" autocomplete="off"
                 value="${echapper(a.n)}" placeholder="Chercher un joueur">
        </div>
        <div>
          <label class="f" for="duo-b">Second joueur</label>
          <input class="champ" id="duo-b" list="tous-les-joueurs" autocomplete="off"
                 value="${etat.joueurB ? echapper(etat.joueurB.n) : ""}" placeholder="Chercher un joueur">
        </div>
      </div>` : `
      <div class="reglages">
        <div class="large">
          <label class="f" for="f-budget">Budget maximum <b id="v-budget"></b></label>
          <input type="range" id="f-budget" min="0" max="${SANS_LIMITE}" step="1"
                 value="${etat.budget}">
        </div>
        <div>
          <label class="f" for="f-ligue">Championnat</label>
          <select class="champ" id="f-ligue"></select>
        </div>
        <div>
          <label class="f" for="f-contrat">Fin de contrat</label>
          <select class="champ" id="f-contrat">
            <option value="0">Peu importe</option>
            <option value="12"${etat.contratMax === 12 ? " selected" : ""}>Dans 1 an ou moins</option>
            <option value="24"${etat.contratMax === 24 ? " selected" : ""}>Dans 2 ans ou moins</option>
          </select>
        </div>
      </div>`}
    </div>
    <div id="resultat-comparaison"></div>`;

  if (enDuo()) initChoixDuo(); else initReglages();
  $$("[name=intention]").forEach((r) => r.addEventListener("change", () => {
    // en passant en duo on garde la piste affichee comme second joueur :
    // l'utilisateur retrouve ce qu'il regardait
    if (r.value === "duo" && !etat.joueurB) etat.joueurB = etat.jumeau;
    etat.intention = r.value;
    etat.jumeau = r.value === "duo" ? etat.joueurB : null;
    dessinerComparer();
  }));
  dessinerResultat(a, res);
  animerEntree(zone);
}

function initChoixDuo() {
  const poser = (sel, quoi) => {
    const champ = $(sel);
    champ.addEventListener("change", () => {
      const j = parNom[champ.value.trim()];
      if (!j) { champ.value = (quoi === "a" ? etat.joueur : etat.joueurB)?.n || ""; return; }
      if (quoi === "a") etat.joueur = j; else etat.joueurB = j;
      etat.jumeau = etat.joueurB;
      dessinerComparer();
    });
  };
  poser("#duo-a", "a");
  poser("#duo-b", "b");
}

function initReglages() {
  $("#f-ligue").innerHTML = `<option value="">Tous les championnats</option>` +
    [...new Set(DATA.joueurs.map((j) => j.l))].sort()
      .map((l) => `<option${l === etat.ligue ? " selected" : ""}>${l}</option>`).join("");
  const maj = (redessiner) => {
    etat.budget = +$("#f-budget").value;
    etat.ligue = $("#f-ligue").value;
    etat.contratMax = +$("#f-contrat").value;
    $("#v-budget").textContent = etat.budget >= SANS_LIMITE
      ? "sans limite" : euros(PALIERS_BUDGET[etat.budget] * 1e6);
    if (redessiner) {
      etat.jumeau = null;
      const res = chercherJumeaux(etat.joueur);
      etat.pistes = res.liste;
      if (res.liste.length) etat.jumeau = res.liste[0].j;
      dessinerResultat(etat.joueur, res);
    }
  };
  $("#f-budget").addEventListener("input", () => maj(false));
  $("#f-budget").addEventListener("change", () => maj(true));
  $("#f-ligue").addEventListener("change", () => maj(true));
  $("#f-contrat").addEventListener("change", () => maj(true));
  maj(false);
}

function dessinerResultat(a, res) {
  const zone = $("#resultat-comparaison");
  if (!res.liste.length) {
    zone.innerHTML = res.duo
      ? (res.incompatible
        ? `<p class="vide">Un gardien et un joueur de champ ne se mesurent pas sur les mêmes
           variables.<br>Choisis deux joueurs de champ, ou deux gardiens.</p>`
        : `<p class="vide">Choisis un <b>second joueur</b> pour lancer la comparaison.</p>`)
      : `<p class="vide">Aucun ${DATA.postes_libelle[a.p].toLowerCase()} ne répond à cette
         situation.<br>Monte le budget, ouvre le championnat, ou change d'intention de
         recrutement.</p>`;
    return;
  }
  const piste = res.liste.find((p) => p.j === etat.jumeau) || res.liste[0];
  const b = piste.j;
  const familles = parFamille(a, b);
  const proches = familles.slice(0, 2).map((f) => f.famille.toLowerCase());
  const loin = familles[familles.length - 1].famille.toLowerCase();

  zone.innerHTML = `
    <div class="duo">
      ${carteJoueur(a, enDuo() ? "Premier joueur" : "Joueur de départ", false)}
      <div class="verdict">
        <div class="jauge" style="--p:${Math.max(0, Math.min(100, piste.score))}%">
          <span class="jauge-val">${piste.score.toFixed(1)}<i>%</i></span>
          <span class="jauge-lab">de ressemblance</span>
        </div>
        <p class="fleche">▼</p>
        ${(() => {
          const e = ecartPrix(a, b);
          if (!e) return `<p class="economie" style="color:var(--gris2)">valeur inconnue</p>`;
          const teinte = e.signe < 0 ? "color:var(--b)" : "";
          return `<p class="economie" style="${teinte}">${e.texte}
            <span>${e.detail}</span></p>`;
        })()}
      </div>
      ${carteJoueur(b, enDuo() ? "Second joueur" : "Le plus proche", true)}
    </div>

    <div class="synthese">
      ${res.duo
        ? `<b>${echapper(a.n)}</b> et <b>${echapper(b.n)}</b> se ressemblent à
           <b>${Math.round(piste.score)} %</b>${a.p === b.p ? "" :
           `, ${echapper(b.n)} étant mesuré sur les critères d'un ${
           DATA.postes_libelle[a.p].toLowerCase()}`}.`
        : piste.horsPoste
        ? `<b>${echapper(b.n)}</b>, aujourd'hui ${DATA.postes_libelle[b.p].toLowerCase()},
           est le profil le plus proche de ${echapper(a.n)} une fois replacé au poste de
           ${DATA.postes_libelle[a.p].toLowerCase()}.`
        : res.plafond === Infinity
        ? `Sur les ${DATA.postes_pluriel[a.p].toLowerCase()} des cinq championnats,
           <b>${echapper(b.n)}</b> est celui dont le style se rapproche le plus de
           ${echapper(a.n)}.`
        : `Parmi les ${DATA.postes_pluriel[a.p].toLowerCase()} à ${euros(res.plafond)} ou moins,
           <b>${echapper(b.n)}</b> est celui dont le style se rapproche le plus de
           ${echapper(a.n)}.`}
      Ce qui les rapproche : <b>${proches.join(" et ")}</b>.
      Ce qui les sépare le plus : <b>${loin}</b>.
      <br><span style="font-size:12.5px;color:var(--gris2)">Une ressemblance de
      ${Math.round(piste.score)} % signifie que les deux joueurs occupent des positions voisines
      sur les ${communes(a, b)} variables ${communes(a, b) === varsJugees(a.p).length
        ? "jugées à ce poste"
        : `que les deux ont en commun, sur les ${varsJugees(a.p).length} du poste`}.
      Elle ne dit pas qu'ils ont le même
      niveau : la toile décrit un style de jeu et un volume d'actions, pas la qualité
      d'exécution ni l'impact sur un match.</span>
    </div>

    <div class="bloc">
      <header>
        <h3>Les deux profils superposés</h3>
        <div class="segments">
          <label><input type="radio" name="mode-cmp" value="familles"
            ${etat.mode === "familles" ? "checked" : ""}>${
              famillesDe(a.p).length} familles</label>
          <label><input type="radio" name="mode-cmp" value="detail"
            ${etat.mode === "detail" ? "checked" : ""}>${
              communes(a, b)} variables</label>
        </div>
      </header>
      <p class="dit">${echapper(a.n)} est en trait plein, ${echapper(b.n)} en trait tireté :
        les deux se distinguent par la forme autant que par la couleur.
        ${echapper(b.n)} est situé dans la population des
        ${DATA.postes_pluriel[a.p].toLowerCase()}, même s'il occupe un autre poste, car
        comparer deux joueurs n'a de sens que si on les juge sur la même population.</p>
      <p class="dit" id="dit-toile-cmp"></p>
      <div class="radar-zone">
        <svg id="radar-cmp" role="img" aria-label="Toile des deux joueurs"></svg>
        <div class="familles-liste" id="familles-cmp"></div>
      </div>
    </div>

    <details${res.liste.length > 1 && !res.duo ? "" : " hidden"}>
      <summary>Les autres pistes (${res.liste.length - 1})</summary>
      <div class="corps"><div class="pistes" id="pistes"></div></div>
    </details>`;

  dessinerToile($("#radar-cmp"), a, b, etat.mode);
  $$("[name=mode-cmp]").forEach((r) => r.addEventListener("change", () => {
    etat.mode = r.value;
    dessinerToile($("#radar-cmp"), a, b, etat.mode);
  }));
  familleCmp(familles);
  dessinerPistes();
  $$(".carte-j").forEach((e) => {
    const aller = () => voirJoueur(e.dataset.nom);
    e.addEventListener("click", aller);
    e.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aller(); }
    });
  });
  lancerBarres(zone);
}

function familleCmp(familles) {
  $("#familles-cmp").innerHTML = familles.map((f) => `
    <div class="fam-l" data-bulle="<b>${echapper(f.famille)}</b><br><span>${
      echapper(DATA.familles_explications[f.famille] || "")}</span>">
      <span class="nom"><i style="background:${couleurFamille(f.famille)}"></i>${
        echapper(f.famille)}</span>
      <span class="barre"><i data-largeur="${Math.max(0, Math.round(f.score))}%"
        style="background:${couleurFamille(f.famille)}"></i></span>
      <span class="val" style="color:${f.score >= 80 ? "var(--pos)"
        : f.score <= 55 ? "var(--neg)" : "var(--gris)"}">${Math.round(f.score)}</span>
    </div>`).join("") +
    `<p class="dit" style="margin-top:9px">Ici 100 signifie deux joueurs identiques sur cette
      famille, pas un bon niveau. C'est un écart, pas une note.</p>`;
}

function dessinerPistes() {
  const zone = $("#pistes");
  if (!zone) return;
  zone.innerHTML = etat.pistes.map(({ j, score, part }, i) => `
    <div class="piste ${j === etat.jumeau ? "actif" : ""}" data-nom="${echapper(j.n)}"
         tabindex="0" role="button">
      <span class="rang">${i + 1}</span>
      ${imgJoueur(j, "")}
      <span class="piste-nom">${echapper(j.n)}${j.er
        ? `<span class="reduit" title="Moins de ${DATA.seuil_reference} minutes">!</span>` : ""}${
        j.dp ? `<span class="reduit hors" title="${echapper(j.l)}, hors des cinq grands championnats : percentiles non convertis">L2</span>` : ""}
        <em>${echapper(j.c)} · ${j.a} ans · ${DATA.postes_libelle[j.p]}</em></span>
      <span class="piste-prix">${euros(j.v)}<span>${
        part === null ? "" : part <= 1 ? `-${Math.round((1 - part) * 100)} %`
                                       : `+${Math.round((part - 1) * 100)} %`}</span></span>
      <span class="score" style="--s:${Math.max(0, (score - 55) * 2.2)}%">${score.toFixed(1)}</span>
    </div>`).join("");
  const activer = (e) => {
    etat.jumeau = etat.pistes.find((p) => p.j.n === e.currentTarget.dataset.nom).j;
    dessinerResultat(etat.joueur, { liste: etat.pistes,
      plafond: plafondBudget() });
    $("#resultat-comparaison").scrollIntoView({ behavior: doux ? "auto" : "smooth",
                                               block: "start" });
  };
  $$(".piste", zone).forEach((e) => {
    e.addEventListener("click", activer);
    e.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activer(ev); }
    });
  });
}

