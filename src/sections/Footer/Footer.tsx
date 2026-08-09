import { useState } from "react";
import { type ImageWidget } from "~/types/widgets";
import Image from "~/components/ui/Image";
import Button from "~/components/ui/Button";
import Section from "../../components/ui/Section";

/** @titleBy title */
interface Item {
  title: string;
  href: string;
}

/** @titleBy title */
interface Link extends Item {
  children: Item[];
}

/** @titleBy alt */
interface Social {
  alt?: string;
  href?: string;
  image: ImageWidget;
}

interface Props {
  /** @description Text wordmark shown when no logo image is set */
  siteName?: string;
  /** @description Newsletter blurb under the wordmark — omit to hide the signup form */
  newsletterNote?: string;
  links?: Link[];
  social?: Social[];
  paymentMethods?: Social[];
  policies?: Item[];
  logo?: ImageWidget;
  trademark?: string;
}

function Newsletter({ siteName, note }: { siteName?: string; note?: string }) {
  // UI-only mock — no submit endpoint exists for this demo storefront.
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex flex-col gap-4 sm:max-w-xs">
      {siteName && (
        <span className="font-display text-lg text-ink uppercase tracking-(--tracking-label)">
          {siteName}
        </span>
      )}
      {note && <p className="text-sm text-muted">{note}</p>}
      {sent ? (
        <p className="text-sm text-ink">Thanks — you're on the list.</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) setSent(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-transparent px-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
          />
          <Button type="submit" variant="solid" size="md">
            Join
          </Button>
        </form>
      )}
    </div>
  );
}

function Footer({
  siteName,
  newsletterNote,
  links = [],
  social = [],
  policies = [],
  paymentMethods = [],
  logo,
  trademark,
}: Props) {
  return (
    <footer className="mt-10 border-t border-line bg-blush px-8">
      <div className="flex flex-col gap-8 py-10 sm:gap-10 sm:py-14">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <Newsletter siteName={siteName} note={newsletterNote} />

          <ul className="grid grid-flow-row gap-6 sm:grid-flow-col">
            {links.map(({ title, href, children }) => (
              <li key={href} className="flex flex-col gap-4">
                <a
                  className="font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase"
                  href={href}
                >
                  {title}
                </a>
                <ul className="flex flex-col gap-2">
                  {children.map(({ title, href }) => (
                    <li key={href}>
                      <a className="text-sm text-muted" href={href}>
                        {title}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {(social.length > 0 || paymentMethods.length > 0) && (
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center sm:gap-12">
            <ul className="flex gap-4">
              {social.map(({ image, href, alt }) => (
                <li key={href}>
                  <a href={href}>
                    <Image src={image} alt={alt} loading="lazy" width={20} height={20} />
                  </a>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-2">
              {paymentMethods.map(({ image, alt }) => (
                <li
                  key={alt}
                  className="frost flex h-8 w-10 items-center justify-center rounded-xs"
                >
                  <Image src={image} alt={alt} width={20} height={20} loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <hr className="w-full border-line" />

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-nowrap items-center gap-4">
            {logo && <img loading="lazy" src={logo} className="h-5 w-auto" />}
            <span className="text-xs text-muted">{trademark}</span>
          </div>

          <ul className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {policies.map(({ title, href }) => (
              <li key={href}>
                <a className="text-xs text-muted" href={href}>
                  {title}
                </a>
              </li>
            ))}
            <li>
              <a className="text-xs text-muted" href="/insights/catalog-gaps">
                Catalog gap signals
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export const LoadingFallback = () => <Section.Placeholder height="380px" />;

export default Footer;

export const eager = true;
export const sync = true;
export const layout = true;
