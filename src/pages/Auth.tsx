import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Lock, User, Smartphone, Loader2 } from 'lucide-react';
import certConsultingLogo from '@/assets/logo-navy.jpg';
import certConsultingLogoWhite from '@/assets/logo-white.png';
import AuthBackground from '@/components/AuthBackground';
import { z } from 'zod';
const emailSchema = z.string().email('Ungültige E-Mail-Adresse');
const passwordSchema = z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben');

const SUPPORT_EMAIL = 'info@kitech-software.de';
const DEVELOPER_URL = 'https://kitech-software.de';

const AuthShell = ({ children }: { children: ReactNode }) => (
  <div className="grid min-h-screen bg-card lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <aside className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
      <AuthBackground />
      <img src={certConsultingLogoWhite} alt="cert consulting pane" className="relative h-16 w-auto self-start" />
      <div className="relative max-w-lg">
        <h2 className="font-display text-[40px] font-medium leading-[1.15] tracking-[-0.01em]">
          Zertifizierungen, Audits und Fristen an einem Ort.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">
          Das Portal für die Audit-Planung und Kundenverwaltung von cert consulting pane.
        </p>
      </div>
      <p className="relative text-xs text-white/60">
        Software von{' '}
        <a
          href={DEVELOPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          KITech Software
        </a>
      </p>
    </aside>
    <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <p className="pt-8 text-center text-xs text-muted-foreground">
        Fragen zur Anmeldung?{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline-offset-4 hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </main>
  </div>
);

const AuthHeading = ({ title, description }: { title: string; description: string }) => (
  <div className="mb-7">
    <img src={certConsultingLogo} alt="cert consulting pane" className="mb-7 h-14 w-auto lg:hidden" />
    <h1 className="font-display text-[28px] font-medium leading-tight tracking-[-0.01em]">{title}</h1>
    <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
  </div>
);

export default function Auth() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaSetup, setMfaSetup] = useState(false);
  const [mfaQr, setMfaQr] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  useEffect(() => {
    // Check for existing session directly without context
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session?.user) {
        navigate('/');
      }
      setCheckingSession(false);
    });

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  if (checkingSession) {
    return (
      <AuthShell>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }
  const validateInputs = (isSignUp: boolean) => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (isSignUp && !fullName.trim()) {
        throw new Error('Name ist erforderlich');
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
      return false;
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(true)) return;
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const {
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });
    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'Diese E-Mail-Adresse ist bereits registriert.';
      }
      toast.error(message);
    } else {
      toast.success('Registrierung erfolgreich – Sie können sich jetzt anmelden.');
    }
    setLoading(false);
  };
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(false)) return;
    setLoading(true);
    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      if (error.message.includes('mfa')) {
        // MFA required
        setMfaRequired(true);
        setMfaFactorId(data?.session?.user?.factors?.[0]?.id || '');
      } else {
        toast.error('Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.');
      }
    }
    setLoading(false);
  };
  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode
    });
    if (error) {
      toast.error('Ungültiger Code. Bitte versuchen Sie es erneut.');
    }
    setLoading(false);
  };
  const handleSetupMfa = async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });
    if (error) {
      toast.error('MFA-Setup fehlgeschlagen: ' + error.message);
    } else if (data) {
      setMfaQr(data.totp.qr_code);
      setMfaFactorId(data.id);
      setMfaSetup(true);
    }
    setLoading(false);
  };
  const handleVerifyMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode
    });
    if (error) {
      toast.error('Ungültiger Code. Bitte versuchen Sie es erneut.');
    } else {
      toast.success('Zwei-Faktor-Authentifizierung wurde erfolgreich eingerichtet.');
      setMfaSetup(false);
      setMfaQr('');
      setMfaCode('');
    }
    setLoading(false);
  };
  if (mfaRequired) {
    return (
      <AuthShell>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <AuthHeading title="Zwei-Faktor-Authentifizierung" description="Geben Sie den Code aus Ihrer Authenticator-App ein" />
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Verifizierungscode</Label>
                <Input id="mfaCode" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className="text-center text-2xl tracking-widest" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Wird überprüft...' : 'Verifizieren'}
              </Button>
            </form>
      </AuthShell>
    );
  }
  if (mfaSetup) {
    return (
      <AuthShell>
        <AuthHeading title="MFA einrichten" description="Scannen Sie den QR-Code mit Ihrer Authenticator-App" />
          <div className="space-y-4">
            {mfaQr && <div className="flex justify-center">
                <img src={mfaQr} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-border/70 p-2" />
              </div>}
            <form onSubmit={handleVerifyMfaSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setupCode">Verifizierungscode</Label>
                <Input id="setupCode" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className="text-center text-2xl tracking-widest" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Wird überprüft...' : 'MFA aktivieren'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => {
              setMfaSetup(false);
              setMfaQr('');
              setMfaCode('');
            }}>
                Abbrechen
              </Button>
            </form>
          </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <AuthHeading title="Willkommen" description="Melden Sie sich an oder erstellen Sie ein Konto" />
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="register">Registrieren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginEmail">E-Mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input id="loginEmail" type="email" placeholder="name@firma.de" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input id="loginPassword" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Wird angemeldet...' : 'Anmelden'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Vollständiger Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input id="name" type="text" placeholder="Max Mustermann" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registerEmail">E-Mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input id="registerEmail" type="email" placeholder="name@firma.de" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registerPassword">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input id="registerPassword" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Wird registriert...' : 'Registrieren'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
    </AuthShell>
  );
}