export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className={"brand" + (dark ? " dark" : "")}>
      <img src="/assets/3d/mini-protection-emblem.webp" alt="" width={28} height={34} />
      <span className="wordmark">Tiramisu</span>
    </div>
  );
}