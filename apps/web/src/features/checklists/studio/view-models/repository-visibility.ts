"use client";

import { createContext, useContext } from "react";

/**
 * Whether the screen names repositories and commits (`showsRepositories`):
 * Product owners and the QA Team see only the Project. QA / PO Studio
 * provides it for its viewer; anywhere it is not provided (the Overview's
 * readiness card a Developer reads) repositories show, as before.
 */
export const ShowRepositoriesContext = createContext<boolean>(true);

export function useShowRepositories(): boolean {
  return useContext(ShowRepositoriesContext);
}
