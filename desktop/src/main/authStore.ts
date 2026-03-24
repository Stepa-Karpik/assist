import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type AuthStoreOptions = {
  secretsRoot: string;
  now?: () => Date;
  saltFactory?: () => Buffer;
};

type AuthConfigInput = {
  password?: string;
  totpSecret?: string;
};

type PersistedAuthConfig = {
  password?: {
    salt: string;
    hash: string;
  };
  totpSecret?: string;
};

export type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

const totpDigits = 6;
const totpStepSeconds = 30;
const totpWindowOffsets = [-1, 0, 1];

function normalizeOptionalSecret(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function derivePasswordHash(password: string, salt: Buffer): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function decodeBase32(secret: string): Buffer {
  const normalized = secret.toUpperCase().replace(/=+$/u, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const character of normalized) {
    const index = alphabet.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid TOTP secret");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotp(secret: string, unixTimeMs: number): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(unixTimeMs / 1000 / totpStepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** totpDigits;

  return code.toString().padStart(totpDigits, "0");
}

export class AuthStore {
  private readonly filePath: string;

  private readonly now: () => Date;

  private readonly saltFactory: () => Buffer;

  private config: PersistedAuthConfig;

  constructor({
    secretsRoot,
    now = () => new Date(),
    saltFactory = () => crypto.randomBytes(16)
  }: AuthStoreOptions) {
    this.filePath = path.join(secretsRoot, "auth.json");
    this.now = now;
    this.saltFactory = saltFactory;
    this.config = this.loadConfig();
  }

  getConfigState(): AuthConfigState {
    return {
      passwordConfigured: this.config.password !== undefined,
      totpConfigured: this.config.totpSecret !== undefined
    };
  }

  saveConfig({ password, totpSecret }: AuthConfigInput): AuthConfigState {
    const nextConfig: PersistedAuthConfig = {
      ...this.config
    };

    if (password !== undefined) {
      const normalizedPassword = normalizeOptionalSecret(password);

      if (normalizedPassword === undefined) {
        delete nextConfig.password;
      } else {
        const salt = this.saltFactory();
        nextConfig.password = {
          salt: salt.toString("hex"),
          hash: derivePasswordHash(normalizedPassword, salt)
        };
      }
    }

    if (totpSecret !== undefined) {
      const normalizedTotpSecret = normalizeOptionalSecret(totpSecret);

      if (normalizedTotpSecret === undefined) {
        delete nextConfig.totpSecret;
      } else {
        // Validate the secret before persisting it.
        decodeBase32(normalizedTotpSecret);
        nextConfig.totpSecret = normalizedTotpSecret;
      }
    }

    this.config = nextConfig;
    this.persistConfig();
    return this.getConfigState();
  }

  validatePassword(value: string): boolean {
    const passwordConfig = this.config.password;

    if (passwordConfig === undefined) {
      return false;
    }

    const actualHash = derivePasswordHash(value, Buffer.from(passwordConfig.salt, "hex"));
    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(passwordConfig.hash, "hex");

    return (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  validateTotp(value: string): boolean {
    const totpSecret = this.config.totpSecret;

    if (totpSecret === undefined) {
      return false;
    }

    const now = this.now().getTime();
    return totpWindowOffsets.some((offset) => {
      const candidateCode = generateTotp(totpSecret, now + offset * totpStepSeconds * 1000);
      return candidateCode === value;
    });
  }

  private loadConfig(): PersistedAuthConfig {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    const rawConfig = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(rawConfig) as PersistedAuthConfig;
    return parsed;
  }

  private persistConfig(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
  }
}
