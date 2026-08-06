import { useState } from "react";
import {
  type Address,
  useAddresses,
  useRemoveAddress,
  useSaveAddress,
  useSetDefaultAddress,
} from "../../platform/address";
import Button from "../ui/Button";

const FIELD_CLASS =
  "h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none";

function AddressForm({ initial, onClose }: { initial?: Address; onClose: () => void }) {
  const save = useSaveAddress();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const get = (k: string) => `${d.get(k) ?? ""}`.trim();
        save.mutate(
          {
            id: initial?.id,
            label: get("label"),
            recipient: get("recipient"),
            streetAddress: get("streetAddress"),
            addressLocality: get("addressLocality"),
            addressRegion: get("addressRegion"),
            postalCode: get("postalCode"),
            addressCountry: get("addressCountry"),
            isDefault: d.get("isDefault") === "on",
          },
          { onSuccess: onClose },
        );
      }}
    >
      <input
        name="label"
        defaultValue={initial?.label}
        placeholder="Label (Home, Work)"
        className={FIELD_CLASS}
      />
      <input
        name="recipient"
        defaultValue={initial?.recipient}
        placeholder="Recipient"
        className={FIELD_CLASS}
      />
      <input
        name="streetAddress"
        defaultValue={initial?.streetAddress}
        placeholder="Street address"
        required
        className={`${FIELD_CLASS} sm:col-span-2`}
      />
      <input
        name="addressLocality"
        defaultValue={initial?.addressLocality}
        placeholder="City"
        className={FIELD_CLASS}
      />
      <input
        name="addressRegion"
        defaultValue={initial?.addressRegion}
        placeholder="State/Region"
        className={FIELD_CLASS}
      />
      <input
        name="postalCode"
        defaultValue={initial?.postalCode}
        placeholder="Postal code"
        required
        className={FIELD_CLASS}
      />
      <input
        name="addressCountry"
        defaultValue={initial?.addressCountry}
        placeholder="Country"
        className={FIELD_CLASS}
      />
      <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initial?.isDefault}
          className="size-4 accent-rose"
        />
        <span className="text-sm text-ink">Set as default</span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="solid" size="sm" disabled={save.isPending}>
          {save.isPending ? <span className="loading loading-spinner loading-xs" /> : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {save.isError && (
        <span className="text-sm text-error sm:col-span-2">
          Couldn't save the address. Please try again.
        </span>
      )}
    </form>
  );
}

export default function AddressBook() {
  const { addresses, isLoading } = useAddresses();
  const remove = useRemoveAddress();
  const setDefault = useSetDefaultAddress();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="frost mt-6 max-w-xl rounded-lg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
          Addresses
        </h2>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            Add address
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-3 rounded-sm border border-line p-3">
          <AddressForm onClose={() => setAdding(false)} />
        </div>
      )}

      {isLoading ? (
        <span className="loading loading-spinner" />
      ) : addresses.length === 0 && !adding ? (
        <p className="text-sm text-muted">No addresses saved yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-sm border border-line p-3">
              {editingId === a.id ? (
                <AddressForm initial={a} onClose={() => setEditingId(null)} />
              ) : (
                <div className="flex justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium text-ink">
                      {a.label || a.recipient || "Address"}
                      {a.isDefault && (
                        <span className="ml-2 rounded-xs bg-glass-tag px-2 py-0.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-muted">
                      {[
                        a.streetAddress,
                        a.addressLocality,
                        a.addressRegion,
                        a.postalCode,
                        a.addressCountry,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    <button
                      type="button"
                      className="text-accent hover:text-rose-deep"
                      onClick={() => {
                        setEditingId(a.id);
                        setAdding(false);
                      }}
                    >
                      Edit
                    </button>
                    {!a.isDefault && (
                      <button
                        type="button"
                        className="text-muted hover:text-ink"
                        disabled={setDefault.isPending}
                        onClick={() => setDefault.mutate(a.id)}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-error hover:text-error/80"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(a.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
