import type { AdRow, CreativeIntelRow } from "@/lib/advertising/types";

const PREVIEW_LABELS: Record<string, string> = {
  ugc: "UGC Video",
  video: "Video",
  carousel: "Carousel",
  image: "Image",
};

type PreviewType = AdRow["previewType"] | CreativeIntelRow["previewType"];

export function CreativePreviewThumb({
  type,
  label,
  size = "md",
}: {
  type: PreviewType;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`adv-creative-preview adv-preview-${size} adv-preview-type-${type}`}>
      <span className="adv-creative-preview-type">{PREVIEW_LABELS[type] ?? type}</span>
      {label && <span className="adv-creative-preview-label">{label}</span>}
    </div>
  );
}
