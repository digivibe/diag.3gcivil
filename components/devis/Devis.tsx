"use client";

import gsap from "gsap";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { emit, story } from "@/components/experience/story";
import { DEVIS_OPEN_EVENT, type DevisOpen } from "@/components/sections/devis-events";
import { playSound } from "@/components/sound/engine";
import { BRAND, DELAIS, MISSION_TYPES, ZONES } from "@/lib/content";
import { DEVIS_EMPTY, DEVIS_STEPS, devisMailto, validateDevis, type DevisData, type DevisErrors, type DevisField } from "@/lib/devis";
import { DOOR_OPENS_AT, devisState } from "./state";

const DevisScene = dynamic(() => import("./DevisScene"), { ssr: false });
/** Importer le module de la scène précharge aussi le modèle (au survol d'un appel à l'action). */
const preloadScene = () => void import("./DevisScene");

type SceneStatus = "loading" | "ready" | "failed";
type SendStatus = "idle" | "sending" | "sent" | "error";

/** Si le modèle tarde (réseau lent), le formulaire s'ouvre quand même au bout de ce délai (ms). */
const SCENE_TIMEOUT = 12000;
const LIGHTS_AT_NIGHT = 0.18;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])';
const LAST_STEP = DEVIS_STEPS.length - 1;

/** Focus sur le premier champ de l'étape (après son apparition : un élément masqué ne peut pas le recevoir). */
const focusFirstField = (container: HTMLElement | null) =>
  gsap.delayedCall(0.12, () => container?.querySelector<HTMLElement>(".devis__step input, .devis__step textarea")?.focus({ preventScroll: true }));

/** WebGL disponible ? Sinon le formulaire s'ouvre directement, sans la traversée en 3D. */
function supportsWebGL() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return gl !== null;
}

/** Pendant le formulaire : page inerte (clavier, lecteurs d'écran), défilement bloqué. */
function lockPage(locked: boolean) {
  document.documentElement.classList.toggle("is-devis", locked);
  document.querySelectorAll<HTMLElement>("body > :not(.devis):not(script)").forEach((element) => {
    element.inert = locked;
  });
  if (locked) story.lenis?.stop();
  else story.lenis?.start();
}

/**
 * Demande de diagnostic : un cercle s'ouvre depuis le bouton cliqué sur la rue, la caméra (animée dans
 * Blender) s'approche de l'immeuble, la porte cochère s'ouvre et le formulaire apparaît dans le hall.
 * Un étage par étape ; une fois la demande envoyée, la caméra ressort et les fenêtres s'allument.
 */
export function Devis() {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const isOpen = useRef(false);
  const closing = useRef(false);
  const flight = useRef<gsap.core.Timeline | null>(null);
  const focusError = useRef(false);
  const direction = useRef(1);

  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState<SceneStatus>("loading");
  const [arrived, setArrived] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DevisData>(DEVIS_EMPTY);
  const [errors, setErrors] = useState<DevisErrors>({});
  const [status, setStatus] = useState<SendStatus>("idle");
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Formulaire visible une fois la caméra arrivée dans le hall (tout de suite sans 3D ou sans animations).
  const revealed = open && (arrived || scene === "failed" || story.reducedMotion);

  // Ouverture : clic sur un [data-devis] (capture, avant les ancres gérées par Lenis) ou évènement devis:open.
  useEffect(() => {
    const start = (from: HTMLElement | null, type?: string) => {
      if (isOpen.current) return;
      isOpen.current = true;
      // Arrêté tout de suite : Lenis ignore alors le défilement vers l'ancre du lien cliqué.
      story.lenis?.stop();
      opener.current = from;
      const rect = from?.getBoundingClientRect();
      origin.current = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      devisState.p = 0;
      devisState.lights = LIGHTS_AT_NIGHT;
      setData((current) => (type ? { ...current, type } : current));
      setStep(0);
      setErrors({});
      setStatus("idle");
      setArrived(false);
      setScene(supportsWebGL() ? "loading" : "failed");
      setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-devis]");
      if (!target) return;
      event.preventDefault();
      start(target, target.dataset.devis || undefined);
    };
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<DevisOpen>).detail;
      start(detail?.from ?? null, detail?.type);
    };
    const onIntent = (event: Event) => {
      if ((event.target as Element | null)?.closest?.("[data-devis], .service__cta")) preloadScene();
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener(DEVIS_OPEN_EVENT, onRequest);
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(DEVIS_OPEN_EVENT, onRequest);
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, []);

  // Le cercle part du bouton cliqué ; posé avant le premier affichage (aucun éclair plein écran).
  useLayoutEffect(() => {
    const element = root.current;
    if (!open || !element) return;
    lockPage(true);
    emit("devis", true);
    playSound("enter");
    element.querySelector<HTMLElement>(".devis__close")?.focus({ preventScroll: true });
    const { x, y } = origin.current;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const tween = story.reducedMotion
      ? gsap.fromTo(element, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
      : gsap.fromTo(
          element,
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)`, duration: 1, ease: "expo.inOut" },
        );
    const fallback = window.setTimeout(() => setScene((current) => (current === "loading" ? "failed" : current)), SCENE_TIMEOUT);
    return () => {
      tween.kill();
      window.clearTimeout(fallback);
    };
  }, [open]);

  // La scène est prête : traversée de la rue jusqu'au hall (la porte s'ouvre en chemin), puis le formulaire.
  useEffect(() => {
    if (!open || scene === "loading" || closing.current) return;
    if (scene === "failed" || story.reducedMotion) {
      devisState.p = 1;
      return;
    }
    let door = false;
    const tl = gsap.timeline({ delay: 0.75 });
    tl.to(devisState, {
      p: 1,
      duration: 3.8,
      ease: "power2.inOut",
      onUpdate: () => {
        if (!door && devisState.p > DOOR_OPENS_AT) {
          door = true;
          playSound("door");
        }
      },
    });
    tl.call(() => setArrived(true), [], "-=0.9");
    flight.current = tl;
    return () => {
      tl.kill();
    };
  }, [open, scene]);

  // Apparition du formulaire, puis focus sur le premier champ.
  useLayoutEffect(() => {
    if (!revealed || !panel.current) return;
    const tl = gsap.timeline();
    tl.fromTo(panel.current, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: story.reducedMotion ? 0 : 0.8, ease: "expo.out" });
    if (!story.reducedMotion) {
      tl.from(panel.current.querySelectorAll(".devis__head > *, .devis__step > *, .devis__nav"), {
        y: 14,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      }, 0.15);
    }
    return () => {
      tl.kill();
    };
  }, [revealed]);

  // Changement d'étape : glissement dans le sens de la progression, focus sur le premier champ (ou la première erreur).
  useLayoutEffect(() => {
    const element = stepRef.current;
    if (!revealed || !element) return;
    if (!story.reducedMotion) {
      gsap.fromTo(element, { x: 26 * direction.current, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
    }
    const focus = focusError.current ? null : focusFirstField(element.parentElement);
    return () => {
      focus?.kill();
    };
  }, [step, revealed]);

  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, step]);

  const finish = useCallback(() => {
    lockPage(false);
    emit("devis", false);
    isOpen.current = false;
    closing.current = false;
    setOpen(false);
    setArrived(false);
    if (statusRef.current === "sent") setData(DEVIS_EMPTY);
    opener.current?.focus({ preventScroll: true });
  }, []);

  /** Fermeture : le formulaire s'efface, la caméra ressort (la porte se referme), le cercle se resserre sur le bouton. */
  const close = useCallback(() => {
    const element = root.current;
    if (!isOpen.current || closing.current || !element) return;
    closing.current = true;
    flight.current?.kill();
    playSound("exit");
    const { x, y } = origin.current;
    const tl = gsap.timeline({ onComplete: finish });
    if (story.reducedMotion) {
      tl.to(element, { autoAlpha: 0, duration: 0.25 });
      return;
    }
    if (panel.current) tl.to(panel.current, { autoAlpha: 0, y: 20, duration: 0.3, ease: "power2.in" });
    tl.to(devisState, { p: Math.min(devisState.p, 0.34), duration: 1.3, ease: "power2.inOut" }, 0.05);
    tl.to(element, { clipPath: `circle(0px at ${x}px ${y}px)`, duration: 0.85, ease: "expo.inOut" }, 0.55);
  }, [finish]);

  // Échap ferme ; Tab reste piégé dans la boîte de dialogue (écouté sur le document : le focus peut être sur <body>).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !root.current) return;
      const items = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = root.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Demande envoyée : le formulaire disparaît, le focus passe au bouton de retour.
  useEffect(() => {
    if (status === "sent") root.current?.querySelector<HTMLElement>(".devis__success button")?.focus({ preventScroll: true });
  }, [status]);

  const update = <K extends DevisField>(field: K, value: DevisData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const choose = (field: "type" | "zone" | "delai", value: string, index: number) => {
    update(field, value);
    playSound("step", { index });
  };

  const goTo = (next: number) => {
    direction.current = next > step ? 1 : -1;
    setStep(next);
  };

  const showErrors = (found: DevisErrors) => {
    focusError.current = true;
    setErrors(found);
    playSound("error");
  };

  /** Une fois la demande partie : la caméra ressort dans la rue et l'immeuble s'allume, fenêtre par fenêtre. */
  const celebrate = () => {
    playSound("success");
    if (story.reducedMotion) {
      devisState.lights = 1;
      return;
    }
    const tl = gsap.timeline();
    tl.to(devisState, { p: 0.04, duration: 4.2, ease: "power2.inOut" }, 0.5);
    tl.to(devisState, { lights: 1, duration: 3.4, ease: "power1.in" }, 1.6);
    flight.current = tl;
  };

  const submit = async () => {
    const found = validateDevis(data);
    if (Object.keys(found).length > 0) {
      const first = DEVIS_STEPS.findIndex((s) => s.fields.some((field) => found[field]));
      if (first !== step) goTo(first);
      showErrors(found);
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus("sent");
      celebrate();
    } catch {
      setStatus("error");
      playSound("error");
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step < LAST_STEP) {
      const found = validateDevis(data, step);
      if (Object.keys(found).length > 0) showErrors(found);
      else {
        setErrors({});
        goTo(step + 1);
      }
      return;
    }
    void submit();
  };

  if (!open) return null;

  const sent = status === "sent";
  const firstName = data.nom.trim().split(/\s+/)[0];
  const errorId = (field: DevisField) => `${id}-${field}-error`;
  const invalid = (field: DevisField) => (errors[field] ? { "aria-invalid": true, "aria-describedby": errorId(field) } : {});
  const errorText = (field: DevisField) =>
    errors[field] ? (
      <p id={errorId(field)} className="devis__error">
        {errors[field]}
      </p>
    ) : null;

  const choices = (field: "type" | "zone" | "delai", legend: string, options: readonly { value: string; hint?: string }[], layout: "cards" | "chips") => (
    <fieldset className={`devis__field devis__choices devis__choices--${layout}`}>
      <legend className="devis__label">{legend}</legend>
      <div className="devis__options">
        {options.map((option, index) => (
          <label key={option.value} className="devis__option">
            <input
              type="radio"
              name={`${id}-${field}`}
              value={option.value}
              checked={data[field] === option.value}
              onChange={() => choose(field, option.value, index)}
              {...(index === 0 ? invalid(field) : {})}
            />
            <span className="devis__option-title">{option.value}</span>
            {option.hint && <span className="devis__option-hint">{option.hint}</span>}
          </label>
        ))}
      </div>
      {errorText(field)}
    </fieldset>
  );

  return createPortal(
    <div
      ref={root}
      className="devis"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      data-scene={scene}
    >
      <div className="devis__stage" aria-hidden="true">
        <DevisScene onReady={() => setScene((current) => (current === "loading" ? "ready" : current))} />
        <div className="devis__veil" />
      </div>
      {scene === "loading" && (
        <p className="devis__loading" role="status">
          Ouverture du bâtiment<span className="devis__loading-bar" />
        </p>
      )}
      <button type="button" className="devis__close" onClick={close} aria-label="Fermer la demande" title="Fermer" data-sound="none">
        <span aria-hidden="true" />
      </button>

      <div ref={panel} className="devis__panel" data-status={status}>
        <header className="devis__head">
          <p className="devis__eyebrow">Demande de diagnostic · {BRAND.name}</p>
          <h2 id={`${id}-title`} className="devis__title">
            {sent ? "Demande envoyée" : DEVIS_STEPS[step].title}
          </h2>
          {!sent && (
            <ol className="devis__floors" aria-label="Étapes">
              {DEVIS_STEPS.map((s, index) => (
                <li key={s.floor} aria-current={index === step ? "step" : undefined} data-done={index < step || undefined}>
                  <span className="devis__floor">{s.floor}</span>
                  <span className="devis__floor-label">{s.title}</span>
                </li>
              ))}
            </ol>
          )}
        </header>

        {sent ? (
          <div className="devis__success" role="status">
            <p>
              Merci{firstName ? ` ${firstName}` : ""}, votre demande est bien arrivée. Nous revenons vers vous sous 24 à 48 h
              ouvrées avec un devis personnalisé.
            </p>
            <p className="devis__success-phone">
              Une urgence ? <a href={BRAND.phoneHref}>{BRAND.phone}</a>
            </p>
            <button type="button" className="button button--primary" onClick={close} data-sound="none">
              Revenir au site
            </button>
          </div>
        ) : (
          <form className="devis__form" noValidate onSubmit={onSubmit}>
            <div ref={stepRef} className="devis__step" key={step}>
              {step === 0 && (
                <>
                  {choices("type", "Type de mission", MISSION_TYPES, "cards")}
                  {choices("zone", "Où se trouve le bâtiment ?", ZONES.map((value) => ({ value })), "chips")}
                </>
              )}
              {step === 1 && (
                <>
                  {choices("delai", "Délai souhaité", DELAIS.map((value) => ({ value })), "chips")}
                  <div className="devis__field">
                    <label className="devis__label" htmlFor={`${id}-message`}>
                      Décrivez la situation
                    </label>
                    <textarea
                      id={`${id}-message`}
                      className="devis__input"
                      rows={4}
                      maxLength={4000}
                      placeholder="Fissures en façade, plancher qui fléchit, projet d’ouverture dans un mur porteur…"
                      value={data.message}
                      onChange={(event) => update("message", event.target.value)}
                      {...invalid("message")}
                    />
                    {errorText("message")}
                  </div>
                  <div className="devis__field">
                    <label className="devis__label" htmlFor={`${id}-adresse`}>
                      Adresse ou ville du bâtiment <span className="devis__optional">facultatif</span>
                    </label>
                    <input
                      id={`${id}-adresse`}
                      className="devis__input"
                      autoComplete="street-address"
                      maxLength={200}
                      value={data.adresse}
                      onChange={(event) => update("adresse", event.target.value)}
                    />
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="devis__field">
                    <label className="devis__label" htmlFor={`${id}-nom`}>
                      Nom
                    </label>
                    <input
                      id={`${id}-nom`}
                      className="devis__input"
                      autoComplete="name"
                      maxLength={120}
                      value={data.nom}
                      onChange={(event) => update("nom", event.target.value)}
                      {...invalid("nom")}
                    />
                    {errorText("nom")}
                  </div>
                  <div className="devis__row">
                    <div className="devis__field">
                      <label className="devis__label" htmlFor={`${id}-email`}>
                        E-mail
                      </label>
                      <input
                        id={`${id}-email`}
                        className="devis__input"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        maxLength={200}
                        value={data.email}
                        onChange={(event) => update("email", event.target.value)}
                        {...invalid("email")}
                      />
                      {errorText("email")}
                    </div>
                    <div className="devis__field">
                      <label className="devis__label" htmlFor={`${id}-telephone`}>
                        Téléphone <span className="devis__optional">facultatif</span>
                      </label>
                      <input
                        id={`${id}-telephone`}
                        className="devis__input"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={30}
                        value={data.telephone}
                        onChange={(event) => update("telephone", event.target.value)}
                        {...invalid("telephone")}
                      />
                      {errorText("telephone")}
                    </div>
                  </div>
                  <div className="devis__field">
                    <label className="devis__consent">
                      <input
                        type="checkbox"
                        checked={data.consent}
                        onChange={(event) => update("consent", event.target.checked)}
                        {...invalid("consent")}
                      />
                      <span>
                        J’accepte que ces informations soient utilisées pour traiter ma demande (
                        <a href={BRAND.privacyHref} target="_blank" rel="noopener noreferrer">
                          politique de confidentialité
                        </a>
                        ).
                      </span>
                    </label>
                    {errorText("consent")}
                  </div>
                  <div className="devis__trap" aria-hidden="true">
                    <label>
                      Site web
                      <input tabIndex={-1} autoComplete="off" value={data.website} onChange={(event) => update("website", event.target.value)} />
                    </label>
                  </div>
                </>
              )}
            </div>

            {status === "error" && (
              <div className="devis__alert" role="alert">
                L’envoi automatique n’a pas abouti. Votre demande est prête :{" "}
                <a href={devisMailto(data)}>l’envoyer depuis votre messagerie</a>, ou appelez-nous au{" "}
                <a href={BRAND.phoneHref}>{BRAND.phone}</a>.
              </div>
            )}

            <div className="devis__nav">
              {step > 0 && (
                <button type="button" className="button button--ghost" onClick={() => goTo(step - 1)}>
                  Retour
                </button>
              )}
              <button type="submit" className="button button--primary" disabled={status === "sending"}>
                {step < LAST_STEP ? "Continuer" : status === "sending" ? "Envoi…" : "Envoyer la demande"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
