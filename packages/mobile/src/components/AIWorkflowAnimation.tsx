import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

export type WorkflowStep = 'modelling' | 'optimization' | 'gcode_generation';
export type WorkflowStepStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface WorkflowState {
  current_step: WorkflowStep;
  steps: {
    modelling: WorkflowStepStatus;
    optimization: WorkflowStepStatus;
    gcode_generation: WorkflowStepStatus;
  };
}

interface AIWorkflowAnimationProps {
  workflow: WorkflowState;
  className?: string;
}

const stepLabels: Record<WorkflowStep, { ko: string; en: string }> = {
  modelling: { ko: '모델링', en: 'Modelling' },
  optimization: { ko: '최적화', en: 'Optimization' },
  gcode_generation: { ko: 'G-Code 생성', en: 'G-Code Generation' },
};

const AIWorkflowAnimation: React.FC<AIWorkflowAnimationProps> = ({ workflow, className }) => {
  const steps: WorkflowStep[] = ['modelling', 'optimization', 'gcode_generation'];

  const getStepIndex = (step: WorkflowStep) => steps.indexOf(step);
  const currentStepIndex = getStepIndex(workflow.current_step);

  const getStepColor = (step: WorkflowStep): string => {
    const status = workflow.steps[step];
    if (status === 'completed') return 'bg-green-500';
    if (status === 'processing') return 'bg-primary';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted';
  };

  const getStepTextColor = (step: WorkflowStep): string => {
    const status = workflow.steps[step];
    if (status === 'completed') return 'text-green-500';
    if (status === 'processing') return 'text-primary';
    if (status === 'failed') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const renderStepIcon = (step: WorkflowStep) => {
    const status = workflow.steps[step];

    if (status === 'completed') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      );
    }

    if (status === 'processing') {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        >
          <Loader2 className="w-4 h-4 text-white" />
        </motion.div>
      );
    }

    if (status === 'failed') {
      return <span className="text-white text-sm font-bold">✕</span>;
    }

    return <span className="text-muted-foreground text-xs">{getStepIndex(step) + 1}</span>;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            {/* Step Circle */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepColor(step)} transition-colors duration-300`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {renderStepIcon(step)}
              </motion.div>

              {/* Step Label */}
              <motion.span
                className={`text-xs font-medium ${getStepTextColor(step)} transition-colors duration-300 text-center`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.1 }}
              >
                {stepLabels[step].ko}
              </motion.span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-muted mx-2 relative overflow-hidden" style={{ maxWidth: '60px' }}>
                {workflow.steps[steps[index]] === 'completed' && (
                  <motion.div
                    className="absolute inset-0 bg-green-500"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    style={{ transformOrigin: 'left' }}
                  />
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Progress Message */}
      <motion.div
        className="mt-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-sm text-muted-foreground">
          {workflow.steps.modelling === 'processing' && '3D 모델을 생성하고 있습니다...'}
          {workflow.steps.modelling === 'completed' && workflow.steps.optimization === 'processing' && '모델을 최적화하고 있습니다...'}
          {workflow.steps.optimization === 'completed' && workflow.steps.gcode_generation === 'processing' && 'G-Code를 생성하고 있습니다...'}
          {workflow.steps.gcode_generation === 'completed' && '모든 작업이 완료되었습니다!'}
        </div>

        {/* Animated Progress Dots */}
        {(workflow.steps.modelling === 'processing' ||
          workflow.steps.optimization === 'processing' ||
          workflow.steps.gcode_generation === 'processing') && (
          <div className="flex items-center justify-center gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AIWorkflowAnimation;
