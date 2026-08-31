"use client";
import type { SceneAnimalPayload } from "@/lib/data";
import { SCENE_ANIMAL_SPECIES, SCENE_ANIMAL_SEX, SCENE_ANIMAL_OWNERS, SCENE_ANIMAL_TEMPERAMENTS } from "@/lib/constants";

// Shared field set for an informational / scene-awareness animal — used both
// on the dispatch call detail page (AddAnimalToCallModal's Tab C) and inline
// on the citation form ("Add new informational animal"), so the two entry
// points can't drift apart.
interface Props {
  value: SceneAnimalPayload;
  onChange: (value: SceneAnimalPayload) => void;
}

export default function SceneAnimalFields({ value, onChange }: Props) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Species</label>
          <select className="form-select" value={value.species} onChange={(e) => onChange({ ...value, species: e.target.value })}>
            {SCENE_ANIMAL_SPECIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Count</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={value.count ?? 1}
            onChange={(e) => onChange({ ...value, count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          />
        </div>
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Breed / Description</label>
          <input className="form-input" value={value.breed || ""} onChange={(e) => onChange({ ...value, breed: e.target.value })} placeholder="e.g. Pit Bull, mixed breed…" />
        </div>
        <div className="form-group">
          <label className="form-label">Color / Markings</label>
          <input className="form-input" value={value.color || ""} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Sex</label>
          <select className="form-select" value={value.sex || SCENE_ANIMAL_SEX[3]} onChange={(e) => onChange({ ...value, sex: e.target.value })}>
            {SCENE_ANIMAL_SEX.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Owner</label>
          <select className="form-select" value={value.owner || SCENE_ANIMAL_OWNERS[2]} onChange={(e) => onChange({ ...value, owner: e.target.value })}>
            {SCENE_ANIMAL_OWNERS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Temperament Observed</label>
          <select className="form-select" value={value.temperament || SCENE_ANIMAL_TEMPERAMENTS[3]} onChange={(e) => onChange({ ...value, temperament: e.target.value })}>
            {SCENE_ANIMAL_TEMPERAMENTS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" rows={2} value={value.notes || ""} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder="Loose in the yard, no fence, etc…" />
      </div>
    </div>
  );
}
