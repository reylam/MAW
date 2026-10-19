import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowLeft, Mail, UserRound, ShieldCheck } from 'lucide-react';
import logo from '../assets/logo.png';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

/*
  Two-step operator sign-in:
    1. Email  → validated against the backend authorization list.
    2. Name   → the operator chooses a display name for the session.
  Only after both steps does the session become authenticated. Authorization
  is decided by the backend; no email list is hardcoded here.
*/
export default function Login() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);

  const [step, setStep] = useState('email'); // 'email' | 'name'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [operator, setOperator] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your operator email.');
      return;
    }
    // Light client-side format check; the backend is the authority.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.validateOperator(trimmed);
      setOperator(res.data);
      setName(''); // operator chooses their own display name
      setStep('name');
    } catch (err) {
      setError(err.message || 'Unable to validate this email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please tell us what to call you.');
      return;
    }
    signIn({ ...operator, name: trimmed });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-maw-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="MAW" className="h-10 mx-auto mb-3" />
          <div className="text-[10px] uppercase tracking-[0.18em] text-maw-text-subtle font-mono">
            Monitoring • Alert • Warning
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6" aria-hidden="true">
          <span className={`h-1 flex-1 rounded-full ${step === 'email' ? 'bg-maw-primary' : 'bg-maw-safe'}`} />
          <span className={`h-1 flex-1 rounded-full ${step === 'name' ? 'bg-maw-primary' : 'bg-maw-border'}`} />
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-maw bg-maw-critical-soft border border-maw-critical-border flex items-start gap-2.5"
          >
            <AlertCircle size={16} className="text-maw-critical shrink-0 mt-0.5" />
            <div className="text-sm text-maw-critical">{error}</div>
          </div>
        )}

        {step === 'email' && (
          <div>
            <h1 className="text-xl font-display font-semibold text-maw-text-main mb-1">Operator sign in</h1>
            <p className="text-sm text-maw-text-muted mb-6">
              Enter your authorized operator email to access the control room.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-maw-text-muted uppercase tracking-wider mb-1.5">
                  Operator email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-maw-text-subtle" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-maw-surface border border-maw-border rounded-maw text-sm text-maw-text-main placeholder:text-maw-text-subtle focus:outline-none focus:border-maw-primary transition-colors"
                    placeholder="operator@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-maw-primary hover:bg-maw-primary-hover text-white font-semibold text-sm rounded-maw transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'name' && (
          <div>
            <div className="mb-5 inline-flex items-center gap-2 text-sm text-maw-safe bg-maw-safe-soft border border-maw-safe-border rounded-maw px-3 py-2">
              <ShieldCheck size={16} /> Email authorized
            </div>
            <h1 className="text-xl font-display font-semibold text-maw-text-main mb-1">
              What should we call you, Operator?
            </h1>
            <p className="text-sm text-maw-text-muted mb-6">
              This name identifies you across the control room and on any manual actions you take.
            </p>
            <form onSubmit={handleNameSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-maw-text-muted uppercase tracking-wider mb-1.5">
                  Operator name
                </label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-maw-text-subtle" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-maw-surface border border-maw-border rounded-maw text-sm text-maw-text-main placeholder:text-maw-text-subtle focus:outline-none focus:border-maw-primary transition-colors"
                    placeholder="e.g. Reynaldo"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="py-2.5 px-4 border border-maw-border text-maw-text-muted font-semibold text-sm rounded-maw hover:bg-maw-hover transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-maw-primary hover:bg-maw-primary-hover text-white font-semibold text-sm rounded-maw transition-colors flex items-center justify-center gap-2"
                >
                  Enter control room <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-maw-border-subtle text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-maw-text-subtle font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-maw-safe" />
            System operational
          </div>
        </div>
      </div>
    </div>
  );
}
