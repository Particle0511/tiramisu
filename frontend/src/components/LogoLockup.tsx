export function LogoLockup({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return (
    <span className={"lockup" + (light ? " light" : "") + (small ? " sm" : "")}>
      <img src="/assets/3d/logo.png" alt="" />
      <span className="lockup-name">Tiramisu</span>
    </span>
  );
}