/* Screenshots on a Project run item, as building blocks: one group's
 * ViewModel (thumbnails, Capture / Paste / Upload, caption and Save, inline
 * delete, the lightbox) and the views that draw it. QA Studio composes two of
 * them per item (QA evidence, Fix proof); My QA items composes one (the
 * Developer's "Proof of the fix"). A leaf slice: it imports no other slice,
 * so both can use it without a cycle. */
export {
  useAttachmentGroupViewModel,
  type AttachmentGroupStatus,
  type AttachmentGroupViewModel,
  type AttachmentSource,
  type CaptureOption,
} from "./view-models/use-attachment-group-view-model";
export { EvidenceCount, EvidenceGroupBody, evidencePasteHandler } from "./views/evidence-group";
export { ImageIcon, WrenchIcon } from "./views/evidence-icons";
