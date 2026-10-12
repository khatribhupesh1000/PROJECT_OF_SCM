import React, { useEffect, useRef, useState } from "react";
import { Upload, X, CheckCircle2, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { contactApi, aiApi, parseRfc7807Error } from "../services/api.js";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LOCAL_PHONE_REGEX = /^[0-9]{6,15}$/;

export const COUNTRY_DIAL_CODES = [
  { code: "+91", flag: "🇮🇳", label: "🇮🇳 +91", name: "India" },
  { code: "+1", flag: "🇺🇸", label: "🇺🇸 +1", name: "United States / Canada" },
  { code: "+44", flag: "🇬🇧", label: "🇬🇧 +44", name: "United Kingdom" },
  { code: "+61", flag: "🇦🇺", label: "🇦🇺 +61", name: "Australia" },
  { code: "+49", flag: "🇩🇪", label: "🇩🇪 +49", name: "Germany" },
  { code: "+65", flag: "🇸🇬", label: "🇸🇬 +65", name: "Singapore" },
  { code: "+971", flag: "🇦🇪", label: "🇦🇪 +971", name: "United Arab Emirates" }
];

/**
 * Parse an existing E.164 or raw phone string into { countryCode, localPhone }
 */
export function splitPhoneCountryCode(rawPhone) {
  const raw = String(rawPhone || "").trim();
  if (!raw) {
    return { countryCode: "+91", localPhone: "" };
  }

  // Sort by longest dial code first (+971 before +91, etc.)
  const sortedCodes = [...COUNTRY_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

  if (raw.startsWith("+")) {
    for (const item of sortedCodes) {
      if (raw.startsWith(item.code)) {
        const restDigits = raw.slice(item.code.length).replace(/\D/g, "");
        return { countryCode: item.code, localPhone: restDigits };
      }
    }
  }

  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return { countryCode: "+91", localPhone: digitsOnly.slice(2) };
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return { countryCode: "+1", localPhone: digitsOnly.slice(1) };
  }

  return { countryCode: "+91", localPhone: digitsOnly };
}

export default function ContactModal({
  isOpen,
  initialContact,
  onClose,
  onSave,
  onNotify
}) {
  const dialogRef = useRef(null);
  const [countryCode, setCountryCode] = useState("+91");
  const [form, setForm] = useState({
    name: "",
    email: "",
    localPhone: "",
    company: "",
    tag: "Colleague",
    address: "",
    description: "",
    websiteLink: "",
    linkedInLink: "",
    pictureUrl: "",
    favorite: false
  });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiBoxOpen, setAiBoxOpen] = useState(false);
  const [rawAiText, setRawAiText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);

  const handleAutoFillWithAi = async () => {
    if (!rawAiText.trim()) return;
    setAiParsing(true);
    try {
      const parsed = await aiApi.parseContact(rawAiText.trim());
      const nextForm = { ...form };
      if (parsed.name) nextForm.name = parsed.name;
      if (parsed.email) nextForm.email = parsed.email;
      if (parsed.company) nextForm.company = parsed.company;
      if (parsed.address) nextForm.address = parsed.address;
      if (parsed.tag) nextForm.tag = parsed.tag;
      if (parsed.role) {
        nextForm.description = nextForm.description
          ? `${parsed.role} • ${nextForm.description}`
          : parsed.role;
      }
      if (parsed.phoneNumber) {
        const { countryCode: cCode, localPhone } = splitPhoneCountryCode(parsed.phoneNumber);
        setCountryCode(cCode);
        nextForm.localPhone = localPhone;
      }
      setForm(nextForm);
      setErrors({});
      onNotify?.({
        variant: "success",
        title: "✨ Contact Auto-Filled with AI",
        detail: `Extracted details for ${parsed.name || "contact"} from unstructured text.`
      });
      setAiBoxOpen(false);
    } catch (err) {
      const problem = parseRfc7807Error(err);
      onNotify?.({
        variant: "error",
        title: "AI Auto-Fill Error",
        detail: problem.detail || "Unable to parse contact text."
      });
    } finally {
      setAiParsing(false);
    }
  };

  useEffect(() => {
    if (initialContact) {
      const parsedPhone = splitPhoneCountryCode(initialContact.phoneNumber);
      setCountryCode(parsedPhone.countryCode);
      setForm({
        name: initialContact.name || "",
        email: initialContact.email || "",
        localPhone: parsedPhone.localPhone || "",
        company: initialContact.company || "",
        tag: initialContact.tag || "Colleague",
        address: initialContact.address || "",
        description: initialContact.description || "",
        websiteLink: initialContact.websiteLink || "",
        linkedInLink: initialContact.linkedInLink || "",
        pictureUrl: initialContact.pictureUrl || "",
        favorite: Boolean(initialContact.favorite)
      });
    } else {
      setCountryCode("+91");
      setForm({
        name: "",
        email: "",
        localPhone: "",
        company: "",
        tag: "Colleague",
        address: "",
        description: "",
        websiteLink: "",
        linkedInLink: "",
        pictureUrl: "",
        favorite: false
      });
    }
    setTouched({});
    setErrors({});
  }, [initialContact, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close();
      }
    };

    if (typeof HTMLDialogElement !== "undefined" && !("closedBy" in HTMLDialogElement.prototype)) {
      dialog.addEventListener("click", handleBackdropClick);
      return () => dialog.removeEventListener("click", handleBackdropClick);
    }
  }, []);

  const computeErrors = (currentForm = form) => {
    const nextErrors = {};
    if (!currentForm.name || currentForm.name.trim().length < 2) {
      nextErrors.name = "Name must be at least 2 characters.";
    }
    if (currentForm.email && currentForm.email.trim() && !EMAIL_REGEX.test(currentForm.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    const cleanDigits = String(currentForm.localPhone || "").replace(/\D/g, "");
    if (!cleanDigits || !LOCAL_PHONE_REGEX.test(cleanDigits)) {
      nextErrors.localPhone = "Enter a valid phone number (6–15 digits).";
    }
    return nextErrors;
  };

  const handleFieldBlur = (fieldName) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const currentErrors = computeErrors(form);
    setErrors((prev) => ({
      ...prev,
      [fieldName]: currentErrors[fieldName] || undefined
    }));
  };

  const handlePhoneChange = (e) => {
    // Allow digits only in local phone number box
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 15);
    const nextForm = { ...form, localPhone: digitsOnly };
    setForm(nextForm);

    if (touched.localPhone || errors.localPhone) {
      if (!digitsOnly || LOCAL_PHONE_REGEX.test(digitsOnly)) {
        setErrors((prev) => ({ ...prev, localPhone: undefined }));
      } else {
        setErrors((prev) => ({
          ...prev,
          localPhone: "Enter a valid phone number (6–15 digits)."
        }));
      }
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await contactApi.uploadPhoto(file);
      setForm((prev) => ({ ...prev, pictureUrl: uploaded.url }));
      onNotify?.({
        variant: "success",
        title: "Photo uploaded",
        detail: `${uploaded.fileName} (${(uploaded.sizeBytes / 1024).toFixed(1)} KB)`
      });
    } catch (err) {
      const problem = parseRfc7807Error(err);
      onNotify?.({ variant: "error", ...problem });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = computeErrors(form);
    setTouched({ name: true, email: true, localPhone: true });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const cleanDigits = String(form.localPhone).replace(/\D/g, "");
      const combinedE164Phone = `${countryCode}${cleanDigits}`;

      const cleanPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: combinedE164Phone,
        company: form.company.trim() || null,
        tag: form.tag || "Colleague",
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        websiteLink: form.websiteLink.trim() || null,
        linkedInLink: form.linkedInLink.trim() || null,
        pictureUrl: form.pictureUrl || null,
        favorite: Boolean(form.favorite)
      };
      await onSave(cleanPayload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30";

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="contactModalTitle"
      onClose={onClose}
      className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 p-0 shadow-2xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 id="contactModalTitle" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {initialContact ? "Edit Contact" : "New Contact"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {initialContact
                ? `Updating record ${initialContact.id}`
                : "Add a person to your workspace directory"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="mt-4 space-y-3.5">
          {/* ✨ Spring AI Smart Contact Auto-Fill Box */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setAiBoxOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-emerald-100/40 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Paste visiting card, signature, or message to auto-fill with AI
                </span>
              </div>
              {aiBoxOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
            </button>

            {aiBoxOpen && (
              <div className="p-3 pt-1 border-t border-emerald-100 dark:border-emerald-900/40 space-y-2">
                <textarea
                  rows={2}
                  value={rawAiText}
                  onChange={(e) => setRawAiText(e.target.value)}
                  placeholder="e.g. Met Rahul Sharma, VP at FinTech Labs, call him at +91 9812345678, email rahul@fintech.io, located in New Delhi"
                  className="w-full rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setRawAiText(
                        "Met Rahul Sharma, VP at FinTech Labs, call him at +91 9812345678, email rahul@fintech.io, located in New Delhi"
                      )
                    }
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Paste sample card
                  </button>
                  <button
                    type="button"
                    disabled={aiParsing || !rawAiText.trim()}
                    onClick={handleAutoFillWithAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                  >
                    {aiParsing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>{aiParsing ? "Auto-Filling..." : "Auto-Fill with AI"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="contact_full_name"
                autoComplete="off"
                value={form.name}
                onChange={(e) => {
                  const next = { ...form, name: e.target.value };
                  setForm(next);
                  if (touched.name && next.name.trim().length >= 2) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                onBlur={() => handleFieldBlur("name")}
                placeholder="e.g. John Doe"
                className={inputClass}
              />
              {touched.name && errors.name && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="contact_email_address"
                autoComplete="off"
                value={form.email}
                onChange={(e) => {
                  const next = { ...form, email: e.target.value };
                  setForm(next);
                  if (touched.email && (!next.email.trim() || EMAIL_REGEX.test(next.email.trim()))) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                onBlur={() => handleFieldBlur("email")}
                placeholder="john@example.com"
                className={`${inputClass} font-mono`}
              />
              {touched.email && errors.email && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Phone Number *
              </label>
              <div className="flex items-stretch">
                <select
                  aria-label="Country dial code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="rounded-l-md border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 px-2 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  name="contact_local_phone"
                  autoComplete="off"
                  value={form.localPhone}
                  onChange={handlePhoneChange}
                  onBlur={() => {
                    if (form.localPhone.trim().length > 0) {
                      handleFieldBlur("localPhone");
                    }
                  }}
                  placeholder=""
                  className="w-full rounded-r-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
                />
              </div>
              {touched.localPhone && errors.localPhone && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.localPhone}</p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Company
              </label>
              <input
                type="text"
                name="contact_company"
                autoComplete="off"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. Acme Corp"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Segment Tag
              </label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className={inputClass}
              >
                <option value="VIP">VIP</option>
                <option value="Colleague">Colleague</option>
                <option value="Lead">Lead</option>
                <option value="Family">Family</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Role / Title &amp; Notes
            </label>
            <input
              type="text"
              name="contact_description"
              autoComplete="off"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Project Manager"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Location
              </label>
              <input
                type="text"
                name="contact_location"
                autoComplete="off"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. New Delhi, IN"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Website or Social URL
              </label>
              <input
                type="text"
                name="contact_website"
                autoComplete="off"
                value={form.websiteLink}
                onChange={(e) => setForm({ ...form, websiteLink: e.target.value })}
                placeholder="e.g., https://linkedin.com/in/..."
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Avatar Image (Optional, Max 2MB)
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/50 px-3 py-2 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                <span>{uploading ? "Uploading..." : "Upload JPG, PNG, or WebP"}</span>
              </div>
              {form.pictureUrl && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300 select-none">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) => setForm({ ...form, favorite: e.target.checked })}
              className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-emerald-600 focus:ring-zinc-400"
            />
            <span>Pin to Favorites</span>
          </label>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              {submitting ? "Saving..." : initialContact ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
