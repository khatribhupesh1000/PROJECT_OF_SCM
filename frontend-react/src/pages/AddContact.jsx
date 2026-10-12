import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { COUNTRY_DIAL_CODES } from "../components/ContactModal.jsx";
import { contactApi, parseRfc7807Error } from "../services/api.js";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LOCAL_PHONE_REGEX = /^[0-9]{6,15}$/;

export default function AddContact({ onNotify }) {
  const navigate = useNavigate();
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
    favorite: false
  });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = computeErrors(form);
    setTouched({ name: true, email: true, localPhone: true });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      const cleanDigits = String(form.localPhone).replace(/\D/g, "");
      const combinedE164Phone = `${countryCode}${cleanDigits}`;

      const created = await contactApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: combinedE164Phone,
        company: form.company.trim() || null,
        tag: form.tag || "Colleague",
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        websiteLink: form.websiteLink.trim() || null,
        favorite: Boolean(form.favorite)
      });
      onNotify({
        variant: "success",
        title: "Contact created",
        detail: `${created.name} added to directory.`
      });
      navigate("/");
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30";

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to directory</span>
      </Link>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          New Contact
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add a new person to your workspace directory.
        </p>

        <form onSubmit={handleSubmit} autoComplete="off" className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="new_contact_name"
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
                name="new_contact_email"
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
                  name="new_contact_phone"
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
                name="new_contact_company"
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
              name="new_contact_description"
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
                name="new_contact_location"
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
                name="new_contact_website"
                autoComplete="off"
                value={form.websiteLink}
                onChange={(e) => setForm({ ...form, websiteLink: e.target.value })}
                placeholder="e.g., https://linkedin.com/in/..."
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
