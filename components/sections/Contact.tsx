import { LogoMark } from "@/components/brand/Logo";
import { BRAND } from "@/lib/content";
import { Magnetic } from "./Magnetic";

export function Contact() {
  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <div className="contact__main">
        <p className="eyebrow">Un doute ? Une question sur un diagnostic ou une étude ?</p>
        <h2 id="contact-title" className="contact__title">
          N’hésitez plus à prendre rendez-vous.
        </h2>
        <p className="contact__lead">
          Notre bureau d’études vous guide, répond à vos questions et vous aide à comprendre les obligations techniques
          ou administratives liées à votre projet. Devis personnalisé sous 24 à 48 h ouvrées.
        </p>
        <Magnetic>
          <a className="contact__cta" href={`mailto:${BRAND.email}?subject=Demande%20de%20diagnostic`} data-devis="">
            <span>Demander un diagnostic</span>
          </a>
        </Magnetic>
      </div>
      <dl className="contact__grid">
        <div>
          <dt>Téléphone</dt>
          <dd>
            <a href={BRAND.phoneHref}>{BRAND.phone}</a>
          </dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>
            <a href={BRAND.whatsappHref} target="_blank" rel="noopener noreferrer">
              Écrire sur WhatsApp
            </a>
          </dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>
            <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
          </dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>{BRAND.address}</dd>
        </div>
        <div>
          <dt>Horaires</dt>
          <dd>{BRAND.hours}</dd>
        </div>
        <div>
          <dt>Zone d’intervention</dt>
          <dd>Paris, petite et grande couronne</dd>
        </div>
      </dl>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <LogoMark className="site-footer__logo" />
        <span>
          {BRAND.name} — {BRAND.baseline}
        </span>
      </div>
      <nav className="site-footer__links" aria-label="Liens utiles">
        <a href={BRAND.legalHref}>Mentions légales</a>
        <a href={BRAND.privacyHref}>Politique de confidentialité</a>
      </nav>
      <p className="site-footer__credit">
        © 2026 {BRAND.name} · Site réalisé par{" "}
        <a href="https://digivibe.fr" target="_blank" rel="noopener noreferrer">
          Digivibe
        </a>
      </p>
    </footer>
  );
}
