"use client";

import type { EnvVarMetadata } from "@/features/projects";
import { envMetadataLaneLabel } from "../model/project-detail-tab-rules";

export function EnvMetadataList({
  metadata,
}: Readonly<{ metadata: EnvVarMetadata[] }>) {
  if (!metadata.length) {
    return <p className="env-empty-state">No variables provisioned yet.</p>;
  }

  return (
    <div className="env-metadata-list">
      {metadata.map((item) => (
        <EnvMetadataRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function EnvMetadataRow({ item }: Readonly<{ item: EnvVarMetadata }>) {
  return (
    <div className={`env-metadata-row ${item.status}`}>
      <span>{item.key}</span>
      <span>
        {envMetadataLaneLabel(item)} - {item.status}
      </span>
    </div>
  );
}
