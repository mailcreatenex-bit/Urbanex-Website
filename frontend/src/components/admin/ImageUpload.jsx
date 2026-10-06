import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";

// Photos straight from a phone are 4-10 MB. Shrink them in the browser (max 1800 px, JPEG) before uploading so
// the site stays light for visitors and the upload is fast on mobile data.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch { return file; }
}

async function upload(original, endpoint) {
  const file = await shrink(original);
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
  return data.url;
}

// value: string (single) or string[] (multiple). Accepts a pasted URL or an uploaded file.
export default function ImageUpload({ label, value, onChange, multiple = false, endpoint = "/admin/uploads" }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const list = multiple ? (value || []) : (value ? [value] : []);

  const onFiles = async (files) => {
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await upload(f, endpoint));
      onChange(multiple ? [...list, ...urls] : urls[0]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = (u) => onChange(multiple ? list.filter(x => x !== u) : "");

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {list.map(u => (
          <div key={u} className="relative w-20 h-16 rounded-lg overflow-hidden border">
            <img src={assetUrl(u, 200)} alt="" className="w-full h-full object-cover"/>
            <button type="button" onClick={() => remove(u)} aria-label="Remove image" className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5"><X className="w-3 h-3"/></button>
          </div>
        ))}
        {(multiple || !list.length) && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="w-20 h-16 rounded-lg border border-dashed flex items-center justify-center text-gray-500 hover:border-urbanex-gold disabled:opacity-50">
            <ImagePlus className="w-5 h-5"/>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} hidden
        onChange={(e) => e.target.files?.length && onFiles([...e.target.files])}/>
      <input type="url" placeholder="…or paste an image URL and press Enter" className="mt-2 w-full border rounded-lg px-3 py-1.5 text-xs"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const v = e.currentTarget.value.trim();
          if (/^https?:\/\//.test(v)) { onChange(multiple ? [...list, v] : v); e.currentTarget.value = ""; }
        }}/>
    </div>
  );
}
