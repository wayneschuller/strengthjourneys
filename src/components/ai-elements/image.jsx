/** biome-ignore-all lint/performance/noImgElement: "ai-elements is framework agnostic" */
/** biome-ignore-all lint/nursery/useImageSize: "size will be handled by props" */

import { cn } from '@/lib/utils';

export const Image = ({
  base64,
  uint8Array,
  mediaType,
  ...props
}) => (
  <img
    {...props}
    alt={props.alt}
    className={cn('h-auto max-w-full overflow-hidden rounded-md', props.className)}
    src={`data:${mediaType};base64,${base64}`} />
);
