"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isNavItemActive, type NavItem } from "@/lib/navigation";

function NavLink({ item, nested }: { item: NavItem; nested?: boolean }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item);

  return (
    <li>
      <Link
        href={item.href}
        prefetch={true}
        className={`sidebar-link ${nested ? "sidebar-link-nested" : ""} ${active ? "active" : ""}`}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const hideNav =
    pathname?.startsWith("/first-run") || pathname?.startsWith("/internal/alpha");

  return (
    <aside
      className={`app-sidebar${hideNav ? " app-sidebar-hidden" : ""}`}
      aria-hidden={hideNav || undefined}
      {...(hideNav ? { inert: true } : {})}
    >
      <div className="sidebar-brand">
        <div className="brand-mark">SP</div>
        <div>
          <h1>StorePilot AI</h1>
          <p>Decision-first commerce intelligence</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="sidebar-section">
            <p className="sidebar-section-label">{section.label}</p>
            <ul className="sidebar-links">
              {section.items.map((item) => (
                <div key={item.href}>
                  <NavLink item={item} />
                  {item.children && (
                    <ul className="sidebar-links sidebar-links-nested">
                      {item.children.map((child) => (
                        <NavLink key={child.href} item={child} nested />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-legal">
        <Link href="/privacy">Privacy Policy</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terms">Terms of Service</Link>
      </div>
    </aside>
  );
}
