# Radar Big 5 — scouting

**Démo en ligne : [naeldajani.github.io/personal-radar-big5](https://naeldajani.github.io/personal-radar-big5/)**

Outil de scouting sur les cinq grands championnats européens, saison 2024-2025. On cherche un
joueur, on ouvre sa fiche, et on lui cherche un jumeau statistique moins cher.

2 155 joueurs comparables · 59 variables de style · 42 352 tirs localisés.

## Le jumeau moins cher

On fixe un budget en pourcentage du prix du joueur et une ressemblance minimale. L'outil renvoie
le joueur du même poste le plus proche en style de jeu sous ce plafond.

Exemples à budget de 50 % :

| Joueur | Valeur | Jumeau le plus proche | Valeur | Ressemblance |
|---|---|---|---|---|
| Lamine Yamal | 200 M€ | Leroy Sané, Bayern Munich | 32 M€ | 78,0 % |
| Jude Bellingham | 180 M€ | Enzo Millot, Stuttgart | 35 M€ | 76,4 % |
| Erling Haaland | 180 M€ | Ollie Watkins, Aston Villa | 40 M€ | 77,8 % |
| Vitinha | 80 M€ | Yacine Adli, Fiorentina | 11 M€ | 76,8 % |
| William Saliba | 80 M€ | Calvin Bassey, Fulham | 25 M€ | 76,0 % |

Une ressemblance de 76 % veut dire un style et un volume d'actions voisins, pas le même niveau.
Le résultat sert à dresser une liste de joueurs à regarder, pas à conclure.

## Les trois écrans

- **Fiche** : valeur marchande, postes occupés, zones de touches, carte des tirs, percentiles.
- **Comparer** : le jumeau moins cher, avec les deux profils superposés famille par famille.
- **Explorer** : les 2 155 joueurs dans un tableau filtrable et un nuage de points.

## La méthode

1. **Agrégation** : les joueurs transférés en janvier ont leurs deux lignes additionnées, les
   taux recalculés à partir des totaux.
2. **Normalisation** à 90 minutes.
3. **Percentiles** à l'intérieur du poste (10 postes), échelle fixée par les joueurs à plus de
   450 minutes.
4. **Similarité** : distance euclidienne entre vecteurs de percentiles, pondérée par famille
   selon le poste. La finition pèse 1,5 pour un buteur, 0,4 pour un défenseur central.
5. **Appariement des sources** en plusieurs passes de tolérance croissante : 99,4 % des joueurs
   FBref retrouvés chez Transfermarkt, 2 121 sur 2 155 chez Understat.

## Sources

FBref (statistiques de match), Understat (tirs localisés, postes joués), Transfermarkt (postes
précis, valeur marchande). Les données collectées ne sont pas publiées dans ce dépôt, et la démo
n'affiche aucune photo.

## Limites

- La valeur marchande est une estimation Transfermarkt, pas un prix de transfert.
- Championnat uniquement, ni coupes ni Europe.
- Aucune correction de force de championnat : un percentile de Ligue 1 n'égale pas un
  percentile de Premier League.

## Contenu

```
scripts/   variables et poids par poste, fusion des sources et percentiles, construction du site
site/      le site (HTML, CSS, JavaScript sans bibliothèque)
docs/      la démo publiée, en un seul fichier
```
