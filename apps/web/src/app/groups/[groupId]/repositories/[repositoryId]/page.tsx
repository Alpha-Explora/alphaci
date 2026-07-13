"use client";

import { useParams } from "next/navigation";

import { RepositoryDetailView } from "@/components/hierarchy/repository-detail-view";
import {
  Breadcrumb,
  HierarchyPageShell,
} from "@/components/hierarchy/primitives";

export default function RepositoryDetailPage() {
  const params = useParams<{ groupId: string; repositoryId: string }>();
  return (
    <HierarchyPageShell>
      {() => (
        <RepositoryDetailView
          groupId={params.groupId}
          repositoryId={params.repositoryId}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: "Projects", href: "/groups" },
                { label: "Repository" },
              ]}
            />
          }
        />
      )}
    </HierarchyPageShell>
  );
}
