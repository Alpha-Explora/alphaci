/* The create-group dialog is a small action slice consumed by the workspace
 * picker. It remains implemented beside the hierarchy primitives for now, but
 * this public barrel keeps the picker from reaching into another action's
 * internals and avoids pulling the hierarchy page shell into the app shell. */
export { CreateGroupDialog } from "../workspace/views/create-group-dialog";
