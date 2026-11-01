"use client";

import { useCallback, useState } from "react";

import type {
  CreateProjectRequest,
  EnvTargetSlot,
  MvpProjectOptionKey,
} from "@/shared/api/contracts";
import {
  buildCreateProjectPayload,
  sanitizeRepoNameInput,
} from "../model/create-project-payload";
import {
  ENVIRONMENT_TEMPLATE,
  type EnvironmentDraft,
} from "../model/project-environments-rules";
import { effectiveDualServiceName } from "../model/setup-tab-rules";
import { toSlug } from "../model/workflow-studio-rules";

interface BuildPayloadInput {
  /** null when the repository joins an existing Project (no name is sent). */
  projectName: string | null;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
  ownerType?: "personal" | "organization";
  installationId?: number;
  deploymentProvisioning?: CreateProjectRequest["deploymentProvisioning"];
  /** The project's own environments, sent only with on-prem hosting. */
  environments?: readonly EnvironmentDraft[];
  /** The deployable slots, only when the deployment offers on-prem hosting. */
  onpremSlots?: readonly EnvTargetSlot[];
}

export function useCreateProjectForm() {
  // Typed as-is: never derived from the repository or service names, and
  // never rewritten. Trimming happens when the payload is built.
  const [projectName, setProjectNameState] = useState("");
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [repoName, setRepoNameState] = useState("");
  const [visibility, setVisibility] = useState<CreateProjectRequest["visibility"]>("private");
  const [serviceName, setServiceNameState] = useState("");
  const [servicePath, setServicePath] = useState(".");
  const [nodeVersion, setNodeVersion] = useState("24");
  const [coverageThreshold, setCoverageThreshold] = useState("80");
  const [outputFileName, setOutputFileName] = useState("ci.yml");
  const [serviceNameTouched, setServiceNameTouched] = useState(false);
  // The fixed dev, uat, main path. The wizard shows it read-only and sends it
  // only with on-prem hosting; the editing rules stay in the model.
  const [environments, setEnvironments] = useState<EnvironmentDraft[]>([
    ...ENVIRONMENT_TEMPLATE,
  ]);

  // Microservices dual-slot state
  const [backendProjectTypeId, setBackendProjectTypeId] = useState("nestjs");
  const [backendWorkflowRecipeId, setBackendWorkflowRecipeId] = useState("standard");
  const [backendServiceName, setBackendServiceNameState] = useState("");
  const [backendServicePath, setBackendServicePath] = useState("backend/");
  const [backendServiceNameTouched, setBackendServiceNameTouched] = useState(false);
  const [frontendProjectTypeId, setFrontendProjectTypeId] = useState("nextjs");
  const [frontendWorkflowRecipeId, setFrontendWorkflowRecipeId] = useState("standard");
  const [frontendServiceName, setFrontendServiceNameState] = useState("");
  const [frontendServicePath, setFrontendServicePath] = useState("frontend/");
  const [frontendServiceNameTouched, setFrontendServiceNameTouched] = useState(false);

  const setRepoName = useCallback(
    (value: string) => {
      const normalized = sanitizeRepoNameInput(value);
      setRepoNameState(normalized);
      if (!serviceNameTouched) {
        // Service name feeds the workflow YAML as an identifier — keep it a
        // strict slug even though the repo name may contain '.'/'_'.
        setServiceNameState(toSlug(normalized));
      }
    },
    [serviceNameTouched],
  );

  const setProjectName = useCallback((value: string) => {
    setProjectNameState(value);
    // A "name taken" refusal is about the old text; typing makes it stale.
    setProjectNameError(null);
  }, []);

  const setServiceName = useCallback((value: string) => {
    setServiceNameTouched(true);
    setServiceNameState(toSlug(value));
  }, []);

  const setBackendServiceName = useCallback((value: string) => {
    setBackendServiceNameTouched(true);
    setBackendServiceNameState(toSlug(value));
  }, []);

  const setFrontendServiceName = useCallback((value: string) => {
    setFrontendServiceNameTouched(true);
    setFrontendServiceNameState(toSlug(value));
  }, []);

  const effectiveBackendServiceName = effectiveDualServiceName(
    backendServiceNameTouched,
    backendServiceName,
    repoName,
    "backend",
  );
  const effectiveFrontendServiceName = effectiveDualServiceName(
    frontendServiceNameTouched,
    frontendServiceName,
    repoName,
    "frontend",
  );

  function buildPayload(input: BuildPayloadInput) {
    return buildCreateProjectPayload({
      repoName,
      visibility,
      nodeVersion,
      coverageThreshold,
      outputFileName,
      backendProjectTypeId,
      backendWorkflowRecipeId,
      backendServiceName: effectiveBackendServiceName,
      backendServicePath,
      frontendProjectTypeId,
      frontendWorkflowRecipeId,
      frontendServiceName: effectiveFrontendServiceName,
      frontendServicePath,
      ...input,
    });
  }

  return {
    backendProjectTypeId,
    backendServiceName: effectiveBackendServiceName,
    backendServicePath,
    backendWorkflowRecipeId,
    buildPayload,
    coverageThreshold,
    environments,
    frontendProjectTypeId,
    frontendServiceName: effectiveFrontendServiceName,
    frontendServicePath,
    frontendWorkflowRecipeId,
    nodeVersion,
    outputFileName,
    projectName,
    projectNameError,
    repoName,
    serviceName,
    servicePath,
    setBackendProjectTypeId,
    setBackendServiceName,
    setBackendServicePath,
    setBackendWorkflowRecipeId,
    setCoverageThreshold,
    setEnvironments,
    setFrontendProjectTypeId,
    setFrontendServiceName,
    setFrontendServicePath,
    setFrontendWorkflowRecipeId,
    setNodeVersion,
    setOutputFileName,
    setProjectName,
    setProjectNameError,
    setRepoName,
    setServiceName,
    setServicePath,
    setVisibility,
    visibility,
  };
}

export type CreateProjectFormState = ReturnType<typeof useCreateProjectForm>;
