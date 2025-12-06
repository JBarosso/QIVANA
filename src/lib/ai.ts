// ============================================
// AI MODULE - QIVANA
// ============================================
// Module modulaire pour générer des quiz via IA
// Providers supportés: OpenAI, Anthropic (Claude)

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

export interface AIQuizResponse {
  questions: AIQuizQuestion[];
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
 * Construit un prompt custom pour le mode "prompt libre"
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
  const difficultyDescriptions = {
    easy: 'facile (accessible, culture populaire)',
    medium: 'moyen (connaissances intermédiaires)',
    hard: 'difficile (expert, détails précis)',
  };

  // Construire la section de contexte si des questions récentes sont fournies
  let contextSection = '';
  if (contextQuestions && contextQuestions.length > 0) {
    const contextExamples = contextQuestions.slice(0, 20).join('\n- ');
    contextSection = `\n\n⚠️ IMPORTANT - ÉVITE CES SUJETS/QUESTIONS :
Voici des exemples de questions déjà créées. Génère des questions NOUVELLES et DIFFÉRENTES :

- ${contextExamples}

Tu DOIS générer des questions sur des sujets COMPLÈTEMENT DIFFÉRENTS.`;
  }

  return `Tu es un expert en culture geek. L'utilisateur demande le quiz suivant:

"${userPrompt}"

Génère ${numberOfQuestions} questions basées sur cette demande, avec une difficulté "${difficultyDescriptions[difficulty]}".${contextSection}

RÈGLES STRICTES:
1. Respecte EXACTEMENT la demande de l'utilisateur
2. Chaque question doit avoir exactement 4 réponses possibles (A, B, C, D)
3. Une seule réponse correcte
4. Les 3 fausses réponses doivent être plausibles
5. Inclure une explication claire de 1-2 phrases
6. Questions variées (pas de répétitions)
7. ${contextQuestions && contextQuestions.length > 0 ? 'Questions NOUVELLES sur des sujets différents. ' : ''}RÉPONSE EN JSON STRICT (pas de markdown, pas de commentaires)

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
 * Appel à OpenAI pour générer un quiz
 */
async function generateWithOpenAI(request: AIQuizRequest): Promise<AIQuizResponse> {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = buildPrompt(request);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: import.meta.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un générateur de quiz geek. Tu réponds UNIQUEMENT en JSON strict, sans markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
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
 * @param response - Unknown JSON response from AI (type-safe validation)
 */
export function validateAIResponse(response: unknown): AIQuizResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid AI response: not an object');
  }

  const responseObj = response as Record<string, unknown>;

  if (!Array.isArray(responseObj.questions)) {
    throw new Error('Invalid AI response: questions is not an array');
  }

  for (let i = 0; i < responseObj.questions.length; i++) {
    const q = responseObj.questions[i] as Record<string, unknown>;

    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`Question ${i}: missing or invalid question`);
    }

    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      throw new Error(`Question ${i}: choices must be an array of 4 strings`);
    }

    if (typeof q.correct_index !== 'number' || q.correct_index < 0 || q.correct_index > 3) {
      throw new Error(`Question ${i}: correct_index must be 0-3`);
    }

    if (!q.explanation || typeof q.explanation !== 'string') {
      throw new Error(`Question ${i}: missing or invalid explanation`);
    }
  }

  return response as unknown as AIQuizResponse;
}

/**
 * Fonction principale: génère un quiz via IA
 */
export async function generateQuiz(request: AIQuizRequest): Promise<AIQuizResponse> {
  const provider = request.provider || (import.meta.env.AI_PROVIDER as AIProvider) || 'openai';

  let response: AIQuizResponse;

  switch (provider) {
    case 'openai':
      response = await generateWithOpenAI(request);
      break;
    case 'anthropic':
      response = await generateWithAnthropic(request);
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  // Valider la réponse
  return validateAIResponse(response);
}
