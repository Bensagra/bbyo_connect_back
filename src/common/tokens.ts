import argon2 from "argon2";
import dayjs from "dayjs";
import { randomUUID } from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { Role, UserStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

type AccessTokenClaims = JwtPayload & {
  sub: string;
  role: Role;
  status: UserStatus;
};

type RefreshTokenClaims = JwtPayload & {
  sub: string;
  sid: string;
  typ: "refresh";
};

export function signAccessToken(user: { id: string; role: Role; status: UserStatus }) {
  const options: SignOptions = {
    expiresIn: env.accessTokenTtl as SignOptions["expiresIn"],
    issuer: env.jwtIssuer,
  };

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      status: user.status,
    },
    env.accessTokenSecret,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.accessTokenSecret, { issuer: env.jwtIssuer }) as AccessTokenClaims;
}

function signRefreshToken(payload: { sub: string; sid: string }) {
  const options: SignOptions = {
    expiresIn: `${env.refreshTokenTtlDays}d` as SignOptions["expiresIn"],
    issuer: env.jwtIssuer,
  };

  return jwt.sign(
    {
      sub: payload.sub,
      sid: payload.sid,
      typ: "refresh",
    },
    env.refreshTokenSecret,
    options,
  );
}

function verifyRefreshToken(token: string): RefreshTokenClaims {
  return jwt.verify(token, env.refreshTokenSecret, { issuer: env.jwtIssuer }) as RefreshTokenClaims;
}

export async function issueTokenPair(
  user: { id: string; role: Role; status: UserStatus },
  context?: { deviceInfo?: unknown; ipAddress?: string },
) {
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId });
  const tokenHash = await argon2.hash(refreshToken);
  const expiresAt = dayjs().add(env.refreshTokenTtlDays, "day").toDate();

  await prisma.sessionRefreshToken.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      deviceInfo: context?.deviceInfo as object | undefined,
      ipAddress: context?.ipAddress,
      expiresAt,
    },
  });

  const accessToken = signAccessToken(user);

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
}

export async function rotateRefreshToken(refreshToken: string, context?: { deviceInfo?: unknown; ipAddress?: string }) {
  const claims = verifyRefreshToken(refreshToken);
  if (!claims.sub || !claims.sid || claims.typ !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }

  const session = await prisma.sessionRefreshToken.findUnique({
    where: { id: claims.sid },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new Error("Refresh session is invalid or expired");
  }

  const hashOk = await argon2.verify(session.tokenHash, refreshToken);
  if (!hashOk) {
    throw new Error("Refresh token hash mismatch");
  }

  await prisma.sessionRefreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const pair = await issueTokenPair(
    {
      id: session.user.id,
      role: session.user.role,
      status: session.user.status,
    },
    context,
  );

  return {
    ...pair,
    user: session.user,
  };
}

export async function revokeRefreshToken(rawRefreshToken: string) {
  const claims = verifyRefreshToken(rawRefreshToken);
  if (!claims.sid) {
    return;
  }

  await prisma.sessionRefreshToken.updateMany({
    where: {
      id: claims.sid,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
