import { BRAND, CHAPTERS } from "@/lib/content";

/**
 * Le texte de l'histoire, rendu côté serveur : il défile au-dessus du canvas fixe.
 * Chaque section = 100 vh d'entrée + un "hold" sticky pendant lequel l'effet 3D du chapitre se joue.
 */
export function Story() {
  const last = CHAPTERS.length - 1;
  return (
    <div id="story" className="story">
      {CHAPTERS.map((chapter, i) => {
        const Title = i === 0 ? "h1" : "h2";
        return (
          <section
            key={chapter.id}
            id={`chapitre-${chapter.id}`}
            className={`chapter chapter--${chapter.align}${i === 0 ? " chapter--hero" : ""}`}
            data-chapter={chapter.id}
            style={{ height: `${chapter.height}vh` }}
            aria-labelledby={`${chapter.id}-title`}
          >
            <div className="chapter__sticky">
              <div className="chapter__content">
                <p className="chapter__kicker" data-reveal="fade">
                  {chapter.kicker}
                </p>
                <Title id={`${chapter.id}-title`} className="chapter__title" data-reveal="lines">
                  {chapter.title}
                </Title>
                <p className="chapter__body" data-reveal="fade">
                  {chapter.body}
                </p>
                {chapter.tags.length > 0 && (
                  <ul className="chapter__tags" data-reveal="stagger">
                    {chapter.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
                {(i === 0 || i === last) && (
                  <div className="chapter__actions" data-reveal="stagger">
                    <a className="button button--primary" href="#contact">
                      Demander un diagnostic
                    </a>
                    {i === 0 ? (
                      <a className="button button--ghost" href="#prestations">
                        Nos prestations
                      </a>
                    ) : (
                      <a className="button button--ghost" href={BRAND.phoneHref}>
                        {BRAND.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
