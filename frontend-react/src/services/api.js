import axios from "axios";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:8080";

let inMemoryToken = typeof localStorage !== "undefined" ? localStorage.getItem("scm_jwt_token") : null;

export function setAuthToken(token, user = null) {
  inMemoryToken = token;
  if (token) {
    localStorage.setItem("scm_jwt_token", token);
  } else {
    localStorage.removeItem("scm_jwt_token");
  }
  if (user) {
    localStorage.setItem("scm_user_profile", JSON.stringify(user));
  } else if (!token) {
    localStorage.removeItem("scm_user_profile");
  }
}

export function getAuthToken() {
  return inMemoryToken || localStorage.getItem("scm_jwt_token");
}

let pendingOAuthToast = null;

export function consumePendingOAuthToast() {
  const t = pendingOAuthToast;
  pendingOAuthToast = null;
  return t;
}

export function getStoredUser() {
  try {
    if (typeof window !== "undefined" && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const signupSuccess = params.get("signup_success") === "1";
      const oauthToken = params.get("oauth_token");
      const oauthUserRaw = params.get("oauth_user");
      const oauthError = params.get("oauth_error");
      const intent = params.get("intent") || "login";

      if (signupSuccess) {
        const emailParam = params.get("email") || "";
        const nextUrl = emailParam
          ? `/login?email=${encodeURIComponent(emailParam)}`
          : "/login";
        window.history.replaceState({}, document.title, nextUrl);
        pendingOAuthToast = {
          variant: "success",
          title: "Account registered",
          detail: "Account registered successfully! Please sign in with your email and password."
        };
        return null;
      }

      if (oauthToken && oauthUserRaw) {
        if (intent === "signup") {
          window.history.replaceState({}, document.title, "/login");
          pendingOAuthToast = {
            variant: "success",
            title: "Account registered",
            detail: "Account registered successfully! Please sign in with your email and password."
          };
          return null;
        }
        const parsedUser = JSON.parse(oauthUserRaw);
        setAuthToken(oauthToken, parsedUser);
        window.history.replaceState({}, document.title, "/");
        pendingOAuthToast = {
          variant: "success",
          title: "Signed in with Google",
          detail: `Signed in with Google as ${parsedUser.email}`
        };
        return parsedUser;
      } else if (oauthError) {
        window.history.replaceState({}, document.title, window.location.pathname);
        pendingOAuthToast = {
          variant: "error",
          title: "Authentication Error",
          detail: oauthError
        };
      }
    }

    const raw = localStorage.getItem("scm_user_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.email &&
      parsed.email.endsWith("@scm.enterprise.io") &&
      parsed.email !== "admin@scm.enterprise.io"
    ) {
      localStorage.removeItem("scm_user_profile");
      localStorage.removeItem("scm_jwt_token");
      return null;
    }
    return parsed;
  } catch (_e) {
    return null;
  }
}

export function generateCorrelationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Format international phone numbers with country flag & readable spacing
 */
export function formatPhoneWithFlag(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return { flag: "🌐", formatted: "—" };
  if (raw.startsWith("+971")) {
    const rest = raw.slice(4).replace(/\D/g, "");
    return { flag: "🇦🇪", code: "+971", formatted: `+971 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`.trim() };
  }
  if (raw.startsWith("+91")) {
    const rest = raw.slice(3).replace(/\D/g, "");
    const grouped = rest.length === 10 ? `${rest.slice(0, 5)} ${rest.slice(5)}` : rest;
    return { flag: "🇮🇳", code: "+91", formatted: `+91 ${grouped}` };
  }
  if (raw.startsWith("+1")) {
    const rest = raw.slice(2).replace(/\D/g, "");
    const grouped =
      rest.length === 10 ? `(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}` : rest;
    return { flag: "🇺🇸", code: "+1", formatted: `+1 ${grouped}` };
  }
  if (raw.startsWith("+44")) {
    const rest = raw.slice(3).replace(/\D/g, "");
    return { flag: "🇬🇧", code: "+44", formatted: `+44 ${rest.slice(0, 4)} ${rest.slice(4)}` };
  }
  if (raw.startsWith("+61")) {
    const rest = raw.slice(3).replace(/\D/g, "");
    return { flag: "🇦🇺", code: "+61", formatted: `+61 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim() };
  }
  if (raw.startsWith("+49")) {
    const rest = raw.slice(3).replace(/\D/g, "");
    return { flag: "🇩🇪", code: "+49", formatted: `+49 ${rest.slice(0, 2)} ${rest.slice(2)}` };
  }
  if (raw.startsWith("+65")) {
    const rest = raw.slice(3).replace(/\D/g, "");
    return { flag: "🇸🇬", code: "+65", formatted: `+65 ${rest.slice(0, 4)} ${rest.slice(4)}` };
  }
  return { flag: "🌐", code: "", formatted: raw };
}

export function getInitials(name) {
  const parts = String(name || "Contact")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function inferContactTag(contact) {
  if (contact?.tag) return contact.tag;
  const desc = String(contact?.description || "").toLowerCase();
  if (desc.includes("family") || desc.includes("mom") || desc.includes("home")) return "Family";
  if (desc.includes("vp") || desc.includes("founder") || desc.includes("procurement")) return "Lead";
  if (contact?.favorite) return "VIP";
  return "Colleague";
}

export function formatShortDate(isoString) {
  if (!isoString) return "Oct 10";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Oct 10";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (_e) {
    return "Oct 10";
  }
}

/**
 * Generates and downloads a standard vCard 3.0 file for Apple / Google Contacts
 */
export function downloadVCard(contact, onNotify) {
  if (!contact || !contact.name) return;

  const fullName = String(contact.name).trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const phone = contact.phoneNumber || "";
  const email = contact.email || "";
  const address = contact.address || "";
  const company = contact.company || "";
  const description = contact.description || "";

  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    `N:${lastName};${firstName};;;`,
    email ? `EMAIL;TYPE=INTERNET:${email}` : "",
    phone ? `TEL;TYPE=CELL:${phone}` : "",
    address ? `ADR;TYPE=WORK:;;${address.replace(/[\r\n]+/g, " ")};;;;` : "",
    company ? `ORG:${company}` : "",
    description ? `TITLE:${description.replace(/[\r\n]+/g, " ")}` : "",
    "END:VCARD"
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = `${fullName.replace(/\s+/g, "_")}.vcf`;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  onNotify?.({
    variant: "success",
    title: "vCard downloaded!",
    detail: "Open file to save to phone contacts."
  });
}

/**
 * Returns formatted status and styling badge for follow-up reminder dates
 */
export function getFollowUpStatus(followUpDate) {
  if (!followUpDate) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parsedDate = new Date(followUpDate);
    const dateStr = String(followUpDate).slice(0, 10);
    const dateParts = dateStr.split("-");
    if (dateParts.length !== 3) return null;
    const target = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const hasTime =
      String(followUpDate).includes("T") &&
      !isNaN(parsedDate.getTime()) &&
      (parsedDate.getHours() !== 0 || parsedDate.getMinutes() !== 0);
    const timeStr = hasTime
      ? ` at ${parsedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
      : "";

    if (diffDays < 0) {
      return {
        label: `Overdue: ${formatted}`,
        isOverdue: true,
        style: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60"
      };
    }
    if (diffDays === 0) {
      return {
        label: `Follow up: Today${timeStr}`,
        isToday: true,
        style: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
      };
    }
    if (diffDays === 1) {
      return {
        label: `Follow up: Tomorrow${timeStr}`,
        isTomorrow: true,
        style: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
      };
    }
    return {
      label: `Follow up: ${formatted}${timeStr}`,
      isUpcoming: true,
      style: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Mask sensitive personal phone numbers for demo mode and safe exports
 * Keeps country code/prefix and replaces the last 5 digits with asterisks
 */
export function maskPhoneNumber(phone) {
  if (!phone || !String(phone).trim()) return "—";
  let raw = String(phone).trim();
  if (!raw.startsWith("+") && raw.startsWith("91") && raw.length >= 12) {
    raw = "+91 " + raw.slice(2);
  } else if (!raw.startsWith("+") && raw.startsWith("1") && raw.length === 11) {
    raw = "+1 " + raw.slice(1);
  }
  const phoneInfo = formatPhoneWithFlag(raw);
  const formatted = phoneInfo.formatted !== "—" ? phoneInfo.formatted : raw;

  let count = 0;
  const chars = formatted.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    if (/\d/.test(chars[i])) {
      chars[i] = "*";
      count++;
      if (count >= 5) break;
    }
  }
  return chars.join("");
}

/**
 * Mask sensitive email addresses for demo mode and safe exports
 * Masks student roll numbers (student****@domain) and personal emails (khat****@domain)
 */
export function maskEmailAddress(email) {
  if (!email || !String(email).trim()) return "—";
  const str = String(email).trim();
  const atIndex = str.indexOf("@");
  if (atIndex === -1) return str;
  const local = str.slice(0, atIndex);
  const domain = str.slice(atIndex + 1);

  if (/^\d+$/.test(local) || /^\d{6,}/.test(local)) {
    return `student****@${domain}`;
  }

  if (local.length <= 4) {
    return `${local.slice(0, 1)}****@${domain}`;
  }
  return `${local.slice(0, 4)}****@${domain}`;
}

/**
 * Return a sanitized copy of a contact with masked phone and email
 */
export function maskSensitiveData(contact) {
  if (!contact) return contact;
  return {
    ...contact,
    phoneNumber: maskPhoneNumber(contact.phoneNumber),
    email: maskEmailAddress(contact.email)
  };
}

/**
 * Export contacts list to CSV with optional PII masking
 */
export function exportContactsToCsv(contactsList, isMasked = false) {
  const headers = ["ID", "Name", "Email", "Phone", "Tag", "Company", "Role", "Location"];
  const rows = (contactsList || []).map((c) => {
    const email = isMasked ? maskEmailAddress(c.email) : (c.email || "");
    const phone = isMasked ? maskPhoneNumber(c.phoneNumber) : (c.phoneNumber || "");
    return [
      c.id,
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${email.replace(/"/g, '""')}"`,
      `"${phone.replace(/"/g, '""')}"`,
      inferContactTag(c),
      `"${(c.company || "").replace(/"/g, '""')}"`,
      `"${(c.description || "").replace(/"/g, '""')}"`,
      `"${(c.address || "").replace(/"/g, '""')}"`
    ];
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const prefix = isMasked ? "contacts-demo-masked" : "contacts";
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export contacts list to Printable PDF view with optional PII masking
 */
export function exportContactsToPdf(contactsList, isMasked = false) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    if (typeof alert !== "undefined") {
      alert("Please allow popups to generate and print PDF.");
    }
    return;
  }

  const title = isMasked
    ? "Smart Contact Manager — Demo Safe Directory (PII Masked)"
    : "Smart Contact Manager — Contact Directory";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const rowsHtml = (contactsList || [])
    .map((c, idx) => {
      const email = isMasked ? maskEmailAddress(c.email) : (c.email || "—");
      const phone = isMasked ? maskPhoneNumber(c.phoneNumber) : (c.phoneNumber || "—");
      const tag = inferContactTag(c);
      return `
        <tr style="border-bottom: 1px solid #e4e4e7; ${idx % 2 === 1 ? "background-color: #fafafa;" : ""}">
          <td style="padding: 8px 12px; font-weight: 600; color: #18181b;">${escapeHtml(c.name || "Unnamed")}</td>
          <td style="padding: 8px 12px; color: #52525b; font-family: monospace;">${escapeHtml(phone)}</td>
          <td style="padding: 8px 12px; color: #52525b; font-family: monospace;">${escapeHtml(email)}</td>
          <td style="padding: 8px 12px; color: #27272a;">${escapeHtml(c.company || "—")}</td>
          <td style="padding: 8px 12px; color: #52525b;">${escapeHtml(c.description || "—")}</td>
          <td style="padding: 8px 12px;"><span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; background: #f4f4f5; border: 1px solid #e4e4e7; color: #3f3f46;">${escapeHtml(tag)}</span></td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #18181b; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #e4e4e7; padding-bottom: 14px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; color: #09090b; }
          .badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: ${isMasked ? "#ecfdf5; color: #065f46; border: 1px solid #a7f3d0;" : "#f4f4f5; color: #52525b; border: 1px solid #e4e4e7;"}; }
          .meta { font-size: 12px; color: #71717a; text-align: right; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-top: 10px; }
          th { padding: 10px 12px; background-color: #f4f4f5; color: #3f3f46; font-weight: 600; border-bottom: 2px solid #e4e4e7; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${title}</h1>
            <div class="badge">${isMasked ? "🛡️ Privacy Protected • PII Masked for Demo/Sharing" : "📋 Standard Contact Directory"}</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${dateStr}</div>
            <div><strong>Total Records:</strong> ${(contactsList || []).length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Company</th>
              <th>Role</th>
              <th>Tag</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Infer Timezone, Region & Working Hours Intelligence for a contact
 */
export function getLocationAndTimezoneInfo(contact) {
  const address = String(contact?.address || "").trim();
  const phone = String(contact?.phoneNumber || "").trim();
  const lowerAddr = address.toLowerCase();

  let timezone = "Asia/Kolkata";
  let tzLabel = "IST";
  let tzOffset = "UTC+5:30";
  let region = "India";

  if (
    lowerAddr.includes(", in") ||
    lowerAddr.includes("india") ||
    lowerAddr.includes("punjab") ||
    lowerAddr.includes("delhi") ||
    lowerAddr.includes("bathinda") ||
    lowerAddr.includes("mumbai") ||
    lowerAddr.includes("bengaluru") ||
    lowerAddr.includes("bangalore") ||
    phone.startsWith("+91")
  ) {
    timezone = "Asia/Kolkata";
    tzLabel = "IST";
    tzOffset = "UTC+5:30";
    region = "India";
  } else if (
    lowerAddr.includes("san francisco") ||
    lowerAddr.includes("los angeles") ||
    lowerAddr.includes("seattle") ||
    lowerAddr.includes(", ca") ||
    lowerAddr.includes(", wa")
  ) {
    timezone = "America/Los_Angeles";
    tzLabel = "PT";
    tzOffset = "UTC-7";
    region = "United States (West)";
  } else if (
    lowerAddr.includes("new york") ||
    lowerAddr.includes("boston") ||
    lowerAddr.includes(", ny") ||
    lowerAddr.includes(", ma") ||
    lowerAddr.includes(", fl") ||
    lowerAddr.includes("miami")
  ) {
    timezone = "America/New_York";
    tzLabel = "ET";
    tzOffset = "UTC-4";
    region = "United States (East)";
  } else if (
    lowerAddr.includes("usa") ||
    lowerAddr.includes("united states") ||
    phone.startsWith("+1")
  ) {
    timezone = "America/New_York";
    tzLabel = "ET";
    tzOffset = "UTC-4";
    region = "United States";
  } else if (
    lowerAddr.includes("london") ||
    lowerAddr.includes("uk") ||
    lowerAddr.includes("united kingdom") ||
    phone.startsWith("+44")
  ) {
    timezone = "Europe/London";
    tzLabel = "BST";
    tzOffset = "UTC+1";
    region = "United Kingdom";
  } else if (
    lowerAddr.includes("dubai") ||
    lowerAddr.includes("uae") ||
    lowerAddr.includes("abu dhabi") ||
    phone.startsWith("+971")
  ) {
    timezone = "Asia/Dubai";
    tzLabel = "GST";
    tzOffset = "UTC+4";
    region = "United Arab Emirates";
  } else if (lowerAddr.includes("singapore") || phone.startsWith("+65")) {
    timezone = "Asia/Singapore";
    tzLabel = "SGT";
    tzOffset = "UTC+8";
    region = "Singapore";
  } else if (
    lowerAddr.includes("berlin") ||
    lowerAddr.includes("germany") ||
    lowerAddr.includes("munich") ||
    phone.startsWith("+49")
  ) {
    timezone = "Europe/Berlin";
    tzLabel = "CEST";
    tzOffset = "UTC+2";
    region = "Germany";
  } else if (
    lowerAddr.includes("sydney") ||
    lowerAddr.includes("melbourne") ||
    lowerAddr.includes("australia") ||
    phone.startsWith("+61")
  ) {
    timezone = "Australia/Sydney";
    tzLabel = "AEST";
    tzOffset = "UTC+10";
    region = "Australia";
  }

  // Calculate local time in the contact's timezone
  let localTimeStr = "12:00 PM";
  let isWorkingHours = false;
  let statusText = "Outside working hours";

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    localTimeStr = formatter.format(now);

    // Check if within business hours (9:00 AM – 6:30 PM local time, Mon–Fri)
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    });
    const parts = dayFormatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

    const isWeekend = weekday === "Sat" || weekday === "Sun";
    const totalMinutes = hour * 60 + minute;
    const workStartMinutes = 9 * 60; // 9:00 AM
    const workEndMinutes = 18 * 60 + 30; // 6:30 PM

    if (!isWeekend && totalMinutes >= workStartMinutes && totalMinutes < workEndMinutes) {
      isWorkingHours = true;
      statusText = "Available for calls";
    } else if (isWeekend) {
      statusText = "Weekend • Outside hours";
    } else {
      statusText = "Outside hours • Text / WhatsApp";
    }
  } catch (_e) {
    localTimeStr = "12:00 PM";
  }

  // Extract clean city / locality from address
  let cityRegion = address || "Location unlisted";
  if (address) {
    const segments = address.split(",").map((s) => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      cityRegion = `${segments[0]}, ${segments[1]}`;
    } else if (segments.length === 1) {
      cityRegion = segments[0];
    }
  }

  return {
    hasAddress: Boolean(address),
    rawAddress: address,
    cityRegion,
    timezone,
    tzLabel,
    tzOffset,
    region,
    localTimeStr,
    isWorkingHours,
    statusText,
    googleMapsUrl: address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null
  };
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers["X-Correlation-ID"]) {
    config.headers["X-Correlation-ID"] = generateCorrelationId();
  }
  return config;
});

export function parseRfc7807Error(err) {
  const data = err?.response?.data;
  if (data && typeof data === "object" && (data.title || data.detail)) {
    return {
      type: data.type || "https://scm.enterprise.io/problems/error",
      title: data.title || "Request Error",
      status: data.status || err?.response?.status || 500,
      detail: data.detail || err.message,
      correlationId:
        data.correlationId || err?.response?.headers?.["x-correlation-id"] || null,
      errors: data.errors || null
    };
  }
  return {
    type: "https://scm.enterprise.io/problems/network-error",
    title: "Connection Error",
    status: err?.response?.status || 503,
    detail: err?.message || "Unable to reach the SCM API server on port 8080.",
    correlationId: err?.response?.headers?.["x-correlation-id"] || null,
    errors: null
  };
}

export const contactApi = {
  async list({ cursor = null, limit = 25, search = "", favorite = null, tag = null } = {}) {
    const params = { limit, _ts: Date.now() };
    if (cursor) params.cursor = cursor;
    if (search && search.trim()) params.search = search.trim();
    if (favorite !== null) params.favorite = favorite;
    if (tag && tag !== "ALL") params.tag = tag;
    const response = await api.get("/v1/contacts", { params });
    return {
      ...response.data,
      linkHeader: response.headers.link || null,
      etag: response.headers.etag || null,
      correlationId: response.headers["x-correlation-id"]
    };
  },

  async getById(id) {
    const response = await api.get(`/v1/contacts/${id}`);
    return {
      contact: response.data,
      etag: response.headers.etag,
      cacheControl: response.headers["cache-control"]
    };
  },

  async create(payload, idempotencyKey = generateCorrelationId()) {
    const response = await api.post("/v1/contacts", payload, {
      headers: { "Idempotency-Key": idempotencyKey }
    });
    return response.data;
  },

  async update(id, payload) {
    const response = await api.put(`/v1/contacts/${id}`, payload);
    return response.data;
  },

  async patch(id, partialPayload) {
    const response = await api.patch(`/v1/contacts/${id}`, partialPayload);
    return response.data;
  },

  async remove(id) {
    await api.delete(`/v1/contacts/${id}`);
  },

  async uploadPhoto(file) {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      throw {
        response: {
          status: 422,
          data: {
            title: "Unsupported File Format",
            status: 422,
            detail: `Format '${file.type}' is not supported. Please upload a JPG, PNG, or WebP image.`
          }
        }
      };
    }
    if (file.size > 2 * 1024 * 1024) {
      throw {
        response: {
          status: 422,
          data: {
            title: "File Too Large",
            status: 422,
            detail: `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the 2MB limit.`
          }
        }
      };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await api.post("/v1/media/photos", {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      dataUrl
    });
    return response.data;
  },

  async verifyPhoneViaSoap(phoneNumber) {
    const response = await api.post(
      "/v1/soap/execute",
      { operation: "VerifyPhoneNumber", phoneNumber },
      { headers: { SOAPAction: "http://scm.enterprise.io/ws/telecom/VerifyPhoneNumber" } }
    );
    return response.data;
  },

  async getAuditLogs() {
    const response = await api.get("/v1/documents/audit-logs");
    return response.data?.documents || [];
  },

  async getResilienceStatus() {
    const response = await api.get("/v1/resilience/status");
    return response.data;
  },

  async executeGraphQL(query) {
    const response = await api.post("/graphql", { query });
    return response.data;
  }
};

export const authApi = {
  async login(email, password) {
    const response = await api.post("/v1/auth/tokens", { email, password });
    setAuthToken(response.data.accessToken, response.data.user);
    return response.data;
  },

  async signup({ name, email, password, phoneNumber }) {
    const response = await api.post("/v1/auth/users", {
      name,
      email,
      password,
      phoneNumber
    });
    // Do NOT auto-set auth token on signup: user must sign in on /login first
    return response.data;
  },

  getGoogleOAuthUrl(intent = "login") {
    const params = new URLSearchParams({
      intent,
      prompt: "select_account"
    });
    return `${API_BASE_URL}/v1/auth/oauth2/google?${params.toString()}`;
  },

  async getGoogleConfig() {
    try {
      const response = await api.get("/v1/auth/oauth2/google/config");
      return response.data;
    } catch (_e) {
      return { isLive: false, clientId: null };
    }
  },

  async getGithubConfig() {
    try {
      const response = await api.get("/v1/auth/oauth2/github/config");
      return response.data;
    } catch (_e) {
      return { isLive: false, clientId: null };
    }
  },

  getGithubOAuthUrl(intent = "login") {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem("scm_github_oauth_intent", intent);
    }
    return `${API_BASE_URL}/v1/auth/oauth2/github?intent=${intent}`;
  },

  async googleOAuthExchange(profile = {}) {
    const endpoint =
      profile.intent === "signup"
        ? "/v1/auth/oauth2/google/signup"
        : "/v1/auth/oauth2/google/tokens";
    const response = await api.post(endpoint, {
      ...profile,
      prompt: "select_account"
    });
    if (profile.intent !== "signup") {
      setAuthToken(response.data.accessToken, response.data.user);
    }
    return response.data;
  },

  async githubOAuthExchange(profile = {}) {
    const endpoint =
      profile.intent === "signup"
        ? "/v1/auth/oauth2/github/signup"
        : "/v1/auth/oauth2/github/tokens";
    const response = await api.post(endpoint, profile);
    if (profile.intent !== "signup") {
      setAuthToken(response.data.accessToken, response.data.user);
    }
    return response.data;
  },

  async requestPasswordReset(email) {
    const response = await api.post("/v1/auth/password-resets", { email });
    return response.data;
  },

  async logout() {
    try {
      await api.delete("/v1/auth/tokens");
    } finally {
      setAuthToken(null, null);
    }
  }
};

export const notificationApi = {
  async sendEmail({ to, subject, body }) {
    const response = await api.post("/v1/notifications/emails", {
      to,
      subject,
      body,
      type: "USER_COMPOSE"
    });
    return response.data;
  }
};

export const aiApi = {
  async parseContact(rawText) {
    try {
      const response = await api.post("/v1/ai/parse-contact", { rawText });
      return response.data;
    } catch (_err) {
      // Resilient client-side fallback (handles offline, 404, or stale gateway process)
      const trimmed = String(rawText || "").trim();
      const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const phoneMatch = trimmed.match(/(\+?[0-9][0-9\-\s()]{7,18}[0-9])/);
      const nameMatch = trimmed.match(/(?:\bmet\s+|\bname[:\s]+|\bcontact[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      const companyMatch = trimmed.match(/(?:at|from|company[:\s]+)\s+([A-Z0-9][A-Za-z0-9&.\s]+?)(?:,|\.|\bcall\b|\bemail\b|\blocated\b|$)/i);
      const roleMatch = trimmed.match(/\b(VP|Vice President|Director|Architect|Engineer|Developer|Manager|Founder|Co-Founder|CEO|CTO|Lead|Consultant)\b(?:\s+(?:of|at|in)?\s+[A-Za-z]+)?/i);
      const locMatch = trimmed.match(/(?:located in|in|address[:\s]+)\s+([A-Z][a-zA-Z\s]+?)(?:$|\.|,)/i);

      let extractedName = nameMatch ? nameMatch[1].trim() : null;
      if (extractedName && extractedName.toLowerCase().startsWith("met ")) {
        extractedName = extractedName.substring(4).trim();
      }
      if (!extractedName) {
        const parts = trimmed.split(/[,\\n]/);
        for (const p of parts) {
          const candidate = p.trim();
          if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(candidate)) {
            extractedName = candidate;
            break;
          }
        }
      }

      let tag = "Colleague";
      const lower = trimmed.toLowerCase();
      if (/vip|ceo|founder|director/.test(lower)) tag = "VIP";
      else if (/lead|client|prospect|fintech|vp/.test(lower)) tag = "Lead";
      else if (/family|cousin|brother|sister/.test(lower)) tag = "Family";

      return {
        name: extractedName || "New Contact",
        email: emailMatch ? emailMatch[1].trim() : null,
        phoneNumber: phoneMatch ? phoneMatch[1].replace(/[^0-9+]/g, "").trim() : null,
        company: companyMatch ? companyMatch[1].trim() : null,
        role: roleMatch ? roleMatch[0].trim() : null,
        address: locMatch ? locMatch[1].trim() : null,
        tag
      };
    }
  },

  async draftEmail({ contactName, company, prompt, senderName }) {
    try {
      const response = await api.post("/v1/ai/draft-email", {
        contactName,
        company,
        prompt,
        senderName
      });
      return response.data;
    } catch (_err) {
      // Resilient client-side fallback (handles offline, 404, or stale gateway process)
      const cName = contactName && String(contactName).trim() ? String(contactName).trim() : "there";
      const sName = senderName && String(senderName).trim() ? String(senderName).trim() : "Smart Contact Manager";
      const cCompany = company && String(company).trim() ? String(company).trim() : "";
      const trimmedPrompt = String(prompt || "").trim();
      const companyMention = cCompany ? ` at ${cCompany}` : "";
      const promptLower = trimmedPrompt.toLowerCase();

      let subject;
      let body;

      if (promptLower.includes("coffee")) {
        subject = "Thank you for the coffee chat!";
        body = `Hi ${cName},\n\nIt was great catching up over coffee today! Really enjoyed our conversation and hearing your thoughts.\n\nLet's stay in touch and connect again soon.\n\nBest regards,\n${sName}`;
      } else if (promptLower.includes("meeting") || promptLower.includes("follow up") || promptLower.includes("follow-up")) {
        subject = `Great meeting you${companyMention} - Follow up`;
        body = `Hi ${cName},\n\nThank you for taking the time to meet today. I wanted to quickly follow up on our discussion and align on the next steps.\n\nPlease let me know your thoughts or when you might be free for a quick chat.\n\nBest regards,\n${sName}`;
      } else if (promptLower.includes("congrat") || promptLower.includes("congratulations")) {
        subject = "Congratulations!";
        body = `Hi ${cName},\n\nWanted to send my warmest congratulations on your exciting news! Wishing you all the continued success.\n\nWarm regards,\n${sName}`;
      } else if (promptLower.includes("contract") || promptLower.includes("proposal")) {
        subject = `Follow up: Contract & Proposal Discussion${companyMention}`;
        body = `Hi ${cName},\n\nI hope you're having a productive week${companyMention ? ` at ${cCompany}` : ""}.\n\nI'm following up on our proposal and contract terms we discussed.\n\nPlease let me know if you have any questions or if you'd like to make adjustments.\n\nBest regards,\n${sName}`;
      } else if (promptLower.includes("schedule") || promptLower.includes("call") || promptLower.includes("sync")) {
        subject = "Quick sync: Schedule a call";
        body = `Hi ${cName},\n\nHope all is well. I'd love to schedule a brief call this week to catch up and align on our next steps.\n\nLet me know what time works best for you.\n\nBest regards,\n${sName}`;
      } else if (promptLower.includes("thank")) {
        subject = "Thank you - Follow up regarding our discussion";
        body = `Hi ${cName},\n\nThank you for your time and for connecting with me${companyMention ? ` at ${cCompany}` : ""}. I really appreciate our conversation and look forward to continuing our collaboration.\n\nPlease let me know if there is anything else I can provide on my end.\n\nBest regards,\n${sName}`;
      } else {
        let cleanPrompt = trimmedPrompt.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
        if (cleanPrompt.length > 40) cleanPrompt = cleanPrompt.substring(0, 40).trim() + "...";
        subject = `Follow-up: ${cleanPrompt}`;
        body = `Hi ${cName},\n\nI hope this email finds you well${companyMention ? ` at ${cCompany}` : ""}.\n\nI wanted to reach out regarding ${trimmedPrompt}. I believe this is a great opportunity to collaborate and ensure everything is aligned smoothly.\n\nPlease let me know your availability for a brief conversation this week, or feel free to share your thoughts over email.\n\nBest regards,\n${sName}`;
      }

      return { subject, body };
    }
  }
};
