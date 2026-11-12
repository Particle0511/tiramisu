export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>This screen is built in the next batch.</p>
    </div>
  );
}