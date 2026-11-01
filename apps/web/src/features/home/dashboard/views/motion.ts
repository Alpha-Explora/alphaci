/* Shared motion constants for the dashboard views. One definition so the
 * section stagger stays identical across the pieces that were split out of the
 * single page file. */
export const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

export const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT, delay: delay * 0.06 },
  }),
};
