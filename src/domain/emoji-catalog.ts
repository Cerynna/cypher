import { firstGrapheme, withoutPresentationSelector } from "./quick-commands";

export type EmojiEntry = { readonly emoji: string; readonly keywords: string };

export type EmojiCategory = { readonly name: string; readonly entries: readonly EmojiEntry[] };

const entry = (emoji: string, keywords: string): EmojiEntry => ({ emoji: withoutPresentationSelector(emoji), keywords });

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    name: "Dev et outils",
    entries: [
      entry("⚡", "eclair rapide lightning fast flash"),
      entry("🚀", "fusee deploy deployer lancer rocket launch release"),
      entry("🔨", "marteau build compiler hammer"),
      entry("🛠️", "outils tools fix reparer"),
      entry("🔧", "cle wrench config reglage"),
      entry("⚙️", "engrenage settings config parametres gear"),
      entry("🧪", "test tests eprouvette lab experiment"),
      entry("🐛", "bug insecte debug"),
      entry("🔍", "recherche loupe search find grep"),
      entry("🐳", "docker baleine whale container conteneur"),
      entry("📦", "paquet package npm yarn install colis"),
      entry("🧩", "plugin extension puzzle module"),
      entry("💻", "ordinateur laptop code computer"),
      entry("🖥️", "ecran serveur desktop monitor"),
      entry("⌨️", "clavier keyboard terminal"),
      entry("🗄️", "base de donnees database db archive"),
      entry("💾", "sauvegarde save disquette backup"),
      entry("🌐", "web internet reseau network globe"),
      entry("🔌", "prise plug connect api"),
      entry("🧹", "balai clean nettoyer lint"),
      entry("♻️", "recycler refresh reload refactor"),
      entry("🔄", "sync synchroniser rafraichir refresh restart"),
      entry("📜", "script parchemin log scroll"),
      entry("📝", "note memo ecrire write edit"),
      entry("📋", "presse papier clipboard copier liste"),
      entry("📊", "graphique stats metrics dashboard chart"),
      entry("📈", "hausse monitoring perf htop graph"),
      entry("🧭", "boussole navigation explorer compass"),
      entry("🗂️", "dossiers fichiers files folders"),
      entry("📁", "dossier folder"),
      entry("🔀", "branche merge git shuffle"),
      entry("🌿", "branche branch git feuille"),
      entry("🏷️", "etiquette tag label version"),
      entry("🧬", "adn data genome"),
      entry("🤖", "robot ia ai bot claude automation"),
      entry("🧠", "cerveau brain ia ai smart"),
      entry("☁️", "nuage cloud aws gcp azure"),
      entry("🔐", "cadenas login auth securite lock"),
      entry("🔑", "cle key ssh secret token"),
      entry("🛡️", "bouclier securite security shield"),
      entry("🚦", "feu ci pipeline status traffic"),
      entry("🧰", "boite a outils toolbox"),
    ],
  },
  {
    name: "Statut",
    entries: [
      entry("✅", "ok valide succes done check"),
      entry("❌", "erreur echec fail cross non"),
      entry("⚠️", "attention warning alerte"),
      entry("🚨", "alerte urgence alarm incident"),
      entry("🔥", "feu hot prod incident fire"),
      entry("🎯", "cible target objectif focus"),
      entry("⏱️", "chrono timer duree stopwatch"),
      entry("⏰", "reveil alarme cron schedule"),
      entry("⏳", "sablier attente wait pending"),
      entry("🟢", "vert green up ok rond"),
      entry("🟡", "jaune yellow warning rond"),
      entry("🔴", "rouge red down rond"),
      entry("🔵", "bleu blue rond"),
      entry("🟣", "violet purple rond"),
      entry("⭐", "etoile star favori"),
      entry("✨", "etincelles sparkles nouveau new"),
      entry("💡", "idee ampoule idea light"),
      entry("📌", "epingle pin important"),
      entry("🔔", "cloche notification bell"),
      entry("🏁", "drapeau arrivee finish fin"),
    ],
  },
  {
    name: "Objets",
    entries: [
      entry("☕", "cafe coffee pause"),
      entry("🍺", "biere beer"),
      entry("🎮", "jeu manette game"),
      entry("🎵", "musique music note"),
      entry("🎨", "peinture design art palette"),
      entry("📷", "photo camera screenshot"),
      entry("🎬", "film video clap"),
      entry("📡", "antenne signal satellite"),
      entry("🛰️", "satellite orbit"),
      entry("🧲", "aimant magnet"),
      entry("🔋", "batterie battery power"),
      entry("💰", "argent money cout billing"),
      entry("📮", "boite aux lettres mail courrier"),
      entry("📧", "email mail courriel"),
      entry("💬", "message chat discussion slack"),
      entry("📅", "calendrier calendar date"),
      entry("🧾", "recu facture receipt"),
      entry("🗑️", "poubelle trash supprimer delete"),
      entry("🔗", "lien link chaine"),
      entry("📎", "trombone attachment piece jointe"),
      entry("✂️", "ciseaux couper cut"),
      entry("🕹️", "joystick arcade"),
      entry("🏠", "maison home accueil"),
      entry("🏢", "bureau office entreprise work"),
      entry("🚚", "camion livraison delivery deploy"),
      entry("🧳", "valise voyage travel"),
      entry("🗝️", "vieille cle old key"),
      entry("🎁", "cadeau gift release"),
    ],
  },
  {
    name: "Nature",
    entries: [
      entry("🌙", "lune nuit moon night"),
      entry("☀️", "soleil sun jour day"),
      entry("🌈", "arc en ciel rainbow"),
      entry("❄️", "flocon froid neige snow freeze"),
      entry("🌊", "vague eau wave ocean"),
      entry("🌲", "sapin arbre tree"),
      entry("🌵", "cactus desert"),
      entry("🍀", "trefle chance luck"),
      entry("🌸", "fleur sakura cerisier blossom"),
      entry("🍄", "champignon mushroom"),
      entry("🐍", "serpent python snake"),
      entry("🦀", "crabe rust crab"),
      entry("🐘", "elephant php postgres"),
      entry("🦊", "renard fox firefox"),
      entry("🐧", "manchot linux penguin"),
      entry("🦄", "licorne unicorn"),
      entry("🐉", "dragon"),
      entry("🦉", "hibou chouette owl nuit"),
      entry("🐝", "abeille bee"),
      entry("🐙", "pieuvre octopus github"),
      entry("🦖", "dinosaure dino legacy"),
      entry("🐢", "tortue lent slow turtle"),
      entry("🐇", "lapin rapide rabbit"),
      entry("🐈", "chat cat"),
      entry("🐕", "chien dog"),
    ],
  },
  {
    name: "Symboles",
    entries: [
      entry("▶️", "play lancer start demarrer"),
      entry("⏸️", "pause"),
      entry("⏹️", "stop arreter"),
      entry("⏩", "avance rapide forward skip"),
      entry("🔁", "repeter repeat loop boucle"),
      entry("➕", "plus ajouter add"),
      entry("➖", "moins retirer remove"),
      entry("✖️", "multiplier fermer close"),
      entry("❓", "question aide help"),
      entry("❗", "exclamation important"),
      entry("💯", "cent parfait hundred"),
      entry("🔺", "triangle haut up"),
      entry("🔻", "triangle bas down"),
      entry("💠", "losange diamond"),
      entry("🔷", "losange bleu blue diamond"),
      entry("🔶", "losange orange diamond"),
      entry("🟩", "carre vert green square"),
      entry("🟥", "carre rouge red square"),
      entry("🟦", "carre bleu blue square"),
      entry("🟨", "carre jaune yellow square"),
      entry("⬆️", "fleche haut up arrow push"),
      entry("⬇️", "fleche bas down arrow pull download"),
      entry("↩️", "retour undo back rollback"),
      entry("🆕", "nouveau new"),
      entry("🆗", "ok"),
      entry("🔞", "interdit"),
      entry("♾️", "infini infinite"),
      entry("⚛️", "atome react atom"),
      entry("☢️", "radioactif danger"),
      entry("☠️", "crane danger kill tuer skull"),
    ],
  },
  {
    name: "Visages",
    entries: [
      entry("😎", "cool lunettes"),
      entry("🤓", "nerd geek"),
      entry("🥷", "ninja"),
      entry("🧙", "magicien wizard magie"),
      entry("👾", "alien space invader jeu"),
      entry("👻", "fantome ghost"),
      entry("💀", "crane skull mort"),
      entry("👀", "yeux regarder watch look"),
      entry("🙈", "singe cache-toi oops"),
      entry("🤯", "explosion mind blown"),
      entry("😴", "dodo sleep sommeil"),
      entry("🥳", "fete party celebrate"),
      entry("😈", "diable devil"),
      entry("🤡", "clown"),
      entry("👽", "extraterrestre alien"),
      entry("🦾", "bras robot mecanique"),
      entry("💪", "force muscle strong"),
      entry("👍", "pouce ok like"),
      entry("🙏", "merci priere please"),
      entry("👋", "salut hello bye"),
    ],
  },
];

const ALL_ENTRIES = EMOJI_CATEGORIES.flatMap((category) => category.entries);

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function isEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text);
}

export function searchEmojis(query: string): readonly EmojiEntry[] {
  const grapheme = firstGrapheme(query);
  const pasted = grapheme === undefined ? undefined : withoutPresentationSelector(grapheme);
  if (pasted !== undefined && isEmoji(pasted)) {
    return [ALL_ENTRIES.find((candidate) => candidate.emoji === pasted) ?? entry(pasted, "")];
  }
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ALL_ENTRIES;
  return ALL_ENTRIES.filter((candidate) => {
    const keywords = normalize(candidate.keywords).split(/\s+/);
    return words.every((word) => keywords.some((keyword) => keyword.startsWith(word)));
  });
}
