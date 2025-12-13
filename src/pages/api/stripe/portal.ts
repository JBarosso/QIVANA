// ============================================
// API: Stripe Customer Portal
// ============================================

import type { APIRoute } from 'astro';
import { stripe } from '@/lib/stripe';

export const POST: APIRoute = async ({ locals, url }) => {
  const supabase = (locals as any).supabase;

  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Vérifier auth
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Récupérer la dernière subscription de l'utilisateur pour trouver le customer ID
    const { data: paymentData } = await supabase
      .from('payments')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .not('stripe_subscription_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!paymentData?.stripe_subscription_id) {
      return new Response(JSON.stringify({ 
        error: 'Aucun abonnement trouvé. Souscrivez d\'abord à un plan.' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le customer ID depuis la subscription
    const subscription = await stripe.subscriptions.retrieve(paymentData.stripe_subscription_id);
    const customerId = subscription.customer as string;

    // Créer une session Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${url.origin}/profile`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Portal session error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erreur lors de la création de la session' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
