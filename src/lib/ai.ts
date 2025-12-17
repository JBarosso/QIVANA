// ============================================
// AI MODULE - QIVANA
// ============================================
// Module modulaire pour générer des quiz via IA
// Providers supportés: OpenAI, Anthropic (Claude)
// Implémente le système de clarification pour les prompts ambigus

import type { Universe, Difficulty } from './quiz';

export type AIProvider = 'openai' | 'anthropic';

export interface AIQuizRequest {
  universe: Universe;
  difficulty: Difficulty;
  numberOfQuestions: number;
  provider?: AIProvider;
  customPrompt?: string; // Pour le mode "prompt libre"
  contextQuestions?: string[]; // Questions récentes de l'utilisateur pour éviter les duplicates (20-50 questions)
}

export interface AIQuizQuestion {
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

// Modes de réponse possibles
export type AIResponseMode = 'quiz' | 'clarify' | 'error';

// Clarification proposée quand le prompt est ambigu
export interface AIClarification {
  label: string;
  theme: string;
  confidence: number;
}

// Réponse complète de l'IA (nouveau format avec mode)
export interface AIQuizResponse {
  mode: AIResponseMode;
  interpreted_theme?: string;
  confidence?: number;
  clarifications?: AIClarification[];
  questions: AIQuizQuestion[];
  error_message?: string;
}

// Validation du prompt côté serveur (pré-filtre)
export interface PromptValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Pré-filtre pour valider l'entrée utilisateur AVANT appel IA
 * Évite les appels inutiles pour des prompts invalides
 */
export function validatePromptPreFilter(prompt: string): PromptValidationResult {
  const trimmed = prompt.trim();
  
  // Minimum 6 caractères
  if (trimmed.length < 6) {
    return { isValid: false, error: 'Le prompt doit contenir au moins 6 caractères.' };
  }
  
  // Mots génériques seuls interdits
  const genericWords = ['film', 'anime', 'manga', 'jeu', 'serie', 'musique', 'quiz', 'question', 'test'];
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length === 1 && genericWords.includes(words[0])) {
    return { isValid: false, error: 'Sois plus précis ! Ajoute des détails sur le thème souhaité.' };
  }
  
  // Que des emojis, symboles ou nombres
  const onlySymbols = /^[\p{Emoji}\p{Symbol}\p{Number}\s]+$/u;
  if (onlySymbols.test(trimmed)) {
    return { isValid: false, error: 'Le prompt doit contenir du texte descriptif.' };
  }
  
  // Expressions vagues
  const vaguePatterns = [
    /^le truc$/i,
    /^je sais plus$/i,
    /^le film avec$/i,
    /^celui avec$/i,
    /^le machin$/i,
    /^n'importe quoi$/i,
  ];
  if (vaguePatterns.some(pattern => pattern.test(trimmed))) {
    return { isValid: false, error: 'Précise davantage le sujet de ton quiz.' };
  }
  
  return { isValid: true };
}

/**
 * Template de prompt pour génération de quiz
 * Strict JSON - pas de markdown, pas de commentaires
 * @param request - Requête avec contexte optionnel
 */
function buildPrompt(request: AIQuizRequest): string {
  const { universe, difficulty, numberOfQuestions, customPrompt, contextQuestions } = request;

  // Si un prompt custom est fourni, l'utiliser (mode prompt libre)
  if (customPrompt) {
    return buildCustomPrompt(customPrompt, difficulty, numberOfQuestions, contextQuestions);
  }

  const universeDescriptions = {
    anime: 'animes japonais',
    manga: 'mangas japonais',
    comics: 'comics (Marvel, DC, etc.)',
    games: 'jeux vidéo',
    movies: 'films',
    series: 'séries TV',
    other: 'culture geek générale',
  };

  // Calibration détaillée selon la difficulté
  const difficultyCalibration = {
    easy: `EASY (~80% de réussite attendue):
    - Culture populaire, personnages principaux, éléments iconiques
    - Questions que la majorité des fans peut répondre
    - Références connues du grand public`,
    
    medium: `MEDIUM (~40-60% de réussite attendue):
    - Personnages secondaires, détails d'intrigue
    - Années de sortie, éléments moins évidents
    - Connaissance approfondie mais pas experte`,
    
    hard: `HARD: NIVEAU EXPERT "GRAND QUIZ TV" (~10-20% de réussite)
    
    🚨 PROTOCOLE DE CERTITUDE ABSOLUE (PRIORITÉ MAX):
    ⚠️ INTERDICTION de générer une question si tu n'es pas CERTAIN à 100% du fait.
    Si doute sur un type, date, nom ou attribut → CHANGE DE SUJET immédiatement.
    La précision factuelle PRIME sur la difficulté.
    
    🎯 PROTOCOLE "PIVOT TECHNIQUE" (OBLIGATOIRE):
    - JAMAIS de question directe sur le sujet A
    - Utiliser un sujet B lié (contexte) pour faire deviner A
    - ⚠️ Le PIVOT ne modifie JAMAIS les propriétés intrinsèques (type, couleur, date)
    - Le PIVOT utilise le CONTEXTE (dresseur, apparition, numéro, relation)
    - Ex: Au lieu de "Type de X?", demander "Pokémon créé par Y partageant son type avec Z?"
    
    🎭 "NEAR-MISS DISTRACTORS" (OBLIGATOIRE):
    - Mauvaises réponses ultra-crédibles et proches
    - Dates à ±1 an, personnages de la même scène/arc
    - Même catégorie exacte que la bonne réponse
    
    📏 "BIAIS DE FORME" (OBLIGATOIRE):
    - Les 4 choix DOIVENT avoir une longueur similaire (±15%)
    - La bonne réponse ne doit PAS être identifiable par sa longueur
    
    📚 EXPLICATIONS EXPERT (AUTO-VÉRIFICATION):
    - OBLIGATOIRE: Source/référence explicite intégrée naturellement (ex: "Selon le Pokédex G2...", "D'après l'épisode 47...")
    - OBLIGATOIRE: Confirmer l'attribut clé de façon fluide (double vérification interne)
    - Expliquer directement les autres choix sans formule "étaient des pièges"
    
    FORMAT NATUREL:
    "La bonne réponse est X. Selon [source], [confirmation fluide de l'attribut clé]. Y est incorrect car [raison], Z parce que [raison], et W car [raison]."
    
    EXEMPLE CORRECT:
    "La bonne réponse est Mewtwo. D'après le Pokédex de Pokémon Rouge/Bleu, Mewtwo est de type Psy pur, créé artificiellement par manipulation génétique de Mew. Alakazam est aussi Psy pur mais il a évolué naturellement, Lucario est de type Combat/Acier, et Mew est le Pokémon originel de type Psy."
    
    🚫 ANTI-PATTERNS INTERDITS:
    - Réponse déductible de la formulation
    - Question résoluble par élimination
    - Trivia de surface que les fans casuals connaîtraient`,
  };

  // Construire la section de contexte si des questions récentes sont fournies
  let contextSection = '';
  if (contextQuestions && contextQuestions.length > 0) {
    const contextExamples = contextQuestions.slice(0, 30).join('\n- ');
    contextSection = `\n\n⚠️ QUESTIONS DÉJÀ POSÉES (à éviter absolument):
- ${contextExamples}

Tu DOIS générer des questions sur des sujets COMPLÈTEMENT DIFFÉRENTS.`;
  }

  return `Tu es un rédacteur professionnel de quiz TV de haut niveau, spécialisé dans les émissions culturelles françaises.

═══════════════════════════════════════════════════════════
🇫🇷 RÈGLE ABSOLUE - FRANÇAIS INTÉGRAL (NON NÉGOCIABLE)
═══════════════════════════════════════════════════════════
- L'INTÉGRALITÉ de l'output DOIT être en FRANÇAIS
- Utiliser EXCLUSIVEMENT les noms officiels de la VERSION FRANÇAISE (VF)
- JAMAIS de mélange anglais/français

EXEMPLES DE LOCALISATIONS:
- "Hogwarts" → "Poudlard" | "Severus Snape" → "Severus Rogue"
- "Ash Ketchum" → "Sacha" | "Attack on Titan" → "L'Attaque des Titans"
- Titres conservés en VO si officiels en France: "One Piece", "Death Note", "Game of Thrones"

═══════════════════════════════════════════════════════════
📋 MISSION
═══════════════════════════════════════════════════════════
Génère ${numberOfQuestions} questions de quiz sur l'univers "${universeDescriptions[universe]}".

DIFFICULTÉ DEMANDÉE:
${difficultyCalibration[difficulty]}
${contextSection}

═══════════════════════════════════════════════════════════
📏 RÈGLES STRICTES
═══════════════════════════════════════════════════════════
1. Exactement 4 réponses par question (A, B, C, D)
2. UNE SEULE réponse correcte
3. Les 3 fausses réponses DOIVENT être:
   - Plausibles et crédibles (pas absurdes)
   - Du même univers thématique
   - De LONGUEUR SIMILAIRE (±15% de caractères)
   - Pas trivialement fausses ou éliminables

4. ⚠️ CERTITUDE ABSOLUE REQUISE:
   - NE JAMAIS générer une question si tu n'es pas 100% certain
   - En cas de doute, ABANDONNER et générer une autre question
   - Qualité > Quantité

5. Explications OBLIGATOIRES (AUTO-VÉRIFICATION):
   - OBLIGATOIRE: Source/référence intégrée naturellement (Pokédex, épisode, manuel officiel...)
   - OBLIGATOIRE: Confirmer l'attribut clé de façon fluide (double vérification)
   - Expliquer directement les autres choix sans dire "étaient des pièges"
   - Format naturel: "La bonne réponse est X. Selon [source], [confirmation fluide]. Y est incorrect car [raison], Z parce que [raison]."

═══════════════════════════════════════════════════════════
📤 FORMAT JSON STRICT (pas de markdown)
═══════════════════════════════════════════════════════════
  {
  "questions": [
    {
      "question": "Question en français",
      "choices": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correct_index": 0,
      "explanation": "La bonne réponse est X. Selon [source], [confirmation fluide]. Y est incorrect car [raison], Z parce que [raison]."
    }
  ]
}

Génère maintenant ${numberOfQuestions} questions en JSON STRICT.`;
}

/**
 * Construit le prompt de production pour le mode Custom Quiz
 * Implémente le système de clarification avec score de confiance
 * Basé sur context-prompt-quiz.md
 * 
 * @param userPrompt - Prompt de l'utilisateur
 * @param difficulty - Difficulté
 * @param numberOfQuestions - Nombre de questions
 * @param contextQuestions - Questions récentes optionnelles (pour éviter duplicates)
 */
function buildCustomPrompt(
  userPrompt: string,
  difficulty: Difficulty,
  numberOfQuestions: number,
  contextQuestions?: string[]
): string {
  const difficultyCalibration = {
    easy: `EASY: connu par ~80% des fans
    - Culture populaire, personnages principaux, éléments iconiques
    - Questions que la majorité peut répondre
    - Références connues du grand public`,
    
    medium: `MEDIUM: nécessite des connaissances solides (~40-60%)
    - Personnages secondaires, détails d'intrigue
    - Années de sortie, éléments moins évidents
    - Connaissance approfondie mais pas experte`,
    
    hard: `HARD: NIVEAU EXPERT "GRAND QUIZ TV" (~10-20% de réussite attendue)

    ═══════════════════════════════════════════
    🚨 PROTOCOLE DE CERTITUDE ABSOLUE (PRIORITÉ MAX)
    ═══════════════════════════════════════════
    ⚠️ INTERDICTION FORMELLE DE GÉNÉRER UNE QUESTION SI TU N'ES PAS CERTAIN À 100% DU FAIT TECHNIQUE.
    
    Si tu as UN SEUL DOUTE sur:
    - Un type (Pokémon, élément, catégorie)
    - Une date (année, épisode, chapitre)
    - Un nom (personnage, lieu, technique)
    - Un attribut (couleur, taille, propriété)
    
    → CHANGE IMMÉDIATEMENT DE SUJET
    → NE TENTE PAS D'APPROXIMER
    → La précision factuelle PRIME sur la difficulté
    
    Exemple d'erreur à ÉVITER:
    ❌ "Quel est le type du Pokémon Mewtwo?" puis se tromper sur Psy/Combat
    ✅ Si doute → Passer à une autre question dont tu es CERTAIN à 100%

    ═══════════════════════════════════════════
    🎯 PROTOCOLE "PIVOT TECHNIQUE" (OBLIGATOIRE)
    ═══════════════════════════════════════════
    Tu ne dois JAMAIS poser une question directe sur le sujet A.
    Tu dois utiliser un sujet B lié pour faire deviner A.
    
    ⚠️ RÈGLE CRITIQUE DU PIVOT:
    Le PIVOT ne modifie JAMAIS les propriétés intrinsèques d'un objet.
    Le PIVOT utilise le CONTEXTE (dresseur, apparition, numéro, relation) pour complexifier.
    
    EXEMPLES DE PIVOT CORRECTS:
    ❌ INTERDIT: "Qui est l'auteur de One Piece?"
    ✅ CORRECT: "Quel ancien assistant de Nobuhiro Watsuki a créé un manga de pirates dépassant les 500 millions d'exemplaires?"
    → Le pivot utilise le contexte (assistant de Watsuki) sans modifier les faits
    
    ❌ INTERDIT: "Quel est le type de Mewtwo?"
    ✅ CORRECT: "Quel Pokémon créé par le Projet Mewtwo dans Pokémon Rouge/Bleu partage son type avec Alakazam?"
    → Le pivot utilise le contexte (Projet Mewtwo, lien avec Alakazam) sans modifier le type Psy
    
    ❌ INTERDIT: "Dans quel film apparaît Darth Vader?"
    ✅ CORRECT: "Quel film de 1977, initialement refusé par tous les studios sauf la Fox, a introduit un antagoniste dont le costume a été inspiré par les samouraïs japonais?"
    → Le pivot utilise le contexte historique sans modifier les faits sur le personnage

    ═══════════════════════════════════════════
    🎭 "NEAR-MISS DISTRACTORS" (OBLIGATOIRE)
    ═══════════════════════════════════════════
    Les 3 mauvaises réponses doivent être des pièges ultra-crédibles:
    - Chronologiquement proches (dates à ±1 an, même décennie)
    - Thématiquement liées (même œuvre, même studio, même période)
    - Même catégorie exacte (si la réponse est un réalisateur, les 3 autres aussi)
    - Personnages de la même scène ou arc narratif
    - Artistes du même mouvement ou label
    
    EXEMPLES:
    - Si la bonne réponse est "1997", proposer: 1996, 1998, 1995
    - Si la bonne réponse est "Vegeta", proposer: Piccolo, Gohan, Trunks (pas Goku, trop évident)
    - Si la bonne réponse est "Miyazaki", proposer: Takahata, Hosoda, Shinkai

    ═══════════════════════════════════════════
    📏 "BIAIS DE FORME" (OBLIGATOIRE)
    ═══════════════════════════════════════════
    Les 4 choix de réponse DOIVENT avoir une longueur similaire.
    - Écart maximum de 15% en nombre de caractères
    - La bonne réponse ne doit PAS être identifiable par sa longueur
    - Si la bonne réponse est longue, les distracteurs aussi
    - Si la bonne réponse est courte, les distracteurs aussi
    
    ❌ INTERDIT: ["Oui", "Non", "Le personnage créé par Stan Lee en 1962", "Peut-être"]
    ✅ CORRECT: ["Peter Parker", "Bruce Banner", "Tony Stark", "Steve Rogers"]

    ═══════════════════════════════════════════
    📚 EXPLICATIONS EXPERT (OBLIGATOIRE + AUTO-VÉRIFICATION)
    ═══════════════════════════════════════════
    Chaque explication DOIT contenir:
    1. Une SOURCE ou RÉFÉRENCE intégrée naturellement (ex: "Selon le Pokédex de la G2...", "D'après l'épisode 47...", "Le databook officiel confirme...")
    2. Une CONFIRMATION fluide des attributs mentionnés dans la question (double vérification interne)
    3. L'explication directe des autres choix sans utiliser la formule "étaient des pièges"
    
    FORMAT NATUREL ET FLUIDE:
    "La bonne réponse est X. Selon [source], [confirmation naturelle de l'attribut clé]. Y est incorrect car [raison], Z parce que [raison], et W car [raison]."
    
    EXEMPLE CORRECT:
    "La bonne réponse est Mewtwo. D'après le Pokédex de Pokémon Rouge/Bleu, Mewtwo est de type Psy pur, créé artificiellement par manipulation génétique de Mew. Alakazam est aussi Psy pur mais a évolué naturellement, Lucario est de type Combat/Acier, et Mew est le Pokémon originel sans manipulation."

    ═══════════════════════════════════════════
    🚫 ANTI-PATTERNS HARD (INTERDITS)
    ═══════════════════════════════════════════
    - La réponse ne doit PAS être déductible de la formulation
    - La réponse ne doit PAS être un titre/nom explicitement suggéré
    - La question ne doit PAS être résoluble par bon sens ou élimination
    - AUCUNE trivia de surface que les fans casuals connaîtraient
    - JAMAIS de question dont la réponse est "évidente" pour un fan moyen

    ═══════════════════════════════════════════
    ✅ VÉRIFICATION FACTUELLE (CRITIQUE)
    ═══════════════════════════════════════════
    - VÉRIFIER INTERNEMENT que la bonne réponse est 100% vraie
    - VÉRIFIER que TOUTES les mauvaises réponses sont fausses
    - En cas de DOUTE, ABANDONNER et générer une autre question
    - Itérer jusqu'à validation - NE JAMAIS baisser la difficulté`,
  };

  // Construire la section de contexte si des questions récentes sont fournies
  let contextSection = '';
  if (contextQuestions && contextQuestions.length > 0) {
    const contextExamples = contextQuestions.slice(0, 20).join('\n- ');
    contextSection = `

QUESTIONS DÉJÀ POSÉES À CET UTILISATEUR (à éviter absolument):
- ${contextExamples}

Tu DOIS générer des questions sur des sujets COMPLÈTEMENT DIFFÉRENTS de ceux listés ci-dessus.`;
  }

  return `Tu es un rédacteur professionnel de quiz TV de haut niveau, spécialisé dans les émissions culturelles françaises.
Ton rôle est de générer des questions dignes des plus grands quiz télévisés (Questions pour un Champion, Slam, Le Grand Quiz).

═══════════════════════════════════════════════════════════
🇫🇷 RÈGLE ABSOLUE - FRANÇAIS INTÉGRAL (NON NÉGOCIABLE)
═══════════════════════════════════════════════════════════
- L'INTÉGRALITÉ de l'output (questions, réponses, explications, thèmes) DOIT être en FRANÇAIS
- Utiliser EXCLUSIVEMENT les noms officiels de la VERSION FRANÇAISE (VF)
- JAMAIS de mélange anglais/français
- En cas de doute, privilégier la traduction française officielle

EXEMPLES DE LOCALISATIONS OBLIGATOIRES:
- "Hogwarts" → "Poudlard"
- "Severus Snape" → "Severus Rogue"  
- "Ash Ketchum" → "Sacha"
- "Attack on Titan" → "L'Attaque des Titans"
- "Death Note" → reste "Death Note" (titre officiel en France)
- "One Piece" → reste "One Piece" (titre officiel)
- "Fullmetal Alchemist" → reste "Fullmetal Alchemist"
- "Avengers" → "Les Vengeurs" (pour les personnages, pas le film)
- "Spider-Man" → "L'Homme-Araignée" (personnage historique VF)
- "Batman" → reste "Batman" (adopté en VF)
- "The Lord of the Rings" → "Le Seigneur des Anneaux"
- "Game of Thrones" → reste "Game of Thrones" (titre officiel)
- "Winterfell" → "Winterfell" (adopté en VF)

==========================
STEP 1 — USER INPUT ANALYSIS
==========================
Analyze the user's text input.
Determine the most likely intended quiz theme.

User input: "${userPrompt}"
Requested difficulty: ${difficulty}
Number of questions: ${numberOfQuestions}

Evaluate a confidence score (0.0 to 1.0) based on:
- Clarity of the user input
- Uniqueness of interpretation
- Factual verifiability
- Specificity for the requested difficulty

If confidence < 0.75:
- Do NOT generate any quiz questions
- Set mode = "clarify"
- Propose up to 3 clear, quiz-friendly theme interpretations IN FRENCH
- Each clarification must be specific and actionable

If the input is impossible to interpret:
- Set mode = "error"
- Provide a helpful error_message in French

==========================
ÉTAPE 2 — GÉNÉRATION DU QUIZ (SI AUTORISÉ)
==========================
Procéder UNIQUEMENT si confiance >= 0.75.
Définir mode = "quiz".

RÈGLES GÉNÉRALES (CRITIQUES):
1. NE JAMAIS révéler la bonne réponse dans la question.
   - Pas de mention directe
   - Pas de synonyme évident
   - Pas d'indice trivial

2. Chaque question DOIT être:
   - Factuellement correcte et vérifiable
   - Non-ambiguë
   - Rédigée en français clair et élégant

3. Réponses (RÈGLES STRICTES):
   - Exactement 1 bonne réponse
   - 3 mauvaises réponses PLAUSIBLES et CRÉDIBLES
   - Les mauvaises réponses DOIVENT appartenir au même univers
   - La bonne réponse doit être la SEULE correcte
   - TOUTES les réponses doivent avoir une LONGUEUR SIMILAIRE (±15% de caractères)

4. Calibration de difficulté:
   - ${difficultyCalibration[difficulty]}

5. AUCUN fait inventé pour les univers réels.
   - En cas d'incertitude, remplacer par une autre question.

6. EXPLICATIONS OBLIGATOIRES (FORMAT EXPERT + AUTO-VÉRIFICATION):
   - OBLIGATOIRE: Intégrer naturellement une SOURCE/RÉFÉRENCE (ex: "Selon le Pokédex...", "D'après l'épisode X...", "Le manuel officiel confirme...")
   - OBLIGATOIRE: Confirmer l'attribut clé de façon fluide (double vérification)
   - Expliquer directement les autres choix sans dire "étaient des pièges"
   - Format naturel: "La bonne réponse est X. Selon [source], [confirmation fluide]. Y est incorrect car [raison], Z parce que [raison]."
${contextSection}

==========================
QUALITY RULES (CRITICAL)
==========================
⚠️ ABSOLUTE RULE - 100% CERTAINTY REQUIRED:
- NEVER generate a question if you are not 100% certain of the correct answer
- If you have ANY doubt about a fact, SKIP that question and generate another one
- All answers must be verifiable facts, NOT assumptions or guesses
- Wrong answers in the database will destroy user trust - quality over quantity

OTHER QUALITY RULES:
- Write concise, punchy questions (TV style)
- Avoid repetitive phrasing
- No trick questions
- Avoid meaningless numeric questions
- Player experience is the top priority
- Include a brief explanation (1-2 sentences) for each answer

==========================
JSON OUTPUT FORMAT
==========================
Return ONLY valid JSON following this EXACT schema:

{
  "mode": "quiz | clarify | error",
  "interpreted_theme": "string describing what you understood (in French)",
  "confidence": 0.0 to 1.0,
  "clarifications": [
    {
      "label": "Short display label in French",
      "theme": "Detailed theme description in French",
      "confidence": 0.0 to 1.0
    }
  ],
  "questions": [
    {
      "question": "Question text in French",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "La bonne réponse est X. Selon [source], [confirmation fluide]. Y est incorrect car [raison], Z parce que [raison]."
    }
  ],
  "error_message": "Optional error message in French"
}

IMPORTANT:
- If mode = "quiz" → questions MUST be filled, clarifications MUST be empty array
- If mode = "clarify" → clarifications MUST be filled (max 3), questions MUST be empty array
- If mode = "error" → both arrays MUST be empty, error_message MUST be provided

Generate the response now.`;
}

/**
 * Sélectionne le modèle OpenAI en fonction de la difficulté
 * HARD utilise gpt-4o pour une meilleure qualité factuelle
 */
function selectOpenAIModel(difficulty: Difficulty): string {
  // Modèle par défaut depuis l'environnement
  const defaultModel = import.meta.env.OPENAI_MODEL || 'gpt-4o-mini';
  const hardModel = import.meta.env.OPENAI_MODEL_HARD || 'gpt-4o';
  
  // HARD utilise un modèle plus puissant pour éviter les hallucinations
  return difficulty === 'hard' ? hardModel : defaultModel;
}

/**
 * Appel à OpenAI pour générer un quiz
 * Utilise un modèle différent pour HARD (gpt-4o vs gpt-4o-mini)
 */
async function generateWithOpenAI(request: AIQuizRequest): Promise<AIQuizResponse> {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = buildPrompt(request);
  const model = selectOpenAIModel(request.difficulty);
  
  // Température optimisée selon la difficulté
  // HARD: 0.1 (déterminisme maximal, zéro hallucination)
  // EASY/MEDIUM: 0.7 (bon équilibre créativité/cohérence)
  const temperature = request.difficulty === 'hard' ? 0.1 : 0.7;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: request.difficulty === 'hard' 
            ? 'Tu es un expert en quiz de culture geek. Tu génères des questions de niveau EXPERT avec une précision factuelle absolue. Tu vérifies CHAQUE fait avant de le proposer. Tu réponds UNIQUEMENT en JSON strict, sans markdown.'
            : 'Tu es un générateur de quiz geek. Tu réponds UNIQUEMENT en JSON strict, sans markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: request.difficulty === 'hard' ? 3000 : 2000, // Plus de tokens pour HARD (itérations internes)
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from OpenAI');
  }

  // Parser le JSON
  const parsed = JSON.parse(content);
  return parsed as AIQuizResponse;
}

/**
 * Appel à Anthropic (Claude) pour générer un quiz
 */
async function generateWithAnthropic(request: AIQuizRequest): Promise<AIQuizResponse> {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = buildPrompt(request);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: import.meta.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) {
    throw new Error('No content returned from Anthropic');
  }

  // Parser le JSON (Claude peut wrapper en ```json)
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

  const parsed = JSON.parse(jsonString);
  return parsed as AIQuizResponse;
}

/**
 * Validation du JSON retourné par l'IA
 * Supporte les 3 modes: quiz, clarify, error
 * @param response - Unknown JSON response from AI (type-safe validation)
 */
export function validateAIResponse(response: unknown): AIQuizResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid AI response: not an object');
  }

  const responseObj = response as Record<string, unknown>;

  // Valider le mode
  const validModes: AIResponseMode[] = ['quiz', 'clarify', 'error'];
  const mode = responseObj.mode as AIResponseMode;
  
  if (!mode || !validModes.includes(mode)) {
    // Fallback pour compatibilité avec ancien format (sans mode)
    if (Array.isArray(responseObj.questions) && responseObj.questions.length > 0) {
      // Ancien format: juste des questions → on assume mode = 'quiz'
      return validateQuizQuestions(responseObj.questions as unknown[], {
        mode: 'quiz',
        interpreted_theme: 'Quiz généré',
        confidence: 1.0,
        clarifications: [],
        questions: [],
      });
    }
    throw new Error('Invalid AI response: missing or invalid mode');
  }

  // Construire la réponse de base
  const result: AIQuizResponse = {
    mode,
    interpreted_theme: typeof responseObj.interpreted_theme === 'string' ? responseObj.interpreted_theme : undefined,
    confidence: typeof responseObj.confidence === 'number' ? responseObj.confidence : undefined,
    clarifications: [],
    questions: [],
    error_message: typeof responseObj.error_message === 'string' ? responseObj.error_message : undefined,
  };

  // Validation selon le mode
  switch (mode) {
    case 'quiz':
      if (!Array.isArray(responseObj.questions) || responseObj.questions.length === 0) {
        throw new Error('Mode quiz requires non-empty questions array');
      }
      return validateQuizQuestions(responseObj.questions as unknown[], result);

    case 'clarify':
      if (!Array.isArray(responseObj.clarifications) || responseObj.clarifications.length === 0) {
        throw new Error('Mode clarify requires non-empty clarifications array');
      }
      // Valider les clarifications
      for (let i = 0; i < responseObj.clarifications.length; i++) {
        const c = responseObj.clarifications[i] as Record<string, unknown>;
        if (!c.label || typeof c.label !== 'string') {
          throw new Error(`Clarification ${i}: missing or invalid label`);
        }
        if (!c.theme || typeof c.theme !== 'string') {
          throw new Error(`Clarification ${i}: missing or invalid theme`);
        }
        result.clarifications!.push({
          label: c.label,
          theme: c.theme,
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.8,
        });
      }
      return result;

    case 'error':
      if (!result.error_message) {
        result.error_message = 'Impossible d\'interpréter cette demande.';
      }
      return result;

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * Valide les questions du quiz
 */
function validateQuizQuestions(questions: unknown[], result: AIQuizResponse): AIQuizResponse {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] as Record<string, unknown>;

    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`Question ${i}: missing or invalid question`);
    }

    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      throw new Error(`Question ${i}: choices must be an array of 4 strings`);
    }

    if (typeof q.correct_index !== 'number' || q.correct_index < 0 || q.correct_index > 3) {
      throw new Error(`Question ${i}: correct_index must be 0-3`);
    }

    // Explanation est optionnelle mais recommandée
    const explanation = typeof q.explanation === 'string' ? q.explanation : '';

    result.questions.push({
      question: q.question,
      choices: q.choices as string[],
      correct_index: q.correct_index,
      explanation,
    });
  }

  return result;
}

/**
 * Fonction principale: génère un quiz via IA
 * Applique les règles de qualité (cap HARD à 10 questions)
 */
export async function generateQuiz(request: AIQuizRequest): Promise<AIQuizResponse> {
  const provider = request.provider || (import.meta.env.AI_PROVIDER as AIProvider) || 'openai';

  // CAP HARD: Maximum 10 questions pour garantir la qualité
  // Selon context-quiz-ia-v2.md - HARD difficulty requires higher quality
  let effectiveRequest = { ...request };
  if (request.difficulty === 'hard' && request.numberOfQuestions > 10) {
    console.log(`🔴 HARD mode: capping questions from ${request.numberOfQuestions} to 10 for quality`);
    effectiveRequest.numberOfQuestions = 10;
  }

  let response: AIQuizResponse;

  switch (provider) {
    case 'openai':
      response = await generateWithOpenAI(effectiveRequest);
      break;
    case 'anthropic':
      response = await generateWithAnthropic(effectiveRequest);
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  // Valider la réponse
  return validateAIResponse(response);
}
