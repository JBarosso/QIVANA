// ============================================
// API: Create Stripe Checkout Session
// ============================================

import type { APIRoute } from 'astro';
import { stripe, STRIPE_PRICES, CREDIT_PACK_PRICES } from '@/lib/stripe';
import { getCreditsForPack } from '@/lib/ai-credits-config';

export const POST: APIRoute = async ({ request, locals, url }) => {
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
    // Rediriger vers login si non connecté
    return new Response(JSON.stringify({ redirect: '/auth/login?redirect=/pricing' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { plan, billing, type, packType } = body;

    // Vérifier si c'est un achat de pack de crédits
    const isCreditPack = type === 'credit_pack';

    if (isCreditPack) {
      // Validation pour les packs de crédits
      if (!packType || !['starter', 'standard', 'pro'].includes(packType)) {
        return new Response(JSON.stringify({ error: 'Type de pack invalide' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('pseudo')
        .eq('id', user.id)
        .single();

      // Récupérer le Price ID Stripe pour le pack
      const priceId = CREDIT_PACK_PRICES[packType as keyof typeof CREDIT_PACK_PRICES];

      if (!priceId || priceId.includes('_test')) {
        return new Response(JSON.stringify({ 
          error: 'Configuration Stripe incomplète pour les packs de crédits.' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Chercher ou créer le Stripe Customer
      let customerId: string | undefined;
      
      const { data: paymentData } = await supabase
        .from('payments')
        .select('stripe_subscription_id')
        .eq('user_id', user.id)
        .not('stripe_subscription_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (paymentData?.stripe_subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(paymentData.stripe_subscription_id);
          customerId = subscription.customer as string;
        } catch (e) {
          // Subscription supprimée, on en crée un nouveau
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: profile?.pseudo || undefined,
          metadata: {
            supabase_user_id: user.id,
          },
        });
        customerId = customer.id;
      }

      // Créer la session Checkout pour un pack de crédits (one-time payment)
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment', // One-time payment, pas subscription
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${url.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${url.origin}/payment/cancel`,
        metadata: {
          supabase_user_id: user.id,
          type: 'credit_pack',
          pack_type: packType,
        },
        allow_promotion_codes: false,
        billing_address_collection: 'auto',
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sinon, c'est un abonnement (logique existante)
    // Validation
    if (!plan || !['premium', 'premium+'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Plan invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!billing || !['monthly', 'yearly'].includes(billing)) {
      return new Response(JSON.stringify({ error: 'Période de facturation invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('pseudo')
      .eq('id', user.id)
      .single();

    // Récupérer le Price ID Stripe
    const priceId = STRIPE_PRICES[plan as 'premium' | 'premium+'][billing as 'monthly' | 'yearly'];

    if (!priceId || priceId.includes('_test')) {
      return new Response(JSON.stringify({ 
        error: 'Configuration Stripe incomplète. Vérifiez les variables d\'environnement.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Chercher ou créer le Stripe Customer
    let customerId: string | undefined;
    
    // Vérifier si l'utilisateur a déjà un customer Stripe
    const { data: paymentData } = await supabase
      .from('payments')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .not('stripe_subscription_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentData?.stripe_subscription_id) {
      // Récupérer le customer depuis la subscription existante
      try {
        const subscription = await stripe.subscriptions.retrieve(paymentData.stripe_subscription_id);
        customerId = subscription.customer as string;
      } catch (e) {
        // Subscription supprimée, on en crée un nouveau
      }
    }

    if (!customerId) {
      // Créer un nouveau customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.pseudo || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${url.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/payment/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan: plan,
        billing: billing,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: plan,
        },
      },
      allow_promotion_codes: false, // Désactivé pour l'instant
      billing_address_collection: 'auto',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erreur lors de la création de la session' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
