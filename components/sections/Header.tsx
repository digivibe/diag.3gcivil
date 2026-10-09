import { LogoMark } from "@/components/brand/Logo";
import { SoundToggle } from "@/components/overlay/SoundToggle";
import { ThemeToggle } from "@/components/overlay/ThemeToggle";
import { BRAND } from "@/lib/content";

export function Header() {
  return (
    <header className="site-header">
      <a className="site-header__brand" href="#chapitre-hero" aria-label={`${BRAND.name} — accueil`}>
        <LogoMark className="site-header__logo" />
        <span className="site-header__name">{BRAND.name}</span>
        <span className="site-header__baseline">{BRAND.baseline}</span>
      </a>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <a href="#prestations">Prestations</a>
        <a href="#realisations">Réalisations</a>
        <a href="#faq">FAQ</a>
      </nav>
      <SoundToggle />
      <ThemeToggle />
      <a className="button button--small" href="#contact" data-devis="">
        <span className="label-long">Demander un diagnostic</span>
        <span className="label-short">Diagnostic</span>
      </a>
    </header>
  );
}
