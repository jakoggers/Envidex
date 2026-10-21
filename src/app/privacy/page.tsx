import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Envidex",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center gap-3 px-4 pt-10 pb-6">
        <Link
          href="/settings"
          className="h-9 w-9 rounded-full border border-border/60 bg-card/60 flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Privacy Policy
        </h1>
      </div>

      <div className="px-5 pb-12 max-w-prose">
        <p className="text-xs text-muted-foreground mb-8">Last updated: October 21, 2026</p>

        <Section title="Overview">
          <p>
            Envidex is an AI-powered species identification app. We take your privacy seriously and
            collect only what is necessary to provide the service. This policy explains what we
            collect, how we use it, and your rights.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <span className="font-medium text-foreground">Account information</span> — When you
            create an account, we store your name, email address, and a hashed version of your
            password. If you sign in with Google or GitHub, we store your name, email, and profile
            image provided by that service.
          </p>
          <p>
            <span className="font-medium text-foreground">Photos you choose to save</span> — By
            default, identification uses a local Keras classifier. Images are validated, EXIF/GPS
            stripped, and re-encoded before inference. When you tap Save private, the sanitized
            image and observation metadata are stored in a private filesystem store and MongoDB,
            accessible only through an authenticated media route. We do not upload new private
            observations to public Blob storage in this product pass.
          </p>
          <p>
            <span className="font-medium text-foreground">Optional external AI</span> — If you
            explicitly opt in to Anthropic identify and{" "}
            <span className="font-mono text-[11px]">ANTHROPIC_API_KEY</span> is configured, that
            photo is sent to Anthropic for analysis. This is never a silent fallback for the local
            model. If the key is missing, the feature reports unavailable.
          </p>
          <p>
            <span className="font-medium text-foreground">Field guide</span> — Saved observations
            are stored server-side under your account. UI preferences may be cached locally, keyed
            to your user id and cleared on sign-out.
          </p>
          <p>
            <span className="font-medium text-foreground">Session data</span> — We use JWT sessions
            with a server-side token version so password changes and account deletion revoke prior
            sessions.
          </p>
        </Section>

        <Section title="How we use your data">
          <p>We use your information only to:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Authenticate your account and keep you signed in</li>
            <li>Run local (or explicitly opted-in external) species identification</li>
            <li>Store and display your private field guide</li>
          </ul>
          <p>
            We do not sell your data, use it for advertising, or share it with any third party beyond
            what is described here.
          </p>
        </Section>

        <Section title="Inference disclosure">
          <p>
            Local model scores are raw classifier outputs and are not calibrated probabilities.
            Catalog facts come from curated records joined to model labels where names match;
            unmatched labels remain unknown / Not Evaluated and are never invented.
          </p>
        </Section>

        <Section title="Deletion limits">
          <p>
            Deleting an observation removes the private image and observation record when the
            request succeeds. Account deletion removes your user record, observations, media, and
            bumps session revocation. Legacy public share links created before this pass (if any)
            are not expanded in this product version; remediation of historical public Blob objects
            is tracked separately and is dry-run only.
          </p>
        </Section>

        <Section title="Data storage and security">
          <p>
            Your account data is stored in MongoDB. Passwords are hashed using bcrypt. Private images
            live on a non-public filesystem path served only through authenticated APIs. We use TLS
            for data in transit in deployed environments.
          </p>
        </Section>

        <Section title="Your rights">
          <p>You can at any time:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Update your name and email in Settings → Change information</li>
            <li>Delete individual observations from the field guide</li>
            <li>Delete your account in Settings (failures are shown; we do not pretend success)</li>
          </ul>
        </Section>

        <Section title="Cookies">
          <p>
            We use a session cookie to keep you signed in. We do not use tracking, analytics, or
            advertising cookies.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Envidex is not directed at children under 13. We do not knowingly collect personal
            information from children.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email us at{" "}
            <span className="text-primary">privacy@envidex.app</span>.
          </p>
        </Section>
      </div>
    </div>
  );
}
