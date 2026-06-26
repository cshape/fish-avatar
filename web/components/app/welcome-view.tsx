import { type Language } from '@/app-config';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WelcomeViewProps {
  startButtonText: string;
  languages: Language[];
  language: string;
  onLanguageChange: (code: string) => void;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  languages,
  language,
  onLanguageChange,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref}>
      <section className="bg-background mx-auto flex max-w-prose flex-col items-center justify-center px-6 py-10 text-center">
        <h1 className="text-foreground text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
          Talk to a voice &amp; avatar agent
        </h1>

        <p className="text-muted-foreground mt-4 max-w-prose text-base leading-relaxed text-pretty md:text-lg">
          Meet Fish — a multilingual voice agent running Fish Audio&rsquo;s text-to-speech, with a
          real-time video avatar.
        </p>

        <p className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-base md:text-lg">
          <span>Hit start and say hi in</span>
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger
              aria-label="Conversation language"
              className="text-foreground hover:border-ring/60 h-auto w-auto gap-1 rounded-md border-transparent bg-transparent px-1.5 py-0.5 text-base font-medium shadow-none focus-visible:ring-[3px] md:text-lg"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </p>

        <Button
          size="lg"
          onClick={onStartCall}
          className="mt-8 w-64 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
        >
          {startButtonText}
        </Button>
      </section>
    </div>
  );
};
