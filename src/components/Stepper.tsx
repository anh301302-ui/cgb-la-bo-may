"use client";

interface Step {
  id: number;
  label: string;
}

const STEPS: Step[] = [
  { id: 1, label: "Server" },
  { id: 2, label: "Bot" },
  { id: 3, label: "Tokens" },
  { id: 4, label: "Result" },
];

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full max-w-md mx-auto mb-14 px-4">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium
                  border transition-all duration-500 tracking-wide
                  ${
                    step.id < currentStep
                      ? "bg-ink-text text-ink-bg border-ink-text"
                      : step.id === currentStep
                      ? "border-ink-text text-ink-text"
                      : "border-ink-line text-ink-dim"
                  }
                `}
              >
                {step.id < currentStep ? "✓" : step.id}
              </div>
              <span
                className={`
                  text-[10px] uppercase tracking-[0.15em] hidden sm:block transition-colors duration-300
                  ${step.id === currentStep ? "text-ink-text" : "text-ink-dim"}
                `}
              >
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-3 bg-ink-line overflow-hidden">
                <div
                  className="h-full bg-ink-text transition-all duration-700 ease-out"
                  style={{ width: step.id < currentStep ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
