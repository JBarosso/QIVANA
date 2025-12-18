// ============================================
// API: Get Stripe Checkout Session Details
// ============================================
// Récupère les détails d'une session Stripe pour la page success

import type { APIRoute } from 'astro';
import { stripe } from '@/lib/stripe';
import { getCreditsForPack } from '@/lib/ai-credits-config';

export const GET: APIRoute = async ({ url, locals }) => {
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'session_id manquant' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Déterminer le type d'achat depuis les metadata
    const purchaseType = session.metadata?.type || 'subscription';
    const packType = session.metadata?.pack_type;

    let result: {
      type: 'subscription' | 'credit_pack';
      plan?: string;
      billing?: string;
      packType?: string;
      credits?: number;
      amount?: number;
    } = {
      type: purchaseType as 'subscription' | 'credit_pack',
    };

    if (purchaseType === 'credit_pack' && packType) {
      // C'est un achat de pack de crédits
      result.packType = packType;
      result.credits = getCreditsForPack(packType as 'starter' | 'standard' | 'pro');
      result.amount = session.amount_total ? session.amount_total / 100 : undefined; // Convertir de cents en euros
    } else {
      // C'est un abonnement
      result.plan = session.metadata?.plan;
      result.billing = session.metadata?.billing;
      result.amount = session.amount_total ? session.amount_total / 100 : undefined;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error retrieving Stripe session:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération de la session' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
