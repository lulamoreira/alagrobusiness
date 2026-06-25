export function AmbientGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl opacity-60" />
      <div className="absolute top-1/3 -right-32 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-3xl opacity-50" />
      <div className="absolute -bottom-40 left-1/3 h-[26rem] w-[26rem] rounded-full bg-emerald-500/10 blur-3xl opacity-40" />
    </div>
  );
}
