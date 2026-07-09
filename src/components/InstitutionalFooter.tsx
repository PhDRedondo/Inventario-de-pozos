"use client";

import Image from "next/image";
import Link from "next/link";
import { useT } from "@/context/AppPreferences";

const QUICK_LINK_GROUPS = [
  [
    { href: "https://www.anh.gov.co/es/anh-para-ninos", key: "footerLinkKids" },
    { href: "https://www.anh.gov.co/es/visor-ppaa", key: "footerLinkPpaa" },
    { href: "https://www.anh.gov.co/es/ley-de-transparencia", key: "footerLinkTransparency" },
  ],
  [
    { href: "https://www.anh.gov.co/es/convocatorias", key: "footerLinkTenders" },
    { href: "https://www.anh.gov.co/es/sigeth", key: "footerLinkSigeth" },
    { href: "https://www.anh.gov.co/es/mapa-de-tierras", key: "footerLinkLandMap" },
  ],
  [
    { href: "https://www.anh.gov.co/es/estrategia-territorial", key: "footerLinkTerritorial" },
    { href: "https://www.anh.gov.co/es/calendario-de-eventos", key: "footerLinkEvents" },
    { href: "https://www.anh.gov.co/es/geovisor-de-tierras", key: "footerLinkGeovisor" },
  ],
] as const;

const SOCIAL_LINKS = [
  { href: "https://twitter.com/ANHColombia", label: "X (Twitter)", icon: "x" },
  { href: "https://www.instagram.com/anhcolombia/", label: "Instagram", icon: "instagram" },
  { href: "https://www.facebook.com/ANHColombia", label: "Facebook", icon: "facebook" },
  { href: "https://www.linkedin.com/company/agencia-nacional-de-hidrocarburos/", label: "LinkedIn", icon: "linkedin" },
  { href: "https://www.youtube.com/user/ANHColombia", label: "YouTube", icon: "youtube" },
] as const;

function SocialIcon({ name }: { name: (typeof SOCIAL_LINKS)[number]["icon"] }) {
  const className = "h-4 w-4";

  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.2-1.5 1.5-1.5H17V4.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H8v3h2.3v8h3.2z" />
      </svg>
    );
  }

  if (name === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M6.5 8.5h3v11h-3v-11zM8 4.5a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zM12 8.5h2.9v1.5h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7V19.5h-3v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.3H12V8.5z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.8 2.8 0 00-2-2 28.5 28.5 0 00-9.6-.5 28.5 28.5 0 00-9.6.5 2.8 2.8 0 00-2 2 29.8 29.8 0 00-.5 5.3 29.8 29.8 0 00.5 5.3 2.8 2.8 0 002 2 28.5 28.5 0 009.6.5 28.5 28.5 0 009.6-.5 2.8 2.8 0 002-2 29.8 29.8 0 00.5-5.3 29.8 29.8 0 00-.5-5.3zM10 15.5V8.5l6.5 3.5L10 15.5z" />
    </svg>
  );
}

const LEGAL_LINKS = [
  { href: "https://www.anh.gov.co/es/politicas", key: "footerPolicies" },
  {
    href: "https://www.anh.gov.co/es/terminos-y-condiciones",
    key: "footerTermsFull",
  },
  { href: "https://www.anh.gov.co/es/sitemap", key: "footerSitemap" },
] as const;

function GovCoMark() {
  return (
    <svg viewBox="0 0 120 32" className="h-7 w-auto" aria-hidden>
      <rect x="0" y="4" width="28" height="20" rx="2" fill="#FCD116" />
      <rect x="0" y="4" width="28" height="10" fill="#003893" />
      <rect x="0" y="14" width="28" height="10" fill="#CE1126" />
      <text x="36" y="21" fill="currentColor" fontSize="18" fontWeight="700" fontFamily="Nunito Sans, sans-serif">
        gov.co
      </text>
    </svg>
  );
}

type InstitutionalFooterProps = {
  withMobileNavPadding?: boolean;
};

export function InstitutionalFooter({ withMobileNavPadding = false }: InstitutionalFooterProps) {
  const t = useT();

  return (
    <footer
      className={[
        "anh-institutional-footer mt-auto border-t border-anh-border",
        withMobileNavPadding ? "pb-[calc(var(--anh-mobile-nav-space)+env(safe-area-inset-bottom))] lg:pb-0" : "",
      ].join(" ")}
    >
      <div className="anh-gradient-bar" />

      <div className="anh-footer-body">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <nav aria-label={t("shell.footerQuickLinks")} className="mb-8 grid gap-4 sm:grid-cols-3">
            {QUICK_LINK_GROUPS.map((group, groupIndex) => (
              <ul key={groupIndex} className="space-y-2 text-sm">
                {group.map(({ href, key }) => (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-anh-secondary transition hover:underline"
                    >
                      {t(`shell.${key}`)}
                    </a>
                  </li>
                ))}
              </ul>
            ))}
          </nav>

          <div className="overflow-hidden rounded-2xl border border-anh-border bg-anh-surface shadow-sm">
            <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-8">
              <div className="min-w-0 text-sm leading-relaxed text-anh-muted">
                <p className="text-lg font-extrabold text-anh-primary">{t("shell.footerAgency")}</p>
                <p className="mt-4 font-bold text-anh-primary">{t("shell.footerHeadOffice")}</p>
                <p className="mt-2">{t("shell.footerAddress1")}</p>
                <p>{t("shell.footerAddress2")}</p>
                <p className="mt-1">{t("shell.footerPostal")}</p>
                <p className="mt-3">{t("shell.footerHours")}</p>

                <dl className="mt-4 space-y-1">
                  <div>
                    <dt className="inline font-semibold text-anh-primary">{t("shell.footerSwitchboard")}: </dt>
                    <dd className="inline">
                      <a href="tel:+576015931717" className="text-anh-secondary hover:underline">
                        (+57-601) 593 1717
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-anh-primary">{t("shell.footerTollFree")}: </dt>
                    <dd className="inline">
                      <a href="tel:018000953000" className="text-anh-secondary hover:underline">
                        (+57-01) 8000 953000
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-anh-primary">{t("shell.footerAnticorruption")}: </dt>
                    <dd className="inline">
                      <a href="tel:+576015931717" className="text-anh-secondary hover:underline">
                        (+57-601) 593 1717
                      </a>
                    </dd>
                  </div>
                </dl>

                <ul className="mt-4 space-y-1">
                  {(
                    [
                      { label: "footerEmailRadicacion", email: "correspondenciaanh@anh.gov.co" },
                      { label: "footerEmailPqrsd", email: "participacionciudadana@anh.gov.co" },
                      { label: "footerEmailJudicial", email: "notificacionesjudic2@anh.gov.co" },
                      { label: "footerEmailGender", email: "equidad.genero@anh.gov.co" },
                    ] as const
                  ).map(({ label, email }) => (
                    <li key={email}>
                      <span className="font-semibold text-anh-primary">{t(`shell.${label}`)}: </span>
                      <a href={`mailto:${email}`} className="text-anh-secondary break-all hover:underline">
                        {email}
                      </a>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-anh-muted">{t("shell.footerGop")}</p>
                <p>{t("shell.footerModule")}</p>
              </div>

              <div className="flex flex-col items-start gap-5 lg:items-end lg:text-right">
                <Image
                  src="/anh-logo.png"
                  alt={t("shell.logoAlt")}
                  width={180}
                  height={64}
                  className="h-14 w-auto sm:h-16"
                />
                <div>
                  <p className="mb-3 text-sm font-bold text-anh-primary">{t("shell.footerFollow")}</p>
                  <div className="flex flex-wrap gap-2">
                    {SOCIAL_LINKS.map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-anh-border bg-anh-bg text-anh-secondary transition hover:border-anh-secondary hover:bg-anh-secondary/10"
                      >
                        <SocialIcon name={icon} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-anh-border px-6 py-4 lg:px-8">
              <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
                {LEGAL_LINKS.map(({ href, key }) => (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-anh-secondary hover:underline"
                    >
                      {t(`shell.${key}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-anh-muted sm:text-sm">
            © {new Date().getFullYear()} {t("shell.footerCopyright")}
          </p>
        </div>
      </div>

      <div className="anh-footer-govco">
        <div className="anh-gradient-bar h-1" />
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 text-white sm:px-6">
          <Link
            href="https://www.gov.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 transition hover:opacity-90"
            aria-label={t("shell.footerGovCo")}
          >
            <GovCoMark />
          </Link>
          <p className="hidden text-sm text-white/90 sm:block">{t("shell.footerGovCo")}</p>
        </div>
      </div>
    </footer>
  );
}
