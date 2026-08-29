/**
 * The ids the surface gradients are declared under.
 *
 * In their own module because `Surfaces.tsx` exports a component, and a file that
 * exports both a component and a constant loses fast refresh. Same reason
 * `editSessionContext.ts` sits beside `editSession.tsx` in `shared/`.
 */
export const IDS = {
  /** The slide's ends, curving away. */
  barrelEnds: 'ttb-barrel-ends',
  /** The track the steps sit in. */
  well: 'ttb-well',
} as const
