import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">
                CryptoVest
              </span>
            </Link>
            <p className="text-background/70 max-w-md mb-6">
              Your trusted partner for secure cryptocurrency investments. 
              Professional management, transparent tracking, and maximum returns.
            </p>
            <p className="text-background/50 text-sm">
              © {new Date().getFullYear()} CryptoVest. All rights reserved.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-background/70 hover:text-background transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/auth" className="text-background/70 hover:text-background transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/auth?mode=signup" className="text-background/70 hover:text-background transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-display font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              <li>
                <span className="text-background/70">24/7 Live Support</span>
              </li>
              <li>
                <span className="text-background/70">FAQ</span>
              </li>
              <li>
                <span className="text-background/70">Terms of Service</span>
              </li>
              <li>
                <span className="text-background/70">Privacy Policy</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
