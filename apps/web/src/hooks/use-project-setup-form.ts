"use client";

import { useState } from "react";

import type { CatalogTemplate, SetupProjectRequest } from "@/lib/api/contracts";
import { toSlug } from "@/components/product/workflow-builder-utils";

type SetupPayloadResult =
  | { ok: true; payload: SetupProjectRequest }
  | { ok: false; message: string };

export function useProjectSetupForm() {
  const [serviceName, setServiceName] = useState("cicd-service");
  const [servicePath, setServicePath] = useState("");
  const [nodeVersion, setNodeVersion] = useState("24");
  const [coverageThreshold, setCoverageThreshold] = useState("80");
  const [outputFileName, setOutputFileName] = useState("");
  const [enhancements, setEnhancements] = useState<NonNullable<SetupProjectRequest["enhancements"]>>([]);

  function applyRepoSelection(repoFullName: string) {
    if (repoFullName && (!serviceName || serviceName === "cicd-service")) {
      setServiceName(toSlug(repoFullName.split("/").pop() ?? repoFullName));
    }
  }

  function toggleEnhancement(key: NonNullable<SetupProjectRequest["enhancements"]>[number]) {
    setEnhancements((current) => {
      if (current.includes(key)) {
        return current.filter((value) => value !== key);
      }

      return [...current, key];
    });
  }

  function buildPayload(
    selectedTemplate: CatalogTemplate | null,
    selectedRepoFullName: string,
  ): SetupPayloadResult {
    if (!selectedTemplate) {
      return { ok: false, message: "Please select a template first." };
    }

    if (!selectedRepoFullName) {
      return { ok: false, message: "Select a linked GitHub App repo first." };
    }

    if (!serviceName.trim()) {
      return { ok: false, message: "Service name is required." };
    }

    const coverage = Number(coverageThreshold);
    if (Number.isNaN(coverage) || coverage < 0 || coverage > 100) {
      return { ok: false, message: "Coverage threshold must be between 0 and 100." };
    }

    const normalizedService = toSlug(serviceName);
    return {
      ok: true,
      payload: {
        repoFullName: selectedRepoFullName,
        templateId: selectedTemplate.id,
        serviceName: normalizedService,
        servicePath: servicePath || undefined,
        nodeVersion: nodeVersion || undefined,
        coverageThreshold: coverage,
        enhancements: enhancements.length ? enhancements : undefined,
        outputFileName: outputFileName || undefined,
      },
    };
  }

  return {
    applyRepoSelection,
    buildPayload,
    coverageThreshold,
    enhancements,
    nodeVersion,
    outputFileName,
    serviceName,
    servicePath,
    setCoverageThreshold,
    setNodeVersion,
    setOutputFileName,
    setServiceName,
    setServicePath,
    toggleEnhancement,
  };
}

export type ProjectSetupFormState = ReturnType<typeof useProjectSetupForm>;
