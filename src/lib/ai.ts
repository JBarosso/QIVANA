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

  const difficultyDescriptions = {
    easy: 'facile (culture populaire, références connues)',
    medium: 'moyen (connaissances intermédiaires, nuances)',
    hard: 'difficile (détails précis, références obscures)',
  };

  const universeDescriptions = {
    anime: 'animes japonais',
    manga: 'mangas japonais',
    comics: 'comics (Marvel, DC, etc.)',
    games: 'jeux vidéo',
    movies: 'films',
    series: 'séries TV',
    other: 'culture geek générale',
  };

  // Construire la section de contexte si des questions récentes sont fournies
  let contextSection = '';
  if (contextQuestions && contextQuestions.length > 0) {
    const contextExamples = contextQuestions.slice(0, 30).join('\n- ');
    contextSection = `\n\n⚠️ IMPORTANT - ÉVITE CES SUJETS/QUESTIONS :
Voici des exemples de questions déjà créées pour cet utilisateur dans cet univers. Génère des questions NOUVELLES et DIFFÉRENTES sur d'autres sujets, aspects ou angles d'approche :

- ${contextExamples}

Tu DOIS générer des questions sur des sujets COMPLÈTEMENT DIFFÉRENTS de ceux listés ci-dessus.`;
  }

  return `Tu es un expert en culture geek. Génère ${numberOfQuestions} questions de quiz sur l'univers "${universeDescriptions[universe]}" avec une difficulté "${difficultyDescriptions[difficulty]}".${contextSection}

RÈGLES STRICTES:
1. Chaque question doit avoir exactement 4 réponses possibles (A, B, C, D)
2. Une seule réponse correcte
3. Les 3 fausses réponses doivent être:
   - Plausibles (pas absurdes)
   - Du même univers
   - De longueur similaire
   - Pas trivialement fausses
4. Inclure une explication claire de 1-2 phrases
5. Questions variées (pas de répétitions)
6. ${contextQuestions && contextQuestions.length > 0 ? 'Questions NOUVELLES sur des sujets différents de ceux listés ci-dessus. ' : ''}RÉPONSE EN JSON STRICT (pas de markdown, pas de commentaires)

FORMAT JSON ATTENDU:
{
  "questions": [
    {
      "question": "Quelle est la question?",
      "choices": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correct_index": 0,
      "explanation": "Explication claire de la bonne réponse."
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
    easy: 'EASY: known by ~80% of fans - Culture populaire, personnages principaux, éléments iconiques, questions que la majorité peut répondre',
    medium: 'MEDIUM: requires solid knowledge (~40-60%) - Personnages secondaires, détails d\'intrigue, années de sortie, éléments moins évidents',
    hard: `HARD: EXPERT-LEVEL ONLY (~10-20% success rate expected)
    
    HARD QUESTION REQUIREMENTS:
    - Secondary knowledge, NOT the most famous facts
    - Structural, historical, or contextual facts
    - Cross-referenced information between works
    - Production anecdotes, behind-the-scenes facts
    - Precise dates, episode numbers, chapter numbers
    - Questions that only TRUE experts can answer confidently
    
    HARD ANTI-PATTERNS (FORBIDDEN):
    - The answer must NOT be inferable from the wording
    - The answer must NOT be a title/name explicitly hinted in the question
    - The question must NOT be solvable by common sense or elimination
    - NO surface-level trivia that casual fans would know
    
    HARD FACTUAL SAFETY (CRITICAL):
    - INTERNALLY VERIFY that the correct answer is 100% factually true
    - VERIFY that ALL wrong answers are factually false
    - If ANY doubt exists, DISCARD and generate another question
    - Iterate until valid - NEVER lower difficulty`,
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

  return `You are a professional TV quiz writer and editor.
Your role is to generate TV-quality quiz questions with zero frustration for players.

IMPORTANT LANGUAGE RULE:
- The entire output (questions, answers, clarifications) MUST be written in FRENCH.
- Use OFFICIAL FRENCH LOCALIZATIONS for names, places, spells, titles, and terms.
- Never mix English and French naming.
- Examples: "Hogwarts" → "Poudlard", "Severus Snape" → "Severus Rogue", "Ash Ketchum" → "Sacha"

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
STEP 2 — QUIZ GENERATION (ONLY IF ALLOWED)
==========================
Proceed ONLY if confidence >= 0.75.
Set mode = "quiz".

GENERAL RULES (CRITICAL):
1. NEVER reveal the correct answer inside the question.
   - No direct mention
   - No obvious synonym
   - No trivial clue

2. Each question must be:
   - Factually correct and verifiable
   - Non-ambiguous
   - Written in clear French

3. Answers:
   - Exactly 1 correct answer
   - 3 wrong but plausible answers
   - Wrong answers must belong to the same universe
   - The correct answer must be the ONLY correct one

4. Difficulty calibration:
   - ${difficultyCalibration[difficulty]}

5. No invented facts for real universes.
   - If uncertain, replace the question with another one.
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
      "explanation": "Brief explanation in French"
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
  
  // Température plus basse pour HARD (moins de créativité, plus de précision)
  const temperature = request.difficulty === 'hard' ? 0.5 : 0.8;

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
