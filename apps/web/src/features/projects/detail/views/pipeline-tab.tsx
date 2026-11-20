'use client';

import './pipeline-tab.css';

import type { ProvisionedProject } from '@/features/projects';
import type { ProjectDetailTabsViewModel } from '../view-models/use-project-detail-tabs-view-model';
import { RunsTab } from './runs-tab';
import { WorkflowTab } from './workflow-tab';

/**
 * The Pipeline tab presents workflow execution and its configuration.
 */
export function PipelineTab({
  project,
  vm,
  dangerZone,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-pipeline"
      aria-labelledby="project-detail-tab-pipeline"
      className="pipeline-tab"
    >
      {vm.pipelineConfigurationAvailable && (
        <div
          className="pipeline-tab__views"
          role="group"
          aria-label="Pipeline view"
        >
          <button
            type="button"
            className="ghost-button"
            aria-pressed={vm.pipelineView === 'runs'}
            onClick={() => vm.setPipelineView('runs')}
          >
            Runs
          </button>
          <button
            type="button"
            className="ghost-button"
            aria-pressed={vm.pipelineView === 'configuration'}
            onClick={() => vm.setPipelineView('configuration')}
          >
            Configuration
          </button>
        </div>
      )}
      {vm.pipelineView === 'configuration' ? (
        <>
          <div className="pipeline-tab__head">
            <h2 className="pipeline-tab__name">Workflows</h2>
          </div>
          <WorkflowTab project={project} vm={vm} dangerZone={dangerZone} />
        </>
      ) : (
        <RunsTab project={project} vm={vm} />
      )}
    </div>
  );
}
