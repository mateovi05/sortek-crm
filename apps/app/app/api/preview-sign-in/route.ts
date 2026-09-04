import { AUTH_COOKIE_PREFIX } from "@crm/auth/cookies";
import { db, PlatformRole } from "@crm/db";
import { NextResponse } from "next/server";

const COOKIE_NAME = `${AUTH_COOKIE_PREFIX}.session_token`;
const PREVIEW_EMAIL = "admin@sortek.local";
const SESSION_DAYS = 7;

/**
 * Local-only preview access. Production always responds with 404: real users
 * must authenticate through the configured identity provider.
 */
export async function POST() {
	if (process.env.NODE_ENV === "production")
		return new NextResponse(null, { status: 404 });
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret)
		return NextResponse.json(
			{ error: "Preview authentication is not configured." },
			{ status: 503 },
		);

	const user = await db.user.upsert({
		where: { email: PREVIEW_EMAIL },
		create: {
			id: "dev-sortek-platform-admin",
			email: PREVIEW_EMAIL,
			name: "SORTEK preview",
			emailVerified: true,
			platformRole: PlatformRole.PLATFORM_ADMIN,
			updatedAt: new Date(),
		},
		update: { platformRole: PlatformRole.PLATFORM_ADMIN },
	});
	const token = `preview-session-${user.id}`;
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1_000);
	await db.session.upsert({
		where: { token },
		create: {
			id: token,
			token,
			userId: user.id,
			expiresAt,
			updatedAt: new Date(),
		},
		update: { expiresAt },
	});

	const signature = await sign(token, secret);
	const response = NextResponse.json({ ok: true });
	response.cookies.set({
		name: COOKIE_NAME,
		// Next serializes cookie values itself. Pre-encoding here would make
		// Better Auth receive a doubly encoded value and reject the signature.
		value: `${token}.${signature}`,
		expires: expiresAt,
		httpOnly: true,
		sameSite: "lax",
		secure: false,
		path: "/",
	});
	return response;
}

async function sign(value: string, secret: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);
	return Buffer.from(signature).toString("base64");
}
