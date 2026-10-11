import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let inMemoryToken = localStorage.getItem("scm_jwt_token") || null;

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
          title: "Signed in",
          detail: `Authenticated as ${parsedUser.email}`
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

  async draftEmail({ contactName, company, prompt }) {
    try {
      const response = await api.post("/v1/ai/draft-email", {
        contactName,
        company,
        prompt
      });
      return response.data;
    } catch (_err) {
      // Resilient client-side fallback (handles offline, 404, or stale gateway process)
      const cName = contactName && String(contactName).trim() ? String(contactName).trim() : "there";
      const cCompany = company && String(company).trim() ? String(company).trim() : "";
      const trimmedPrompt = String(prompt || "").trim();
      const companyMention = cCompany ? ` at ${cCompany}` : "";
      const promptLower = trimmedPrompt.toLowerCase();

      let subject;
      if (promptLower.includes("thank")) {
        subject = `Thank you - Follow up regarding our discussion`;
      } else if (promptLower.includes("coffee") || promptLower.includes("meeting")) {
        subject = `Great meeting you${companyMention} - Next steps`;
      } else if (promptLower.includes("contract") || promptLower.includes("proposal")) {
        subject = `Follow up: Contract & Proposal Discussion${companyMention}`;
      } else if (promptLower.includes("schedule") || promptLower.includes("call")) {
        subject = `Quick sync on our upcoming roadmap`;
      } else {
        let cleanPrompt = trimmedPrompt.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
        if (cleanPrompt.length > 40) cleanPrompt = cleanPrompt.substring(0, 40).trim() + "...";
        subject = `Follow-up: ${cleanPrompt}`;
      }

      const body = `Hi ${cName},\n\nI hope you're having a productive week${companyMention ? ` at ${cCompany}` : ""}.\n\nI wanted to follow up regarding: ${trimmedPrompt}.\n\nPlease let me know your thoughts or when you might have a few minutes for a brief call to align on the next steps.\n\nLooking forward to speaking with you.\n\nBest regards,\nSmart Contact Manager Team`;

      return { subject, body };
    }
  }
};
