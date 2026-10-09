import { HOTSPOTS } from "@/lib/content";

/** Étiquettes des pathologies ; positionnées à chaque frame par HotspotProjector (canvas). */
export function HotspotLabels() {
  return (
    <div className="hotspots" aria-hidden="true">
      {HOTSPOTS.map((hotspot) => (
        <div key={hotspot.id} data-hotspot className={`hotspot hotspot--${hotspot.card}`}>
          <span className="hotspot__dot" />
          <span className="hotspot__leader" />
          <span className="hotspot__card">
            <span className="hotspot__code">{hotspot.code}</span>
            <span className="hotspot__label">{hotspot.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
