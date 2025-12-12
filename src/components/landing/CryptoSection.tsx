import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const cryptos = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '₿',
    color: 'from-amber-500 to-orange-600',
    description: 'The original cryptocurrency',
  },
  {
    name: 'Tether',
    symbol: 'USDT',
    icon: '$',
    color: 'from-emerald-500 to-teal-600',
    description: 'Stable and secure',
  },
  {
    name: 'Cardano',
    symbol: 'ADA',
    icon: '₳',
    color: 'from-blue-500 to-indigo-600',
    description: 'Next-gen blockchain',
  },
];

export function CryptoSection() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Supported Cryptocurrencies
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Invest with
            <span className="text-gradient-primary"> Your Favorite Crypto</span>
          </h2>
          <p className="text-muted-foreground">
            We support multiple cryptocurrencies for maximum flexibility. Deposit with the crypto you prefer.
          </p>
        </div>

        {/* Crypto Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
          {cryptos.map((crypto, index) => (
            <div
              key={crypto.symbol}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border p-8 text-center hover:border-primary/30 transition-all duration-300 hover:shadow-xl animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Crypto Icon */}
              <div className={`inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${crypto.color} text-3xl font-bold text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                {crypto.icon}
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                {crypto.name}
              </h3>
              <p className="text-primary font-semibold mb-2">{crypto.symbol}</p>
              <p className="text-muted-foreground text-sm">
                {crypto.description}
              </p>

              {/* Decorative circle */}
              <div className={`absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${crypto.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/auth?mode=signup">
            <Button variant="hero" size="lg" className="gap-2">
              Start Investing Now
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
