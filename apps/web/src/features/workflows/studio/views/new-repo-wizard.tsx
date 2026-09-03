"use client";

import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { WIZARD_STEPS } from "./setup-tab-shared";
import { SetupWizardAutomation } from "./setup-wizard-automation";
import { SetupWizardBlueprint } from "./setup-wizard-blueprint";
import { SetupWizardDelivery } from "./setup-wizard-delivery";
import type { WizardStepProps } from "./setup-wizard-props";
import { SetupWizardRepository } from "./setup-wizard-repository";
import { SetupWizardReview } from "./setup-wizard-review";

function WizardProgressStep({
  activeStep,
  furthestStep,
  index,
  onSelect,
  ready,
  step,
}: Readonly<{
  activeStep: number;
  furthestStep: number;
  index: number;
  onSelect: (step: number) => void;
  ready: readonly boolean[];
  step: (typeof WIZARD_STEPS)[number];
}>) {
  const active = index === activeStep;
  const complete = index < activeStep || (index < furthestStep && ready[index]);
  const available = index <= furthestStep;
  const activeClass = active ? " is-active" : "";
  const completeClass = complete ? " is-complete" : "";
  const numberLabel = complete ? "✓" : String(index + 1);

  return (
    <button
      type="button"
      className={`repo-wizard-progress__step${activeClass}${completeClass}`}
      aria-current={active ? "step" : undefined}
      disabled={!available}
      onClick={() => onSelect(index)}
    >
      <span className="repo-wizard-progress__number" aria-hidden="true">{numberLabel}</span>
      <span className="repo-wizard-progress__copy"><strong>{step.label}</strong><small>{step.detail}</small></span>
    </button>
  );
}

export function RepositoryCreationProgress({
  activeStep,
  furthestStep,
  isExistingMode,
  onSelect,
  ready,
}: Readonly<{
  activeStep: number;
  furthestStep: number;
  isExistingMode: boolean;
  onSelect: (step: number) => void;
  ready: readonly boolean[];
}>) {
  if (isExistingMode) {
    return null;
  }

  return (
    <nav className="repo-wizard-progress" aria-label="Repository creation progress">
      {WIZARD_STEPS.map((step, index) => (
        <WizardProgressStep
          key={step.label}
          step={step}
          index={index}
          activeStep={activeStep}
          furthestStep={furthestStep}
          ready={ready}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

function WizardStepActions({
  activeWizardStep,
  currentStepReady,
  onBack,
  onNext,
}: Readonly<{
  activeWizardStep: number;
  currentStepReady: boolean;
  onBack: () => void;
  onNext: () => void;
}>) {
  const showBack = activeWizardStep > 0;
  const showContinue = activeWizardStep < WIZARD_STEPS.length - 1;
  return (
    <div className="repo-wizard-actions">
      {showBack ? (
        <button type="button" className="ghost-button" onClick={onBack}>Back</button>
      ) : (
        <span />
      )}
      {showContinue ? (
        <button
          type="button"
          className="primary-button"
          disabled={!currentStepReady}
          onClick={onNext}
        >
          Continue <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}

function wizardStepInitial(reducedMotion: boolean) {
  if (reducedMotion) {
    return false;
  }
  return { opacity: 0, y: 14, filter: "blur(4px)" };
}

function wizardStepExit(reducedMotion: boolean) {
  if (reducedMotion) {
    return undefined;
  }
  return { opacity: 0, y: -10, filter: "blur(3px)" };
}

const WIZARD_STEP_COMPONENTS: ComponentType<WizardStepProps>[] = [
  SetupWizardBlueprint,
  SetupWizardRepository,
  SetupWizardAutomation,
  SetupWizardDelivery,
  SetupWizardReview,
];

function WizardActiveStep({
  activeWizardStep,
  stepProps,
}: Readonly<{
  activeWizardStep: number;
  stepProps: WizardStepProps;
}>) {
  const Step = WIZARD_STEP_COMPONENTS[activeWizardStep];
  if (!Step) {
    return null;
  }
  return <Step {...stepProps} />;
}

export interface NewRepoWizardProps extends WizardStepProps {
  activeWizardStep: number;
  isExistingMode: boolean;
  onBack: () => void;
  onNext: () => void;
  reducedMotion: boolean;
  wizardStepReady: readonly boolean[];
}

export function NewRepoWizard({
  activeWizardStep,
  isExistingMode,
  onBack,
  onNext,
  reducedMotion,
  wizardStepReady,
  ...stepProps
}: Readonly<NewRepoWizardProps>) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isExistingMode ? null : (
        <motion.div
          key="new-repo-fields"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{ overflow: "hidden" }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`repository-wizard-step-${activeWizardStep}`}
              className="repo-wizard-step"
              initial={wizardStepInitial(reducedMotion)}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={wizardStepExit(reducedMotion)}
            >
              <WizardActiveStep activeWizardStep={activeWizardStep} stepProps={stepProps} />
              <WizardStepActions
                activeWizardStep={activeWizardStep}
                currentStepReady={Boolean(wizardStepReady[activeWizardStep])}
                onBack={onBack}
                onNext={onNext}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
