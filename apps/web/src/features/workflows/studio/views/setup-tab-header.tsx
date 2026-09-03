"use client";

import { catalogTypeLabel } from "../model/setup-tab-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";

function CatalogBadge({ label }: Readonly<{ label?: string }>) {
  if (!label) {
    return null;
  }
  return <span className="cp-project-type-badge">{label}</span>;
}

export function SetupTabHeader({
  form,
  isExistingMode,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  isExistingMode: boolean;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  const title = isExistingMode ? "Add CI/CD to Existing Repo" : "Create Project";
  const dualShape = projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
      <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{title}</h2>
      {dualShape ? (
        <>
          <CatalogBadge
            label={catalogTypeLabel(projectCatalog.backendProjectTypes, form.backendProjectTypeId)}
          />
          <CatalogBadge
            label={catalogTypeLabel(projectCatalog.frontendProjectTypes, form.frontendProjectTypeId)}
          />
        </>
      ) : (
        <CatalogBadge label={projectCatalog.selectedProjectType?.label} />
      )}
    </div>
  );
}

export function CatalogLoadingNotice({ loading }: Readonly<{ loading: boolean }>) {
  if (!loading) {
    return null;
  }
  return (
    <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "0 0 1rem" }}>
      Loading project catalog…
    </p>
  );
}
