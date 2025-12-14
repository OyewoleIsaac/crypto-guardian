import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Binance API symbols mapping
const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  USDT: "USDTUSDT", // USDT is 1:1 with USD
  ADA: "ADAUSDT",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: "symbols array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prices: Record<string, number> = {};

    // Fetch prices from Binance
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      
      // USDT is always 1:1 with USD
      if (upperSymbol === "USDT") {
        prices[upperSymbol] = 1;
        continue;
      }

      const binanceSymbol = BINANCE_SYMBOLS[upperSymbol];
      if (!binanceSymbol) {
        console.warn(`Unknown symbol: ${upperSymbol}`);
        continue;
      }

      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`
        );
        
        if (response.ok) {
          const data = await response.json();
          prices[upperSymbol] = parseFloat(data.price);
        } else {
          console.error(`Failed to fetch ${binanceSymbol}: ${response.status}`);
        }
      } catch (err) {
        console.error(`Error fetching ${binanceSymbol}:`, err);
      }
    }

    console.log("Fetched prices:", prices);

    return new Response(
      JSON.stringify({ prices, timestamp: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in crypto-prices function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});