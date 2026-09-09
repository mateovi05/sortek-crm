import { randomUUID, timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE_PREFIX } from "@crm/auth/cookies";
import { db, PlatformRole } from "@crm/db";
import { NextResponse } from "next/server";

const COOKIE_NAME = `${AUTH_COOKIE_PREFIX}.session_token`;
const PREVIEW_EMAIL = "admin@sortek.local";
const SESSION_DAYS = 7;
const DEFAULT_PIPELINE = [
	{ key: "new", label: "Nuevo", position: 0 },
	{ key: "contacted", label: "Contactado", position: 1 },
	{ key: "first-appointment", label: "Primera cita", position: 2 },
	{ key: "in-treatment", label: "En tratamiento", position: 3 },
	{ key: "follow-up", label: "Seguimiento", position: 4 },
	{ key: "won", label: "Ganado", position: 5, isClosed: true, isWon: true },
	{ key: "lost", label: "Perdido", position: 6, isClosed: true },
] as const;

/**
 * Preview access is local-only unless a deployment explicitly configures a
 * private access key. This keeps production installs closed by default.
 */
export async function POST(request: Request) {
	const configuredAccessKey = process.env.CRM_PREVIEW_ACCESS_KEY;
	const isProduction = process.env.NODE_ENV === "production";

	if (isProduction && !configuredAccessKey)
		return new NextResponse(null, { status: 404 });

	if (configuredAccessKey) {
		const body = await request.json().catch(() => null);
		const submittedAccessKey =
			typeof body?.accessKey === "string" ? body.accessKey : "";
		if (!matchesSecret(submittedAccessKey, configuredAccessKey))
			return NextResponse.json(
				{ error: "La clave de acceso no es correcta." },
				{ status: 401 },
			);
	}

	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret)
		return NextResponse.json(
			{ error: "Preview authentication is not configured." },
			{ status: 503 },
		);

	const previewEmail = process.env.CRM_PREVIEW_ADMIN_EMAIL ?? PREVIEW_EMAIL;
	const user = await db.user.upsert({
		where: { email: previewEmail },
		create: {
			id: isProduction ? randomUUID() : "dev-sortek-platform-admin",
			email: previewEmail,
			name: process.env.CRM_PREVIEW_WORKSPACE_NAME ?? "SORTEK preview",
			emailVerified: true,
			platformRole: PlatformRole.PLATFORM_ADMIN,
			updatedAt: new Date(),
		},
		update: { platformRole: PlatformRole.PLATFORM_ADMIN },
	});
	const workspace = await provisionPreviewWorkspace(user.id);
	const token = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1_000);
	await db.session.create({
		data: {
			id: randomUUID(),
			token,
			userId: user.id,
			expiresAt,
			activeOrganizationId: workspace?.id,
			updatedAt: new Date(),
		},
	});

	const signature = await sign(token, secret);
	const response = NextResponse.json({
		ok: true,
		organizationId: workspace?.id ?? null,
	});
	response.cookies.set({
		name: COOKIE_NAME,
		// Next serializes cookie values itself. Pre-encoding here would make
		// Better Auth receive a doubly encoded value and reject the signature.
		value: `${token}.${signature}`,
		expires: expiresAt,
		httpOnly: true,
		sameSite: "lax",
		secure: isProduction,
		path: "/",
	});
	return response;
}

async function provisionPreviewWorkspace(userId: string) {
	const name = process.env.CRM_PREVIEW_WORKSPACE_NAME?.trim();
	if (!name) return null;

	const slug = slugify(name);
	return db.$transaction(async (tx) => {
		const organization = await tx.organization.upsert({
			where: { slug },
			create: {
				id: randomUUID(),
				name,
				slug,
				createdAt: new Date(),
			},
			update: { name },
		});

		await tx.member.upsert({
			where: {
				organizationId_userId: {
					organizationId: organization.id,
					userId,
				},
			},
			create: {
				id: randomUUID(),
				organizationId: organization.id,
				userId,
				role: "owner",
				createdAt: new Date(),
			},
			update: { role: "owner" },
		});

		const pipelineStageCount = await tx.crmPipelineStage.count({
			where: { organizationId: organization.id },
		});
		if (pipelineStageCount === 0) {
			await tx.crmPipelineStage.createMany({
				data: DEFAULT_PIPELINE.map((stage) => ({
					organizationId: organization.id,
					...stage,
					isClosed: "isClosed" in stage ? stage.isClosed : false,
					isWon: "isWon" in stage ? stage.isWon : false,
				})),
			});
		}

		return organization;
	});
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function matchesSecret(submitted: string, configured: string) {
	const submittedBuffer = Buffer.from(submitted);
	const configuredBuffer = Buffer.from(configured);
	return (
		submittedBuffer.length === configuredBuffer.length &&
		timingSafeEqual(submittedBuffer, configuredBuffer)
	);
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
