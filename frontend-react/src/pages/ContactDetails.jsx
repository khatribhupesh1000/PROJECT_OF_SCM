import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Globe, Trash2, Phone, Clock, Navigation } from "lucide-react";
import CallWhatsAppActions from "../components/CallWhatsAppActions.jsx";
import { getTagBadgeStyle } from "../components/ContactDrawer.jsx";
import {
  contactApi,
  parseRfc7807Error,
  formatPhoneWithFlag,
  getInitials,
  inferContactTag,
  getLocationAndTimezoneInfo
} from "../services/api.js";

export default function ContactDetails({ onNotify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await contactApi.getById(id);
        if (mounted) {
          setContact(res.contact);
        }
      } catch (err) {
        if (mounted) {
          onNotify({ variant: "error", ...parseRfc7807Error(err) });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-48 bg-zinc-200/70 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs text-rose-500">Contact record not found.</p>
        <Link to="/" className="mt-2 inline-block text-xs text-zinc-500 hover:underline">
          &larr; Return to directory
        </Link>
      </div>
    );
  }

  const phoneInfo = formatPhoneWithFlag(contact.phoneNumber);
  const tag = inferContactTag(contact);
  const locInfo = getLocationAndTimezoneInfo(contact);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to directory</span>
      </Link>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3.5">
            {contact.pictureUrl ? (
              <img
                src={contact.pictureUrl}
                alt={contact.name}
                className="w-12 h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-sm font-semibold flex items-center justify-center">
                {getInitials(contact.name)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {contact.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getTagBadgeStyle(
                    tag
                  )}`}
                >
                  {tag}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {contact.description || "Direct Contact"}
              </p>

              {/* 🕒 Live Timezone & Business Hours Intelligence */}
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  <Clock className="w-2.5 h-2.5 text-zinc-400" />
                  <span>{locInfo.localTimeStr}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">({locInfo.tzLabel})</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                    locInfo.isWorkingHours
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      locInfo.isWorkingHours ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  <span>{locInfo.statusText}</span>
                </span>
              </div>
            </div>
          </div>

          <CallWhatsAppActions
            phoneNumber={contact.phoneNumber}
            contactName={contact.name}
            address={contact.address}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3.5">
            <div className="text-zinc-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Phone</span>
            </div>
            <div className="mt-1 font-mono text-zinc-900 dark:text-zinc-100">
              {phoneInfo.flag} {phoneInfo.formatted}
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3.5">
            <div className="text-zinc-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </div>
            <div className="mt-1 font-mono text-zinc-900 dark:text-zinc-100 truncate">
              {contact.email && contact.email.trim() ? (
                contact.email
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic font-sans text-xs">
                  Not provided
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3.5">
            <div className="flex items-center justify-between">
              <div className="text-zinc-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Location</span>
              </div>
              {locInfo.hasAddress && (
                <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {locInfo.tzOffset}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-zinc-900 dark:text-zinc-100 truncate">
                {contact.address || "—"}
              </span>
              {locInfo.hasAddress && (
                <a
                  href={locInfo.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Directions</span>
                </a>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3.5">
            <div className="text-zinc-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </div>
            <div className="mt-1 font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {contact.websiteLink || "—"}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <span className="font-mono text-[11px] text-zinc-400">ID: {contact.id}</span>
          <button
            type="button"
            onClick={async () => {
              await contactApi.remove(contact.id);
              onNotify({
                variant: "success",
                title: "Contact deleted",
                detail: `Removed ${contact.name}`
              });
              navigate("/");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
