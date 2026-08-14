'use client';

import { useFormStore } from '@/hooks/useFormStore';

const STEPS = [
  { number: 1, label: 'Operativo', icon: '📋' },
  { number: 2, label: 'Volumetría', icon: '📐' },
  { number: 3, label: 'Hallazgos', icon: '🔍' },
  { number: 4, label: 'CAD/Oficina', icon: '💼' },
  { number: 5, label: 'Archivos', icon: '📁' },
];

interface StepperProps {
  currentStep: number;
}

export function Stepper({ currentStep }: StepperProps) {
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="bg-white border-b border-border px-4 py-4 sticky top-14 z-30">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span className="font-medium text-primary">Paso {currentStep} de {STEPS.length}</span>
          <span>{STEPS[currentStep - 1]?.label}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;

          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`
                    ${isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-pending'}
                    transition-all duration-300
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-text-muted'}`}>
                      {step.number}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium hidden sm:block whitespace-nowrap transition-colors ${
                    isActive ? 'text-primary font-semibold' : isCompleted ? 'text-success' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 mt-[-1rem] transition-all duration-300"
                  style={{ backgroundColor: isCompleted ? '#10B981' : '#E2E8F0' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
