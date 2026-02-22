import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { withErrorHandler } from '@/lib/api-errors';

// Cache the price for 1 hour
let priceCache: { price: PriceResponse; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface PriceResponse {
  amount: number;
  currency: string;
  formatted: string;
  interval: string;
  isFallback: boolean;
  error?: string;
}

function getFallbackPrice(error?: string): PriceResponse {
  return {
    amount: 1499, // $14.99 in cents
    currency: 'usd',
    formatted: '$14.99',
    interval: 'month',
    isFallback: true,
    ...(error && { error }),
  };
}

export const GET = withErrorHandler(async () => {
  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return NextResponse.json(priceCache.price);
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    // Return fallback price if not configured
    return NextResponse.json(getFallbackPrice());
  }

  try {
    // Fetch price from Stripe
    const price = await stripe.prices.retrieve(priceId);

    const priceData: PriceResponse = {
      amount: price.unit_amount || 2000,
      currency: price.currency,
      formatted: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: price.currency.toUpperCase(),
      }).format((price.unit_amount || 2000) / 100),
      interval: price.recurring?.interval || 'month',
      isFallback: false,
    };

    // Update cache
    priceCache = {
      price: priceData,
      timestamp: Date.now(),
    };

    return NextResponse.json(priceData);
  } catch (stripeError) {
    console.error('Stripe price fetch error:', stripeError);

    // Return fallback price if Stripe fails
    return NextResponse.json(getFallbackPrice('Using fallback price'));
  }
});