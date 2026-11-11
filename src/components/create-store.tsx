"use client";

import { useActionState } from "react";
import { createStoreAction } from "@/server/actions";
import { THEME_PRESETS } from "@/lib/presets";

export function CreateStoreForm() {
  const [state, action, pending] = useActionState(createStoreAction, { error: "" });
  return (
    <form action={action} className="form-grid">
      <label className="field"><span>Store name</span><input name="name" required /></label>
      <label className="field"><span>Slug</span><input name="slug" placeholder="optional" /></label>
      <label className="field"><span>City</span><input name="city" required /></label>
      <label className="field"><span>State</span><input name="state" required /></label>
      <label className="field"><span>Short description</span><textarea name="description" rows={3} /></label>
      <label className="field"><span>Owner name</span><input name="ownerName" required /></label>
      <label className="field"><span>Owner email</span><input name="ownerEmail" type="email" required /></label>
      <label className="field"><span>Temporary password</span><input name="password" type="text" required minLength={8} /></label>
      <label className="field"><span>Theme</span>
        <select name="preset">{THEME_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn" disabled={pending}>Create store</button>
    </form>
  );
}
