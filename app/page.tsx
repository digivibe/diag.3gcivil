import { Devis } from "@/components/devis/Devis";
import { Experience } from "@/components/experience/Experience";
import { Contact, Footer } from "@/components/sections/Contact";
import { Faq } from "@/components/sections/Faq";
import { Header } from "@/components/sections/Header";
import { Prestations } from "@/components/sections/Prestations";
import { Realisations } from "@/components/sections/Realisations";
import { Story } from "@/components/sections/Story";
import { BRAND, FAQ, PRESTATIONS } from "@/lib/content";

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: BRAND.name,
    description:
      "Bureau d'études structure spécialisé en diagnostics structurels, inspections techniques, expertises bâtiment et études d'exécution à Paris et en Île-de-France.",
    url: `${BRAND.url}/`,
    telephone: "+33667208052",
    email: BRAND.email,
    areaServed: ["Paris", "Île-de-France"],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Prestations",
      itemListElement: PRESTATIONS.map((item) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: `${item.title} – ${item.audience}` },
      })),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#prestations">
        Passer l’animation
      </a>
      <Header />
      <main>
        <Experience />
        <Story />
        <div className="content">
          <Prestations />
          <Realisations />
          <Faq />
          <Contact />
        </div>
      </main>
      <Footer />
      <Devis />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
