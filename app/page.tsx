import IdlePet from "@/app/components/IdlePet";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Rotagotchi Idle Preview
      </h1>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <IdlePet />
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Rendering <code>rot/idle.json</code> with <code>lottie-react</code>.
      </p>
    </main>
  );
}
