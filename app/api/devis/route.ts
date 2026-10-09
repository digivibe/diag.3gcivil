import { BRAND } from "@/lib/content";
import { devisSubject, devisText, parseDevis, validateDevis } from "@/lib/devis";

/**
 * Réception d'une demande de diagnostic : validation (mêmes règles que le formulaire), puis envoi
 * par e-mail via l'API HTTP de Resend. Variables d'environnement (voir .env.example) :
 *   RESEND_API_KEY    clé Resend ; absente → 503, le formulaire propose alors l'envoi par messagerie
 *   DEVIS_EMAIL_TO    destinataire (par défaut l'adresse du bureau d'études)
 *   DEVIS_EMAIL_FROM  expéditeur, sur un domaine vérifié chez Resend
 */
export async function POST(request: Request) {
  const data = parseDevis(await request.json().catch(() => null));
  if (!data) return Response.json({ error: "invalid" }, { status: 400 });
  // Champ piège rempli : réponse normale, rien n'est envoyé.
  if (data.website) return Response.json({ ok: true });
  const errors = validateDevis(data);
  if (Object.keys(errors).length > 0) return Response.json({ error: "invalid", errors }, { status: 422 });

  const key = process.env.RESEND_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.DEVIS_EMAIL_FROM ?? `${BRAND.name} <onboarding@resend.dev>`,
      to: [process.env.DEVIS_EMAIL_TO ?? BRAND.email],
      reply_to: data.email.trim(),
      subject: devisSubject(data),
      text: devisText(data),
    }),
  }).catch(() => null);

  if (!response?.ok) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true });
}
