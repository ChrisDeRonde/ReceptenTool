"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPhotos } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { MAX_PHOTOS } from "@/lib/photo-rules";

/**
 * Een recept fotograferen.
 *
 * Twee knoppen, twee verborgen file-inputs: één met `capture="environment"`,
 * die op iOS meteen de camera aan de achterkant opent, en één zonder, die de
 * fotobibliotheek geeft. Op een laptop worden het allebei een bestandskiezer.
 *
 * Client component omdat er iets te tonen valt terwijl je bezig bent: de
 * gekozen foto's, en een wachtstand — het model doet er een halve minuut over
 * en zonder terugkoppeling denk je dat er niets gebeurt.
 */
export function PhotoForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [error, submit, pending] = useActionState(
    async (_previous: string | null, formData: FormData) => {
      // De losse inputs zitten niet in de submit (ze worden leeggemaakt zodra
      // je een tweede keer kiest), dus we zetten de verzameling er zelf in.
      formData.delete("photos");
      for (const file of files) formData.append("photos", file);

      const message = await addPhotos(formData);
      if (!message) {
        setFiles([]);
        formRef.current?.reset();
      }
      return message;
    },
    null,
  );

  // Voorbeeld-URL's zijn objecten in het geheugen; die moet je weer vrijgeven.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((current) => [...current, ...Array.from(list)].slice(0, MAX_PHOTOS));
  };

  const remove = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index));

  return (
    <form ref={formRef} action={submit} className="photo-form">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => add(event.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => add(event.target.files)}
      />

      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={() => cameraRef.current?.click()}
          disabled={pending || files.length >= MAX_PHOTOS}
        >
          <Icon icon={icons.camera} size={18} />
          Foto maken
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => libraryRef.current?.click()}
          disabled={pending || files.length >= MAX_PHOTOS}
        >
          <Icon icon={icons.photo} size={18} />
          Uit bibliotheek
        </button>
      </div>

      {files.length > 0 && (
        <>
          <div className="shots">
            {previews.map((src, index) => (
              <div key={src} className="shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Foto ${index + 1}`} />
                {!pending && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Foto ${index + 1} verwijderen`}
                  >
                    <Icon icon={icons.close} size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <textarea
            name="note"
            rows={2}
            placeholder="Iets erbij? Bijvoorbeeld: pagina 2 ontbreekt, of dit is voor 4 personen."
            disabled={pending}
          />

          <div className="row">
            <button type="submit" disabled={pending}>
              {pending
                ? "Bezig met lezen…"
                : files.length === 1
                  ? "Lees deze foto"
                  : `Lees deze ${files.length} foto's`}
            </button>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {pending
                ? "Duurt ongeveer een halve minuut."
                : `Nog ${MAX_PHOTOS - files.length} foto's mogelijk.`}
            </span>
          </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
