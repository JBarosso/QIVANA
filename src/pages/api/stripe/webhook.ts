// ============================================
// API: Stripe Webhook Handler
// ============================================

import type { APIRoute } from 'astro';
import { stripe, getPlanFromPriceId } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { getCreditsForPack } from '@/lib/ai-credits-config';

// Client Supabase avec service role pour bypasser RLS
const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`, { 
      status: 400 
    });
  }

  console.log(`📩 Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(`Webhook handler error: ${error instanceof Error ? error.message : 'Unknown'}`, {
      status: 500,
    });
  }
};

// ============================================
// HANDLERS
// ============================================

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const sessionType = session.metadata?.type;

  if (!userId) {
    console.error('Missing user ID in checkout session metadata');
    return;
  }

  // Vérifier si c'est un achat de pack de crédits
  if (sessionType === 'credit_pack') {
    const packType = session.metadata?.pack_type;
    
    if (!packType || !['starter', 'standard', 'pro'].includes(packType)) {
      console.error('Invalid pack type in checkout session');
      return;
    }

    console.log(`✅ Credit pack purchase completed for user ${userId}, pack: ${packType}`);

    // Récupérer le profil pour obtenir les crédits actuels
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('extra_ai_credits')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile for credit pack:', profileError);
      return;
    }

    // Calculer les crédits à ajouter
    const creditsToAdd = getCreditsForPack(packType as 'starter' | 'standard' | 'pro');
    const currentCredits = profile.extra_ai_credits || 0;

    // Incrémenter extra_ai_credits
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ extra_ai_credits: currentCredits + creditsToAdd })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating extra AI credits:', updateError);
      return;
    }

    // Logger l'achat dans ai_credit_purchases
    const { error: purchaseError } = await supabaseAdmin
      .from('ai_credit_purchases')
      .insert({
        user_id: userId,
        stripe_session_id: session.id,
        pack_type: packType,
        credits_purchased: creditsToAdd,
        amount_cents: session.amount_total,
      });

    if (purchaseError) {
      console.error('Error logging credit purchase:', purchaseError);
    }

    // Enregistrer le paiement
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent,
        stripe_subscription_id: null, // Pas d'abonnement pour les packs
        amount_cents: session.amount_total,
        currency: session.currency,
        plan: 'freemium', // Les packs ne changent pas le plan
        status: 'completed',
        paid_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
    }

    console.log(`🎉 User ${userId} purchased ${creditsToAdd} AI credits (${packType} pack)`);
    return;
  }

  // Sinon, c'est un abonnement (logique existante)
  const plan = session.metadata?.plan;
  const subscriptionId = session.subscription;

  if (!plan) {
    console.error('Missing plan in checkout session metadata');
    return;
  }

  console.log(`✅ Checkout completed for user ${userId}, plan: ${plan}`);

  // Mettre à jour le plan de l'utilisateur
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ plan: plan })
    .eq('id', userId);

  if (profileError) {
    console.error('Error updating profile:', profileError);
  }

  // Enregistrer le paiement
  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: userId,
      stripe_payment_intent_id: session.payment_intent,
      stripe_subscription_id: subscriptionId,
      amount_cents: session.amount_total,
      currency: session.currency,
      plan: plan,
      status: 'completed',
      paid_at: new Date().toISOString(),
    });

  if (paymentError) {
    console.error('Error recording payment:', paymentError);
  }

  console.log(`🎉 User ${userId} upgraded to ${plan}`);
}

async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  // Récupérer la subscription pour avoir le user ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.supabase_user_id;
  
  if (!userId) {
    console.error('No user ID in subscription metadata');
    return;
  }

  // Récupérer le plan depuis le price ID
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  if (plan) {
    // S'assurer que le plan est à jour
    await supabaseAdmin
      .from('profiles')
      .update({ plan: plan })
      .eq('id', userId);

    // Enregistrer le paiement récurrent
    await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        stripe_payment_intent_id: invoice.payment_intent,
        stripe_subscription_id: subscriptionId,
        amount_cents: invoice.amount_paid,
        currency: invoice.currency,
        plan: plan,
        status: 'completed',
        paid_at: new Date().toISOString(),
      });

    console.log(`💳 Invoice paid for user ${userId}, plan: ${plan}`);
  }
}

async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.supabase_user_id;
  
  if (!userId) return;

  console.log(`⚠️ Payment failed for user ${userId}`);

  // On pourrait envoyer un email ici
  // Pour l'instant, on log juste l'événement
  
  // Enregistrer le paiement échoué
  await supabaseAdmin
    .from('payments')
    .insert({
      user_id: userId,
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_subscription_id: subscriptionId,
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      plan: subscription.metadata?.plan || 'unknown',
      status: 'failed',
    });
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  
  if (!userId) {
    console.error('No user ID in subscription metadata');
    return;
  }

  console.log(`🔴 Subscription deleted for user ${userId}`);

  // Downgrade vers Freemium et nettoyer la date de fin
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      plan: 'freemium',
      subscription_end_date: null // Nettoyer la date de fin
    })
    .eq('id', userId);

  if (error) {
    console.error('Error downgrading user:', error);
  } else {
    console.log(`📉 User ${userId} downgraded to freemium`);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  
  if (!userId) return;

  // Récupérer le nouveau plan
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  // Gérer l'annulation programmée (cancel_at_period_end)
  if (subscription.cancel_at_period_end && subscription.cancel_at) {
    const endDate = new Date(subscription.cancel_at * 1000).toISOString();
    
    await supabaseAdmin
      .from('profiles')
      .update({ subscription_end_date: endDate })
      .eq('id', userId);

    console.log(`⏰ Subscription will end for user ${userId} on ${endDate}`);
    return;
  }

  // Si l'abonnement est réactivé (annulation annulée)
  if (!subscription.cancel_at_period_end && subscription.status === 'active') {
    await supabaseAdmin
      .from('profiles')
      .update({ 
        plan: plan,
        subscription_end_date: null // Réinitialiser la date de fin
      })
      .eq('id', userId);

    console.log(`🔄 Subscription reactivated for user ${userId}, plan: ${plan}`);
    return;
  }

  // Mise à jour normale du plan (changement de plan)
  if (plan && subscription.status === 'active') {
    await supabaseAdmin
      .from('profiles')
      .update({ plan: plan })
      .eq('id', userId);

    console.log(`🔄 Subscription updated for user ${userId}, new plan: ${plan}`);
  }
}
