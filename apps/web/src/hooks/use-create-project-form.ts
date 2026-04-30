"use client";

import { useCallback, useState } from "react";

import type { CreateProjectRequest, MvpProjectOptionKey } from "@/lib/api/contracts";
import { toSlug } from "@/components/product/workflow-builder-utils";

type CreateProjectPayloadResult =
  | { ok: true; payload: CreateProjectRequest }
  | { ok: false; message: string };

interface BuildPayloadInput {
  hasAllRepositoriesInstallation: boolean;
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

    if (!input.projectTypeId) {
      return { ok: false, message: "Choose a project type." };
    }

    if (!input.workflowRecipeId) {
      return { ok: false, message: "Choose a workflow recipe." };
    }

    const normalizedServiceName = toSlug(serviceName || normalizedRepoName);

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
    buildPayload,
    coverageThreshold,
    nodeVersion,
    outputFileName,
    repoName,
    serviceName,
    servicePath,
    setCoverageThreshold,
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
