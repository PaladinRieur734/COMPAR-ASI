CALCULETTE CRA ASI — VERSION DE TRAVAIL V2

Contenu : index.html, style.css, app.js. Déployer ces trois fichiers dans le dépôt GitHub Pages.

Fonctions présentes :
- formulaire de dossier CRA et période d’indu ;
- import local de SCAPIN (.docx ou PDF) et de la notification de payer (PDF) ;
- extraction du texte PDF/Word dans le navigateur et zones de contrôle ;
- reconnaissance indicative des lignes du décompte avec les colonnes mensualité / nouveau montant / déjà payé ;
- champs de montants PI applicables et génération des périodes de référence ;
- saisie/validation des ressources et plafonds par période ;
- calcul de travail des droits théoriques et de l’indu ;
- export CSV et annexe Word de travail ; export JSON des données.

IMPORTANT — LIMITES AVANT UTILISATION CRAMIF
1. Cette version est un prototype fonctionnel, pas un calculateur juridique validé. Les ressources SCAPIN sont extraites en texte mais ne sont pas encore converties automatiquement et fiablement en ressources trimestrielles : il faut les vérifier et renseigner/corriger les montants dans le tableau.
2. Le plafond trimestriel doit être renseigné pour chaque période ; aucune valeur de plafond n’est inventée. Les montants PI doivent être contrôlés.
3. La formule utilisée à titre de prototype est : droit ASI mensuel = max(0, plafond trimestriel - ressources trimestrielles après abattement) / 3 ; indu = max(0, montant payé - droit théorique). Cette formule et le traitement de chaque catégorie de ressources doivent être validés selon les règles et instructions internes CRAMIF avant usage réel.
4. La notification peut indiquer un « nouveau montant » et un « déjà payé » qui doivent être distingués. Le code ne prend pas « nouveau montant » comme étant automatiquement le montant payé.
5. L’annexe Word reprend certaines formulations des modèles CRA communiqués, mais n’en reproduit pas encore exactement la mise en page. Il faudra intégrer le modèle Word officiel et vérifier chaque formulation/branche (réduction ou suspension) avant usage.
6. PDF scannés sans couche texte nécessitent un OCR. Les bibliothèques PDF.js, Mammoth et html-docx-js sont chargées depuis des CDN : une connexion Internet est nécessaire. Les fichiers sélectionnés sont traités dans le navigateur ; le dépôt GitHub ne doit contenir aucun dossier nominatif.

Déploiement GitHub Pages : placer les 3 fichiers à la racine du dépôt, activer Settings > Pages > Deploy from a branch > main / root. Ne pas publier les fichiers d’assurés, des exemples réels ou des données de santé/sociales.
