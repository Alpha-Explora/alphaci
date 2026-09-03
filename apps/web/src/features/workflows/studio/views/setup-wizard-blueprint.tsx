"use client";

import { HelpTip } from "@/shared/ui/help-tip";
import type { ProjectTypeOption, RepoShapeOption } from "@/shared/api/contracts";
import { isOfferedRepoShape, repoPrefixedPlaceholder } from "../model/setup-tab-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { labelAccentStyle } from "./setup-tab-shared";
import type { WizardStepProps } from "./setup-wizard-props";

function RecommendedPill() {
  return (
    <span style={{
      fontSize: "0.58rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--border-brand)",
      border: "1px solid var(--border-brand)",
      borderRadius: "999px",
      padding: "0.08rem 0.45rem",
    }}>
      Recommended
    </span>
  );
}

function ComingSoonPill() {
  return (
    <span style={{
      fontSize: "0.58rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      border: "1px solid var(--border)",
      borderRadius: "999px",
      padding: "0.08rem 0.45rem",
    }}>
      Coming soon
    </span>
  );
}

function RepoShapeOptionCard({
  disabled,
  onSelect,
  selected,
  shape,
}: Readonly<{
  disabled: boolean;
  onSelect: (id: string) => void;
  selected: boolean;
  shape: RepoShapeOption;
}>) {
  return (
    <label
      style={{
        position: "relative",
        display: "block",
        padding: "0.6rem 0.75rem",
        border: `1px solid ${selected ? "var(--border-brand)" : "var(--border)"}`,
        borderRadius: "8px",
        background: selected ? "color-mix(in srgb, var(--border-brand) 8%, transparent)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: shape.enabled ? 1 : 0.55,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <input
        type="radio"
        name="repo-shape"
        value={shape.id}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(shape.id)}
        style={{ position: "absolute", opacity: 0, inset: 0, margin: 0, cursor: "inherit" }}
      />
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: "0.94rem" }}>{shape.label}</strong>
        {shape.id === "standalone" ? <RecommendedPill /> : null}
        {!shape.enabled ? <ComingSoonPill /> : null}
      </span>
      {shape.description ? (
        <span style={{
          display: "block",
          color: "var(--text-muted)",
          fontSize: "0.72rem",
          lineHeight: 1.45,
          marginTop: "0.25rem",
        }}>
          {shape.description}
        </span>
      ) : null}
    </label>
  );
}

function RepoShapeFieldset({
  projectCatalog,
}: Readonly<{ projectCatalog: ProjectOptionsCatalogState }>) {
  const shapes = projectCatalog.allRepoShapes.filter(isOfferedRepoShape);
  return (
    <fieldset data-tour="repo-shape" style={{ border: "none", margin: "0 0 1.5rem", padding: 0, minInlineSize: "auto" }}>
      <legend className="input-label" style={{ ...labelAccentStyle, padding: 0 }}>
        Repository shape
      </legend>
      <div className="form-pair-row" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
        {shapes.map((shape) => (
          <RepoShapeOptionCard
            key={shape.id}
            shape={shape}
            selected={shape.id === projectCatalog.selectedRepoShapeId}
            disabled={!shape.enabled || projectCatalog.loadingProjectOptions}
            onSelect={projectCatalog.setSelectedRepoShapeId}
          />
        ))}
      </div>
    </fieldset>
  );
}

function StandaloneCatalogFields({
  projectCatalog,
}: Readonly<{ projectCatalog: ProjectOptionsCatalogState }>) {
  return (
    <div className="form-pair-row" style={{ gap: "1rem" }}>
      <div>
        <label className="input-label" htmlFor="project-type-select" style={labelAccentStyle}>
          Language / framework
        </label>
        <select
          id="project-type-select"
          value={projectCatalog.selectedProjectTypeId}
          onChange={(event) => projectCatalog.setSelectedProjectTypeId(event.target.value)}
          disabled={projectCatalog.loadingProjectOptions}
          className="premium-input"
        >
          {projectCatalog.projectTypesForShape.map((projectType) => (
            <option key={projectType.id} value={projectType.id}>
              {projectType.label}
            </option>
          ))}
        </select>
        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0.3rem 0 0", lineHeight: 1.4 }}>
          TypeScript • JavaScript
        </p>
      </div>

      <div>
        <label className="input-label" htmlFor="workflow-recipe-select" style={labelAccentStyle}>
          Workflow recipe
        </label>
        <select
          id="workflow-recipe-select"
          value={projectCatalog.selectedWorkflowRecipeId}
          onChange={(event) => projectCatalog.setSelectedWorkflowRecipeId(event.target.value)}
          disabled={projectCatalog.loadingProjectOptions}
          className="premium-input"
        >
          {projectCatalog.recipesForSelectedProject.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.label}
            </option>
          ))}
        </select>
        {projectCatalog.selectedWorkflowRecipe?.description ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.3rem 0 0", lineHeight: 1.5 }}>
            {projectCatalog.selectedWorkflowRecipe.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ServicePathField({
  help,
  id,
  onChange,
  placeholder,
  value,
}: Readonly<{
  help: string;
  id: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}>) {
  return (
    <>
      <label className="input-label" htmlFor={id} style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
        Service path
        <HelpTip text={help} />
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-input"
      />
    </>
  );
}

function ProjectTypeOptions({
  emptyId,
  emptyLabel,
  types,
}: Readonly<{
  emptyId: string;
  emptyLabel: string;
  types: ProjectTypeOption[];
}>) {
  return (
    <>
      {types.map((pt) => (
        <option key={pt.id} value={pt.id}>{pt.label}</option>
      ))}
      {types.length === 0 ? (
        <option value={emptyId}>{emptyLabel}</option>
      ) : null}
    </>
  );
}

function BackendServiceFields({
  form,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  return (
    <div className="service-pair-panel__service">
      <span className="service-pair-panel__service-title">Backend service</span>
      <label className="input-label" htmlFor="backend-project-type-select" style={{ ...labelAccentStyle, display: "block" }}>
        Language
      </label>
      <select
        id="backend-project-type-select"
        value={form.backendProjectTypeId}
        onChange={(event) => form.setBackendProjectTypeId(event.target.value)}
        disabled={projectCatalog.loadingProjectOptions}
        className="premium-input"
      >
        <ProjectTypeOptions
          types={projectCatalog.backendProjectTypes}
          emptyId="nestjs"
          emptyLabel="NestJS"
        />
      </select>
      <label className="input-label" htmlFor="backend-service-name" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
        Service name
      </label>
      <input
        id="backend-service-name"
        value={form.backendServiceName}
        onChange={(event) => form.setBackendServiceName(event.target.value)}
        placeholder={repoPrefixedPlaceholder(form.repoName, "backend", "my-app-backend")}
        className="premium-input"
      />
      {projectCatalog.isMicroservicesShape ? (
        <ServicePathField
          id="backend-service-path"
          value={form.backendServicePath}
          onChange={form.setBackendServicePath}
          placeholder="backend/"
          help="The folder inside the repository where the backend service's code lives. Build commands run from this path, and only changes under it trigger this service's pipeline."
        />
      ) : null}
    </div>
  );
}

function FrontendServiceFields({
  form,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  return (
    <div className="service-pair-panel__service">
      <span className="service-pair-panel__service-title">Frontend service</span>
      <label className="input-label" htmlFor="frontend-project-type-select" style={{ ...labelAccentStyle, display: "block" }}>
        Language
      </label>
      <select
        id="frontend-project-type-select"
        value={form.frontendProjectTypeId}
        onChange={(event) => form.setFrontendProjectTypeId(event.target.value)}
        disabled={projectCatalog.loadingProjectOptions}
        className="premium-input"
      >
        <ProjectTypeOptions
          types={projectCatalog.frontendProjectTypes}
          emptyId="nextjs"
          emptyLabel="Next.js"
        />
      </select>
      <label className="input-label" htmlFor="frontend-service-name" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
        Service name
      </label>
      <input
        id="frontend-service-name"
        value={form.frontendServiceName}
        onChange={(event) => form.setFrontendServiceName(event.target.value)}
        placeholder={repoPrefixedPlaceholder(form.repoName, "frontend", "my-app-frontend")}
        className="premium-input"
      />
      {projectCatalog.isMicroservicesShape ? (
        <ServicePathField
          id="frontend-service-path"
          value={form.frontendServicePath}
          onChange={form.setFrontendServicePath}
          placeholder="frontend/"
          help="The folder inside the repository where the frontend service's code lives. Build commands run from this path, and only changes under it trigger this service's pipeline."
        />
      ) : null}
    </div>
  );
}

function MultiRepoNotice({
  isMultiRepoShape,
  repoName,
}: Readonly<{ isMultiRepoShape: boolean; repoName: string }>) {
  if (!isMultiRepoShape) {
    return null;
  }
  if (!repoName) {
    return null;
  }
  return (
    <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.5rem 0 0.75rem", lineHeight: 1.5 }}>
      {`2 separate repos will be created: ${repoName}-be and ${repoName}-fe`}
    </p>
  );
}

function DualShapeCatalogFields({
  form,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  return (
    <>
      <MultiRepoNotice isMultiRepoShape={projectCatalog.isMultiRepoShape} repoName={form.repoName} />
      <section className="service-pair-panel" aria-labelledby="backend-frontend-service-heading">
        <div className="service-pair-panel__header">
          <div>
            <span className="cp-section-heading" id="backend-frontend-service-heading">Backend &amp; Frontend Service</span>
            <p className="helper-text">Configure the two services together. The backend uses Render and the frontend uses Vercel.</p>
          </div>
          <span className="service-pair-panel__badge">2 services</span>
        </div>

        <div className="service-pair-panel__grid" role="group" aria-label="Backend and frontend service settings">
          <BackendServiceFields form={form} projectCatalog={projectCatalog} />
          <FrontendServiceFields form={form} projectCatalog={projectCatalog} />
        </div>
      </section>
    </>
  );
}

function DualOrStandaloneCatalog({
  form,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  if (projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape) {
    return <DualShapeCatalogFields form={form} projectCatalog={projectCatalog} />;
  }
  return <StandaloneCatalogFields projectCatalog={projectCatalog} />;
}

export function SetupWizardBlueprint({ form, projectCatalog }: Readonly<WizardStepProps>) {
  return (
    <>
      <RepoShapeFieldset projectCatalog={projectCatalog} />
      <div>
        <DualOrStandaloneCatalog form={form} projectCatalog={projectCatalog} />
      </div>
    </>
  );
}
