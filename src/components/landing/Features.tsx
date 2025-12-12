import { Bitcoin, DollarSign, Shield, BarChart3, Clock, Users } from 'lucide-react';

const features = [
  {
    icon: Bitcoin,
    title: 'Multi-Crypto Support',
    description: 'Deposit using Bitcoin, USDT, Cardano and more. Flexible investment options for every portfolio.',
  },
  {
    icon: Shield,
    title: 'Secure & Protected',
    description: 'Bank-grade security with encrypted transactions and secure cold storage for all digital assets.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Tracking',
    description: 'Monitor your investments 24/7 with our intuitive dashboard. Complete transparency at all times.',
  },
  {
    icon: DollarSign,
    title: 'Competitive Returns',
    description: 'Our expert team manages your portfolio for optimal growth. Professional investment strategies.',
  },
  {
    icon: Clock,
    title: 'Quick Processing',
    description: 'Fast deposit confirmations and efficient withdrawal processing. Your time is valuable.',
  },
  {
    icon: Users,
    title: 'Dedicated Support',
    description: '24/7 customer support to assist you with any questions or concerns about your investments.',
  },
];

export function Features() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            Why Choose Us
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Powerful Features for
            <span className="text-gradient-primary"> Smart Investors</span>
          </h2>
          <p className="text-muted-foreground">
            Everything you need to manage and grow your cryptocurrency investments with confidence.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary mb-6 group-hover:shadow-glow transition-shadow duration-300">
                <feature.icon className="h-7 w-7 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Decorative gradient */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
