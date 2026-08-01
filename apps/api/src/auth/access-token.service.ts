import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';

export type AccessTokenClaims = {
  sub: string;
  sid: string;
};

@Injectable()
export class AccessTokenService {
  private privateKeyPromise?: ReturnType<typeof importPKCS8>;
  private publicKeyPromise?: ReturnType<typeof importSPKI>;

  constructor(private readonly config: ConfigService) {}

  async sign(claims: AccessTokenClaims): Promise<string> {
    const privateKey = await this.getPrivateKey();
    const issuer = this.config.getOrThrow<string>('JWT_ISSUER');
    const audience = this.config.getOrThrow<string>('JWT_AUDIENCE');
    const ttlSeconds = this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');

    return new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(privateKey);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const publicKey = await this.getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
      audience: this.config.getOrThrow<string>('JWT_AUDIENCE')
    });

    if (!payload.sub || typeof payload.sid !== 'string') {
      throw new Error('Access token is missing required claims.');
    }

    return {
      sub: payload.sub,
      sid: payload.sid
    };
  }

  private getPrivateKey() {
    this.privateKeyPromise ??= importPKCS8(this.readPemEnv('JWT_ACCESS_PRIVATE_KEY'), 'RS256');
    return this.privateKeyPromise;
  }

  private getPublicKey() {
    this.publicKeyPromise ??= importSPKI(this.readPemEnv('JWT_ACCESS_PUBLIC_KEY'), 'RS256');
    return this.publicKeyPromise;
  }

  private readPemEnv(key: string): string {
    return this.config.getOrThrow<string>(key).replace(/\\n/g, '\n');
  }
}
