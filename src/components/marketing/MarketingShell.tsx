import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MARKETING_SITE_URL } from "@/lib/marketing/site";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site">
      <header className="marketing-header">
        <Link href="/" className="marketing-brand">
          <Image
            src="/images/logo.png"
            alt="StorePilot AI"
            width={40}
            height={40}
            priority
          />
          <span>StorePilot AI</span>
        </Link>
        <nav className="marketing-nav" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <main className="marketing-main">{children}</main>

      <footer className="marketing-footer">
        <p className="marketing-footer-brand">StorePilot AI</p>
        <nav className="marketing-footer-links" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="marketing-footer-copy">
          &copy; {new Date().getFullYear()} StorePilot AI.{" "}
          <a href={MARKETING_SITE_URL}>{MARKETING_SITE_URL.replace(/^https?:\/\//, "")}</a>
        </p>
      </footer>
    </div>
  );
}
