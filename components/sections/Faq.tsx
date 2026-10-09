import { FAQ } from "@/lib/content";

export function Faq() {
  return (
    <section id="faq" className="section faq" aria-labelledby="faq-title">
      <header className="section__head">
        <p className="eyebrow">Quelques réponses aux questions les plus posées</p>
        <h2 id="faq-title" className="section__title">
          Foire aux questions
        </h2>
      </header>
      <div className="faq__list">
        {FAQ.map((item) => (
          <details key={item.q} className="faq__item">
            <summary className="faq__question">
              <span>{item.q}</span>
              <span className="faq__icon" aria-hidden="true" />
            </summary>
            <p className="faq__answer">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
