import fs from "node:fs";
import path from "node:path";

export type OwnerProfileState = {
  fullName: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  timezone: string | null;
  language: string | null;
  contacts: string | null;
  occupation: string | null;
  bio: string | null;
  notes: string | null;
};

export type OwnerProfileInput = Partial<OwnerProfileState>;

type OwnerProfileStoreOptions = {
  settingsRoot: string;
};

const defaultOwnerProfileState: OwnerProfileState = {
  fullName: null,
  gender: null,
  age: null,
  city: null,
  timezone: null,
  language: null,
  contacts: null,
  occupation: null,
  bio: null,
  notes: null
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAge(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 && normalized < 130 ? normalized : null;
}

function normalizeProfileState(value: Partial<OwnerProfileState> | undefined): OwnerProfileState {
  return {
    fullName: normalizeText(value?.fullName),
    gender: normalizeText(value?.gender),
    age: normalizeAge(value?.age),
    city: normalizeText(value?.city),
    timezone: normalizeText(value?.timezone),
    language: normalizeText(value?.language),
    contacts: normalizeText(value?.contacts),
    occupation: normalizeText(value?.occupation),
    bio: normalizeText(value?.bio),
    notes: normalizeText(value?.notes)
  };
}

export function isOwnerProfileComplete(profile: OwnerProfileState | Partial<OwnerProfileState>): boolean {
  const normalizedProfile = normalizeProfileState(profile);
  return Boolean(
    normalizedProfile.fullName &&
      normalizedProfile.gender &&
      normalizedProfile.age !== null
  );
}

export function buildOwnerProfileContext(profile: OwnerProfileState | Partial<OwnerProfileState>): string {
  const normalizedProfile = normalizeProfileState(profile);
  const lines: string[] = [];

  const entries: Array<[string, string | number | null]> = [
    ["Владелец", normalizedProfile.fullName],
    ["Пол", normalizedProfile.gender],
    ["Возраст", normalizedProfile.age],
    ["Город", normalizedProfile.city],
    ["Часовой пояс", normalizedProfile.timezone],
    ["Язык", normalizedProfile.language],
    ["Контакты", normalizedProfile.contacts],
    ["Род деятельности", normalizedProfile.occupation],
    ["Биография", normalizedProfile.bio],
    ["Заметки", normalizedProfile.notes]
  ];

  for (const [label, value] of entries) {
    if (value === null) {
      continue;
    }

    lines.push(`${label}: ${value}`);
  }

  return lines.join("\n");
}

export class OwnerProfileStore {
  private readonly filePath: string;

  private state: OwnerProfileState;

  constructor({ settingsRoot }: OwnerProfileStoreOptions) {
    this.filePath = path.join(settingsRoot, "owner-profile.json");
    this.state = this.load();
    this.persist();
  }

  getState(): OwnerProfileState {
    return { ...this.state };
  }

  save(nextState: OwnerProfileInput): OwnerProfileState {
    this.state = normalizeProfileState({
      ...this.state,
      ...nextState
    });
    this.persist();
    return this.getState();
  }

  replace(nextState: OwnerProfileInput): OwnerProfileState {
    this.state = normalizeProfileState(nextState);
    this.persist();
    return this.getState();
  }

  private load(): OwnerProfileState {
    if (!fs.existsSync(this.filePath)) {
      return { ...defaultOwnerProfileState };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<OwnerProfileState>;
      return normalizeProfileState(raw);
    } catch {
      return { ...defaultOwnerProfileState };
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
