"use client";

import { useCallback, useState } from "react";

import type { CreateProjectRequest, MvpProjectOptionKey } from "@/lib/api/contracts";
import { toSlug } from "@/components/product/workflow-builder-utils";

type CreateProjectPayloadResult =
  | { ok: true; payload: CreateProjectRequest }
  | { ok: false; message: string };

interface BuildPayloadInput {
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
  deploymentProvisioning?: CreateProjectRequest["deploymentProvisioning"];
}

// GitHub repository names allow letters, digits, '.', '_' and '-'. We keep the
// existing lowercase convention and now also permit '.' and '_' (previously
// stripped). Anything else (including '/', which separates owner/repo) is
// dropped; spaces become hyphens; leading/trailing separators are trimmed.
function normalizeRepoName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9._-]/g, "")
    .replaceAll(/^[-._]+|[-._]+$/g, "");
}

export function useCreateProjectForm() {
  const [repoName, setRepoNameState] = useState("");
  const [visibility, setVisibility] = useState<CreateProjectRequest["visibility"]>("private");
  const [serviceName, setServiceNameState] = useState("");
  const [servicePath, setServicePath] = useState(".");
  const [nodeVersion, setNodeVersion] = useState("24");
  const [coverageThreshold, setCoverageThreshold] = useState("80");
  const [outputFileName, setOutputFileName] = useState("ci.yml");
  const [serviceNameTouched, setServiceNameTouched] = useState(false);

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
      const normalized = normalizeRepoName(value);
      setRepoNameState(normalized);
      if (!serviceNameTouched) {
        // Service name feeds the workflow YAML as an identifier — keep it a
        // strict slug even though the repo name may contain '.'/'_'.
        setServiceNameState(toSlug(normalized));
      }
    },
    [serviceNameTouched],
  );

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

  const effectiveBackendServiceName = backendServiceNameTouched
    ? backendServiceName
    : repoName
      ? `${toSlug(repoName)}-backend`
      : "";
  const effectiveFrontendServiceName = frontendServiceNameTouched
    ? frontendServiceName
    : repoName
      ? `${toSlug(repoName)}-frontend`
      : "";

  function buildPayload(input: BuildPayloadInput): CreateProjectPayloadResult {
    const normalizedRepoName = normalizeRepoName(repoName);
    if (!normalizedRepoName) {
      return { ok: false, message: "Repository name is required." };
    }

    if (!input.repoShapeId) {
      return { ok: false, message: "Choose a repository shape." };
    }

    const coverage = Number(coverageThreshold);
    if (!Number.isInteger(coverage) || coverage < 0 || coverage > 100) {
      return { ok: false, message: "Coverage threshold must be between 0 and 100." };
    }

    const normalizedOutputFileName = outputFileName.trim() || "ci.yml";
    if (
      normalizedOutputFileName.includes("/") ||
      normalizedOutputFileName.includes("\\") ||
      !/\.ya?ml$/i.test(normalizedOutputFileName)
    ) {
      return { ok: false, message: "Workflow file name must be a .yml or .yaml basename." };
    }

    if (input.isMicroservicesShape) {
      const normalizedBackendName = toSlug(
        effectiveBackendServiceName || `${normalizedRepoName}-backend`,
      );
      const normalizedFrontendName = toSlug(
        effectiveFrontendServiceName || `${normalizedRepoName}-frontend`,
      );

      return {
        ok: true,
        payload: {
          repoName: normalizedRepoName,
          visibility,
          repoShape: input.repoShapeId,
          // projectTypeId is required on the contract; use backend as the primary slot.
          projectTypeId: backendProjectTypeId,
          workflowRecipeId: backendWorkflowRecipeId,
          // serviceName/servicePath are satisfied by the primary slot for non-microservices
          // consumers of the contract — the microservicesConfig carries the full detail.
          serviceName: normalizedBackendName,
          servicePath: backendServicePath.trim() || "backend/",
          nodeVersion: nodeVersion.trim() || "24",
          coverageThreshold: coverage,
          tests: input.tests,
          outputFileName: normalizedOutputFileName,
          ...(input.deploymentProvisioning ? { deploymentProvisioning: input.deploymentProvisioning } : {}),
          microservicesConfig: {
            backend: {
              projectTypeId: backendProjectTypeId,
              workflowRecipeId: backendWorkflowRecipeId,
              serviceName: normalizedBackendName,
              servicePath: backendServicePath.trim() || "backend/",
            },
            frontend: {
              projectTypeId: frontendProjectTypeId,
              workflowRecipeId: frontendWorkflowRecipeId,
              serviceName: normalizedFrontendName,
              servicePath: frontendServicePath.trim() || "frontend/",
            },
          },
        },
      };
    }

    if (input.isMultiRepoShape) {
      const normalizedBackendName = toSlug(
        effectiveBackendServiceName || `${normalizedRepoName}-backend`,
      );
      const normalizedFrontendName = toSlug(
        effectiveFrontendServiceName || `${normalizedRepoName}-frontend`,
      );

      return {
        ok: true,
        payload: {
          repoName: normalizedRepoName,
          visibility,
          repoShape: input.repoShapeId,
          projectTypeId: backendProjectTypeId,
          workflowRecipeId: backendWorkflowRecipeId,
          serviceName: normalizedBackendName,
          servicePath: backendServicePath.trim() || "backend/",
          nodeVersion: nodeVersion.trim() || "24",
          coverageThreshold: coverage,
          tests: input.tests,
          outputFileName: normalizedOutputFileName,
          ...(input.deploymentProvisioning ? { deploymentProvisioning: input.deploymentProvisioning } : {}),
          multiRepoConfig: {
            backend: {
              projectTypeId: backendProjectTypeId,
              workflowRecipeId: backendWorkflowRecipeId,
              serviceName: normalizedBackendName,
              servicePath: backendServicePath.trim() || "backend/",
            },
            frontend: {
              projectTypeId: frontendProjectTypeId,
              workflowRecipeId: frontendWorkflowRecipeId,
              serviceName: normalizedFrontendName,
              servicePath: frontendServicePath.trim() || "frontend/",
            },
          },
        },
      };
    }

    if (!input.projectTypeId) {
      return { ok: false, message: "Choose a project type." };
    }

    if (!input.workflowRecipeId) {
      return { ok: false, message: "Choose a workflow recipe." };
    }

    const normalizedServiceName = toSlug(serviceName || normalizedRepoName);

    return {
      ok: true,
      payload: {
        repoName: normalizedRepoName,
        visibility,
        repoShape: input.repoShapeId,
        projectTypeId: input.projectTypeId,
        workflowRecipeId: input.workflowRecipeId,
        serviceName: normalizedServiceName,
        servicePath: servicePath.trim() || ".",
        nodeVersion: nodeVersion.trim() || "24",
        coverageThreshold: coverage,
        tests: input.tests,
        outputFileName: normalizedOutputFileName,
        ...(input.deploymentProvisioning ? { deploymentProvisioning: input.deploymentProvisioning } : {}),
      },
    };
  }

  return {
    backendProjectTypeId,
    backendServiceName: effectiveBackendServiceName,
    backendServicePath,
    backendWorkflowRecipeId,
    buildPayload,
    coverageThreshold,
    frontendProjectTypeId,
    frontendServiceName: effectiveFrontendServiceName,
    frontendServicePath,
    frontendWorkflowRecipeId,
    nodeVersion,
    outputFileName,
    repoName,
    serviceName,
    servicePath,
    setBackendProjectTypeId,
    setBackendServiceName,
    setBackendServicePath,
    setBackendWorkflowRecipeId,
    setCoverageThreshold,
    setFrontendProjectTypeId,
    setFrontendServiceName,
    setFrontendServicePath,
    setFrontendWorkflowRecipeId,
    setNodeVersion,
    setOutputFileName,
    setRepoName,
    setServiceName,
    setServicePath,
    setVisibility,
    visibility,
  };
}

export type CreateProjectFormState = ReturnType<typeof useCreateProjectForm>;
