import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Zap, 
  Thermometer, 
  Database, 
  FileText, 
  Shield, 
  Gauge,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const Landing = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      login();
    }
  };

  const features = [
    {
      icon: <Thermometer className="w-6 h-6" />,
      title: "Neher-McGrath Method",
      description: "Industry-standard steady-state temperature calculations with full methodology support"
    },
    {
      icon: <Gauge className="w-6 h-6" />,
      title: "IEC 60853 Compliance",
      description: "Emergency loading and transient analysis per international standards"
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Cable Library",
      description: "Pre-populated database with 50+ common cables from major manufacturers"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Ampacity Calculations",
      description: "Precise current-carrying capacity with mutual heating effects"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "PDF Reports",
      description: "Generate comprehensive thermal analysis reports with visualizations"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Ductbank Modeling",
      description: "Multi-duct arrangements with thermal interaction analysis"
    }
  ];

  const standards = [
    "Neher-McGrath (AIEE 1957)",
    "IEC 60853-1 & 60853-2",
    "NEC Article 310",
    "IEEE Std 835"
  ];

  return (
    <div className="min-h-screen bg-zinc-950 grid-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <span className="font-mono font-bold text-lg text-white">Thermal Tools</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-zinc-400 hover:text-cyan-400 transition-colors text-sm">Features</a>
              <a href="#standards" className="text-zinc-400 hover:text-cyan-400 transition-colors text-sm">Standards</a>
              {user ? (
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono text-sm"
                  data-testid="dashboard-btn"
                >
                  Dashboard
                </Button>
              ) : (
                <Button 
                  onClick={login}
                  className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono text-sm btn-glow"
                  data-testid="sign-in-btn"
                >
                  Sign In
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-6">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-cyan-400 text-xs font-mono uppercase tracking-wider">Professional Thermal Analysis</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
              Underground Cable
              <span className="block text-cyan-400 neon-text">Thermal Analysis</span>
            </h1>
            
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Calculate steady-state and transient temperatures using industry-standard 
              Neher-McGrath and IEC 60853 methods. Model direct burial and ductbank installations 
              with precision engineering tools.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                onClick={handleGetStarted}
                className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono uppercase tracking-wider btn-glow"
                data-testid="get-started-btn"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400 font-mono"
                onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                data-testid="learn-more-btn"
              >
                Learn More
              </Button>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none"></div>
            <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-xl p-6 max-w-4xl mx-auto neon-glow-subtle">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 font-mono uppercase mb-1">Max Temp</div>
                    <div className="text-2xl font-mono font-bold text-red-400">87.4°C</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 font-mono uppercase mb-1">Ampacity</div>
                    <div className="text-2xl font-mono font-bold text-cyan-400">645 A</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 font-mono uppercase mb-1">Derating</div>
                    <div className="text-2xl font-mono font-bold text-amber-400">0.89</div>
                  </div>
                </div>
                <div className="col-span-3 bg-zinc-800/30 rounded-lg p-4 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block relative">
                      {/* Simplified ductbank visualization */}
                      <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-700/30 rounded-lg border border-zinc-600">
                        {[...Array(9)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                              ${i % 3 === 1 ? 'border-cyan-500 bg-cyan-900/30' : 'border-zinc-600 bg-zinc-800'}`}
                          >
                            {i % 3 === 1 && <div className="w-6 h-6 rounded-full bg-amber-600/80"></div>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500 font-mono">3x3 Ductbank Configuration</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
              Professional Engineering Tools
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Everything you need for comprehensive underground cable thermal analysis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-lg p-6 card-interactive"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Standards Section */}
      <section id="standards" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-6">
                Industry Standards Compliance
              </h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Our calculation engine is validated against published benchmark problems and 
                complies with international standards for underground cable thermal analysis.
              </p>
              <ul className="space-y-3">
                {standards.map((standard, index) => (
                  <li key={index} className="flex items-center gap-3 text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                    <span className="font-mono text-sm">{standard}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-lg p-6">
              <div className="font-mono text-sm">
                <div className="text-zinc-500 mb-2">{`// Neher-McGrath Calculation`}</div>
                <div className="text-cyan-400">const</div>
                <div className="text-white ml-4">T₄ = (ρ / 2π) × ln(4L/D<sub>e</sub>)</div>
                <div className="text-zinc-500 mt-4 mb-2">{`// External Thermal Resistance`}</div>
                <div className="text-white ml-4">I<sub>max</sub> = √(Δθ / (R<sub>ac</sub> × T<sub>total</sub>))</div>
                <div className="text-zinc-500 mt-4 mb-2">{`// Ampacity at Max Temperature`}</div>
                <div className="mt-6 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Calculation accuracy</span>
                    <span className="text-emerald-400">±5% of benchmark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-6">
            Ready to Start Calculating?
          </h2>
          <p className="text-zinc-400 mb-8">
            Sign in with Google to access the full thermal analysis platform
          </p>
          <Button 
            size="lg"
            onClick={handleGetStarted}
            className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono uppercase tracking-wider btn-glow"
            data-testid="cta-get-started-btn"
          >
            {user ? 'Go to Dashboard' : 'Get Started Free'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="font-mono text-sm text-zinc-400">CableThermal AI</span>
            </div>
            <p className="text-xs text-zinc-500">
              Underground Cable Thermal Analysis Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
