// The app navigation only needs to know whether on-prem hosting is offered.
// Importing the hosts barrel would pull in pages that depend on the navigation.
export { useHostAvailability } from "../view-models/use-host-availability";
