import { ArrowUpRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import certConsultingLogo from '@/assets/logo-navy.jpg';
import kitechLogo from '@/assets/kitech-logo.png';

const SUPPORT_EMAIL = 'info@kitech-software.de';
const SUPPORT_SUBJECT = 'Frage zum Portal von cert consulting pane';
const DEVELOPER_NAME = 'KITech Software';
const DEVELOPER_URL = 'https://kitech-software.de';

const About = () => (
  <div className="mx-auto max-w-4xl space-y-5 p-4 animate-fade-in sm:space-y-6 sm:p-6 lg:p-8">
    <PageHeader title="Über diese Software" description="Das Portal, sein Entwickler und Ihr Weg zum Support." />

    <Card>
      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <img src={certConsultingLogo} alt="cert consulting pane" className="h-16 w-auto self-start sm:self-center" />
        <div className="hidden h-16 w-px shrink-0 bg-border sm:block" />
        <p className="text-[15px] leading-relaxed text-foreground/85">
          Dieses Portal bündelt die Arbeit rund um Zertifizierungen an einem Ort: Kunden und Zertifikate, Audits und
          Aufgaben, Fristen und Termine.
        </p>
      </CardContent>
    </Card>

    <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col p-6 sm:p-8">
          <p className="eyebrow text-primary">Support</p>
          <h2 className="mt-3 font-display text-[22px] font-medium leading-snug tracking-[-0.01em]">
            Fragen oder Anmerkungen?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Melden Sie sich gerne bei unserem Support-Team. Schreiben Sie uns einfach eine <span className="whitespace-nowrap">E-Mail</span>.
          </p>
          <div className="mt-auto pt-6">
            <Button asChild className="w-full sm:w-auto">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`}>
                <Mail />
                {SUPPORT_EMAIL}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col p-6 sm:p-8">
          <p className="eyebrow text-primary">Entwickelt von {DEVELOPER_NAME}</p>
          <img src={kitechLogo} alt={DEVELOPER_NAME} className="mt-3.5 h-9 w-auto self-start" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Wir verbinden bestehende Systeme, automatisieren Geschäftsprozesse und entwickeln individuelle Software dort,
            wo Standardlösungen nicht ausreichen.
          </p>
          <div className="mt-auto pt-6">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">
                kitech-software.de
                <ArrowUpRight />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default About;
