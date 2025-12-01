import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Github, Mail, MessageCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: t('footer.features'), href: "#features" },
      { name: t('footer.supportedPrinters'), href: "#printers" },
      { name: t('footer.pricing'), href: "/subscription" },
      { name: t('footer.api'), href: "#api" },
    ],
    company: [
      { name: t('footer.about'), href: "#about" },
      { name: t('footer.blog'), href: "#blog" },
      { name: t('footer.careers'), href: "#careers" },
      { name: t('footer.contact'), href: "#contact" },
    ],
    support: [
      { name: t('footer.documentation'), href: "#docs" },
      { name: t('footer.guides'), href: "#guides" },
      { name: t('footer.apiStatus'), href: "#status" },
      { name: t('footer.help'), href: "#help" },
    ],
    legal: [
      { name: t('footer.privacy'), href: "/privacy" },
      { name: t('footer.terms'), href: "/terms" },
      { name: t('footer.refund'), href: "/refund" },
    ],
  };

  const socialLinks = [
    { name: "GitHub", icon: Github, href: "https://github.com" },
    { name: "Email", icon: Mail, href: "mailto:factor@factor.io.kr" },
    { name: "Discord", icon: MessageCircle, href: "#discord" },
  ];

  return (
    <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-8">
          {/* 로고 및 설명 */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center space-x-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Activity className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-orbitron text-primary tracking-wide">
                  FACTOR
                </span>
                <span className="text-xs text-muted-foreground font-inter -mt-1">
                  3D PRINTER FARM
                </span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('footer.description')}
            </p>
          </div>

          {/* 제품 링크 */}
          <div>
            <h3 className="font-semibold text-sm mb-4">{t('footer.product')}</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 회사 링크 */}
          <div>
            <h3 className="font-semibold text-sm mb-4">{t('footer.company')}</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 지원 링크 */}
          <div>
            <h3 className="font-semibold text-sm mb-4">{t('footer.support')}</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 법적 고지 링크 */}
          <div>
            <h3 className="font-semibold text-sm mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* 사업자 정보 */}
        <div className="mb-6">
          <h4 className="font-semibold text-sm mb-3">{t('footer.businessInfo')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">{t('footer.ceo')}: </span>
              <span>{t('footer.ceoName')}</span>
            </div>
            <div>
              <span className="font-medium">{t('footer.businessNumber')}: </span>
              <span>{t('footer.businessNumberValue')}</span>
            </div>
            <div className="md:col-span-2">
              <span className="font-medium">{t('footer.address')}: </span>
              <span>{t('footer.addressValue')}</span>
            </div>
            <div>
              <span className="font-medium">{t('footer.phone')}: </span>
              <span>{t('footer.phoneValue')}</span>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* 하단 저작권 표시 */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-sm text-muted-foreground">
            © {currentYear} FACTOR 3D Printer Farm. {t('footer.allRightsReserved')}
          </p>

          {/* 소셜 링크 */}
          <div className="flex items-center space-x-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={social.name}
                >
                  <Icon className="w-5 h-5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};
