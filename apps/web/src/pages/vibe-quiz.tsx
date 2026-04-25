import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

const QUESTIONS: { q: string; choices: string[] }[] = [
  {
    q: 'Pick your weekend energy.',
    choices: ['Chill & cozy', 'Adventurous', 'Social butterfly', 'Creative flow'],
  },
  {
    q: 'Ideal first meet vibe?',
    choices: ['Coffee walk', 'Group activity', 'Live music', 'Workout class'],
  },
  {
    q: 'How spontaneous are you?',
    choices: ['Plan it all', 'Loose plan', 'Whatever happens', "Let's just go"],
  },
  {
    q: 'Pick a city moment.',
    choices: ['Sunrise hike', 'Rooftop sunset', 'Late-night bites', 'Farmers market'],
  },
];

export default function VibeQuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const choose = (choice: string) => {
    const next = [...answers, choice];
    setAnswers(next);
    if (step + 1 >= QUESTIONS.length) {
      setDone(true);
    } else {
      setStep(step + 1);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers([]);
    setDone(false);
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vibe Quiz</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your vibe is locked in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We&apos;ll use your answers to surface activities that match your energy.
            </p>
            <div className="flex flex-wrap gap-2">
              {answers.map((a, i) => (
                <span key={i} className="rounded-full border bg-muted px-3 py-1 text-xs">
                  {a}
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={reset} variant="outline" size="sm">
                Retake
              </Button>
              <Button asChild size="sm">
                <a href="/app/discovery">See activities</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = QUESTIONS[step];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vibe Quiz</h1>
        <p className="text-sm text-muted-foreground">
          Question {step + 1} of {QUESTIONS.length}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full bg-gradient-to-r from-primary to-purple-600 transition-all ${
            ['w-1/4', 'w-2/4', 'w-3/4', 'w-full'][step] ?? 'w-0'
          }`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{current.q}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {current.choices.map((c) => (
            <Button
              key={c}
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              onClick={() => choose(c)}
            >
              {c}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
