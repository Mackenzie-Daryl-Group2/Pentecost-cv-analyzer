type UniversityBrandProps = {
  compact?: boolean;
};

export const PENTECOST_LOGO_URL = "https://pentvars.edu.gh/wp-content/themes/eduma-child/images/pentecost-university-logo-alt.png";

export default function UniversityBrand({ compact = false }: UniversityBrandProps) {
  return (
    <div className="university-brand" data-compact={compact}>
      <img src={PENTECOST_LOGO_URL} alt="Pentecost University logo" />
      {!compact && (
        <div>
          <strong>Pentecost University</strong>
          <span>Recruitment Portal</span>
        </div>
      )}
    </div>
  );
}
