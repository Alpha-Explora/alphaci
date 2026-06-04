"use client";

import { useCallback, useEffect, useState } from "react";

import type { CreateProjectRequest, MvpProjectOptionKey } from "@/lib/api/contracts";
import { toSlug } from "@/components/product/workflow-builder-utils";

type CreateProjectPayloadResult =
  | { ok: true; payload: CreateProjectRequest }
  | { ok: false; message: string };

interface BuildPayloadInput {
  hasAllRepositoriesInstallation: boolean;
  isMicroservicesShape: boolean;
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
}

function normalizeRepoName(value: string): string {
  return toSlug(value).replaceAll(/^-+|-+$/g, "");
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
        setServiceNameState(normalized);
      }
    },
    [serviceNameTouched],
  );

  const setServiceName = useCallback((value: string) => {
    setServiceNameTouched(true);
    setServiceNameState(toSlug(value));
  }, []);

  // Auto-populate microservices slot names from repoName when not manually touched.
  useEffect(() => {
    if (!backendServiceNameTouched) {
      setBackendServiceNameState(repoName ? `${repoName}-backend` : "");
    }
  }, [repoName, backendServiceNameTouched]);

  useEffect(() => {
    if (!frontendServiceNameTouched) {
      setFrontendServiceNameState(repoName ? `${repoName}-frontend` : "");
    }
  }, [repoName, frontendServiceNameTouched]);

  const setBackendServiceName = useCallback((value: string) => {
    setBackendServiceNameTouched(true);
    setBackendServiceNameState(toSlug(value));
  }, []);

  const setFrontendServiceName = useCallback((value: string) => {
    setFrontendServiceNameTouched(true);
    setFrontendServiceNameState(toSlug(value));
  }, []);

  function buildPayload(input: BuildPayloadInput): CreateProjectPayloadResult {
    if (!input.hasAllRepositoriesInstallation) {
      return {
        ok: false,
        message:
          "Link a GitHub App installation with all repositories access before creating a project.",
      };
    }

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
      const normalizedBackendName = toSlug(backendServiceName || `${normalizedRepoName}-backend`);
      const normalizedFrontendName = toSlug(frontendServiceName || `${normalizedRepoName}-frontend`);

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
      },
    };
  }

  return {
    backendProjectTypeId,
    backendServiceName,
    backendServicePath,
    backendWorkflowRecipeId,
    buildPayload,
    coverageThreshold,
    frontendProjectTypeId,
    frontendServiceName,
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
