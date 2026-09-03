"use client";

import { useCallback, useState } from "react";

import type { CreateProjectRequest, MvpProjectOptionKey } from "@/shared/api/contracts";
import {
  buildCreateProjectPayload,
  sanitizeRepoNameInput,
} from "../model/create-project-payload";
import { effectiveDualServiceName } from "../model/setup-tab-rules";
import { toSlug } from "../model/workflow-studio-rules";

interface BuildPayloadInput {
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
  ownerType?: "personal" | "organization";
  installationId?: number;
  deploymentProvisioning?: CreateProjectRequest["deploymentProvisioning"];
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
      serviceName,
      servicePath,
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
