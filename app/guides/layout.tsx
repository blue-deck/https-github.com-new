import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bd-site-shell">
      <PublicHeader />
      <div lang="tr" data-i18n-ignore>{children}</div>
      <PublicFooter />
    </div>
  );
}
