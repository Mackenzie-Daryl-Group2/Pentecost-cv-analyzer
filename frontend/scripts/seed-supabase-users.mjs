import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const envPath = path.join(frontendRoot, ".env.local");
const csvPath = path.resolve(frontendRoot, "..", "Proje", "data", "users.csv");

function loadEnvFile(filePath) {
  const loadedKeys = new Set();
  if (!existsSync(filePath)) return loadedKeys;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
    loadedKeys.add(key);
  }

  return loadedKeys;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);

  const [headers, ...dataRows] = rows;
  return dataRows.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), (values[index] || "").trim()])
    )
  );
}

async function findUserByEmail(supabase, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail
    );
    if (user) return user;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

function normalizeRole(role) {
  const rawRole = String(role || "user").trim().toLowerCase();

  if (rawRole === "provc" || rawRole === "pro-vc") return "pro_vc";
  if (rawRole === "hr_manager") return "hr";
  if (["user", "hr", "pro_vc", "admin", "registrar"].includes(rawRole)) return rawRole;

  return "user";
}

function mapCsvUserToAuthUser(row) {
  const legacyUserId = row.id?.trim();
  const username = row.username?.trim();
  const email = row.email?.trim().toLowerCase();
  const password = row.password?.trim();
  const role = normalizeRole(row.role);

  return {
    legacyUserId,
    username,
    email,
    password,
    role,
    userMetadata: {
      legacy_user_id: legacyUserId,
      username,
      email,
      role,
      full_name: username,
      source: "Proje/data/users.csv",
    },
    appMetadata: {
      legacy_user_id: legacyUserId,
      role,
    },
  };
}

async function upsertAuthUser(supabase, row) {
  const mappedUser = mapCsvUserToAuthUser(row);
  const { email, password, username, role, userMetadata, appMetadata } = mappedUser;

  if (!email || !password || !username) {
    return { email: email || username || "unknown", status: "skipped", reason: "missing required fields" };
  }

  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  };

  const created = await supabase.auth.admin.createUser(attributes);

  if (!created.error) {
    return { email, status: "created", role };
  }

  const duplicate =
    created.error.message.toLowerCase().includes("already") ||
    created.error.message.toLowerCase().includes("registered");

  if (!duplicate) throw created.error;

  const existingUser = await findUserByEmail(supabase, email);
  if (!existingUser) throw created.error;

  const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password,
    user_metadata: {
      ...(existingUser.user_metadata || {}),
      ...userMetadata,
    },
    app_metadata: {
      ...(existingUser.app_metadata || {}),
      ...appMetadata,
    },
  });

  if (error) throw error;

  return { email, status: "updated", role };
}

async function main() {
  const loadedEnvKeys = loadEnvFile(envPath);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to frontend/.env.local before running this seed."
    );
  }

  if (!loadedEnvKeys.has("SUPABASE_SERVICE_ROLE_KEY")) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY was not found in frontend/.env.local. Using the shell environment value instead."
    );
  }

  if (!existsSync(csvPath)) {
    throw new Error(`Could not find users CSV at ${csvPath}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const users = parseCsv(readFileSync(csvPath, "utf8"));

  for (const user of users) {
    const result = await upsertAuthUser(supabase, user);
    const detail = result.reason ? ` (${result.reason})` : "";
    console.log(`${result.status.toUpperCase()}: ${result.email} ${result.role || ""}${detail}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
