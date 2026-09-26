export interface AppFooterProps {
  onShowAbout: () => void;
  onShowLicenseNotice: () => void;
}

export const AppFooter = ({
  onShowAbout,
  onShowLicenseNotice,
}: AppFooterProps) => {
  return (
    <div className="grid justify-center p-1 bg-base-200">
      <div>
        <span>&copy; 2026 menbou0202</span> -{" "}
        <a className="hover:text-primary hover:cursor-pointer" onClick={onShowAbout}>
          About Nape Console
        </a>{" "}
        -{" "}
        <a className="hover:text-primary hover:cursor-pointer" onClick={onShowLicenseNotice}>
          License NOTICE
        </a>
      </div>
    </div>
  );
};
