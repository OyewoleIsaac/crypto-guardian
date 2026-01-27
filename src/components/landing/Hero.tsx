import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, TrendingUp, Zap } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-32">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/30 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(hsl(0 0% 100% / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground text-sm font-medium mb-8 animate-fade-in">
            <Zap className="h-4 w-4" />
            <span>Secure Crypto Investment Platform</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 animate-slide-up">
            Invest in
            <span className="block mt-2" style={{ background: 'linear-gradient(135deg, hsl(45 93% 47%) 0%, hsl(38 92% 50%) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Your Future
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Join thousands of investors growing their wealth with our secure cryptocurrency
            investment platform. Professional management, transparent tracking, maximum returns.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/auth?mode=signup">
              <Button variant="gold" size="xl" className="gap-2 w-full sm:w-auto">
                Start Investing
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="glass" size="xl" className="w-full sm:w-auto border-primary-foreground/30 hover:bg-primary-foreground/10">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-center gap-3 text-primary-foreground/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10 border border-primary-foreground/20">
                <Shield className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-primary-foreground">Bank-Grade Security</p>
                <p className="text-sm opacity-70">256-bit encryption</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 text-primary-foreground/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10 border border-primary-foreground/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-primary-foreground">High Returns</p>
                <p className="text-sm opacity-70">Expert-managed portfolio</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 text-primary-foreground/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10 border border-primary-foreground/20">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-primary-foreground">Instant Deposits</p>
                <p className="text-sm opacity-70">Multiple crypto options</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 120L48 110C96 100 192 80 288 70C384 60 480 60 576 65C672 70 768 80 864 85C960 90 1056 90 1152 85C1248 80 1344 70 1392 65L1440 60V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0Z" fill="hsl(220 25% 97%)" />
        </svg>
      </div>
    </section>
  );
}
