import { Link } from "react-router-dom";
import { Film, Smartphone, Download, ShieldCheck, CheckCircle2, Calendar, HardDrive, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { androidAppConfig } from "@/config/androidApp";

/**
 * Dedicated Android app download page.
 *
 * All APK metadata (version, size, URL, features) is read from a single
 * config file: src/config/androidApp.ts. To ship a new APK, drop the new
 * file into public/downloads/ and bump the values in that config — no other
 * page needs to be edited.
 */
export const Download = () => {
  const app = androidAppConfig;

  // Small display helper for the metadata grid.
  const MetaRow = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) => (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Download BingeGuide Android App"
        description="Install the official BingeGuide Android app to track OTT releases, set reminders, and get personalized recommendations on the go."
        path="/download"
      />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Page header — logo + title */}
        <header className="flex flex-col items-center text-center mb-10">
          <Link to="/" className="flex items-center gap-2 mb-4" aria-label="BingeGuide home">
            <Film className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-hero-gradient bg-clip-text text-transparent">
              BingeGuide
            </span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Download BingeGuide for Android
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            The official BingeGuide Android app — discover, track and get
            reminders for the latest OTT releases, right from your phone.
          </p>
        </header>

        {/* Hero card: app icon + metadata + primary download button */}
        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* App icon (uses the same brand mark, styled as a rounded tile) */}
              <div
                className="h-28 w-28 rounded-2xl bg-hero-gradient flex items-center justify-center shrink-0 shadow-lg"
                aria-hidden="true"
              >
                <Film className="h-14 w-14 text-primary-foreground" />
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-foreground">{app.appName}</h2>
                  <Badge variant="secondary">v{app.version}</Badge>
                </div>
                <p className="text-muted-foreground mb-4">
                  OTT content tracker and reminder system.
                </p>

                {/* Primary download action — points at the configured APK URL.
                    Uses a plain anchor + `download` attribute so the browser
                    saves the file directly instead of navigating away. */}
                <Button asChild size="lg" className="w-full md:w-auto">
                  <a
                    href={app.apkUrl}
                    download={app.apkFilename}
                    aria-label={`Download ${app.appName} APK version ${app.version}`}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-5 w-5" />
                    Download APK ({app.fileSize})
                  </a>
                </Button>
              </div>
            </div>

            {/* App metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
              <MetaRow icon={Tag} label="Version" value={app.version} />
              <MetaRow icon={Calendar} label="Released" value={app.releaseDate} />
              <MetaRow icon={HardDrive} label="File Size" value={app.fileSize} />
              <MetaRow icon={Smartphone} label="Requires" value={app.minAndroidVersion} />
            </div>
          </CardContent>
        </Card>

        {/* Safety / authenticity notice */}
        <Alert className="mb-8 border-primary/40 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription>
            This is the <strong>official BingeGuide Android application</strong>.
            The APK is signed by the BingeGuide team and safe to install.
          </AlertDescription>
        </Alert>

        {/* Feature highlights */}
        <section className="mb-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-xl font-bold text-foreground mb-4">
            What's inside
          </h2>
          <ul className="space-y-3">
            {app.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Step-by-step install instructions */}
        <section aria-labelledby="install-heading">
          <h2 id="install-heading" className="text-xl font-bold text-foreground mb-4">
            Installation Instructions
          </h2>
          <Card>
            <CardContent className="p-6">
              <ol className="space-y-4">
                {[
                  "Tap the Download APK button above to save the file to your device.",
                  "Open the downloaded file from your notifications tray or Downloads folder.",
                  "If prompted, allow installation from this source in your device settings.",
                  "Tap Install, then launch BingeGuide and sign in to start tracking.",
                ].map((step, index) => (
                  <li key={step} className="flex items-start gap-4">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="text-foreground pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Download;
