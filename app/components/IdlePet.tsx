"use client";

import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { useEffect, useMemo, useRef, useState } from "react";
import idleAnimation from "@/rot/idle.json";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

const debugAnimation = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 256,
  h: 256,
  nm: "Debug Dot",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Dot",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            { t: 0, s: [64, 128, 0], e: [192, 128, 0] },
            { t: 45, s: [192, 128, 0], e: [64, 128, 0] },
            { t: 90 }
          ]
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [40, 40] },
              d: 1,
              nm: "Dot Shape"
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.2, 0.8, 0.5, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              nm: "Dot Fill"
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: "Transform"
            }
          ],
          nm: "Dot Group",
          np: 2,
          cix: 2,
          bm: 0,
          ix: 1,
          mn: "ADBE Vector Group",
          hd: false
        }
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0
    }
  ],
  markers: []
};

type AnimationSource = "idle" | "debug";

export default function IdlePet() {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [source, setSource] = useState<AnimationSource>("idle");
  const [status, setStatus] = useState("init");
  const [currentFrame, setCurrentFrame] = useState<number | null>(null);
  const [svgCount, setSvgCount] = useState(0);
  const [pathCount, setPathCount] = useState(0);
  const [canvasCount, setCanvasCount] = useState(0);

  const animationData = source === "idle" ? idleAnimation : debugAnimation;

  const layerNames = useMemo(() => {
    if (!Array.isArray(animationData.layers)) {
      return "none";
    }

    return animationData.layers
      .slice(0, 6)
      .map((layer) => layer.nm ?? "unnamed")
      .join(", ");
  }, [animationData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      setSvgCount(container.querySelectorAll("svg").length);
      setPathCount(container.querySelectorAll("path").length);
      setCanvasCount(container.querySelectorAll("canvas").length);
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  const handleTogglePlayback = () => {
    if (!lottieRef.current) {
      return;
    }

    if (isPlaying) {
      lottieRef.current.pause();
      setIsPlaying(false);
      setStatus("paused");
      return;
    }

    lottieRef.current.play();
    setIsPlaying(true);
    setStatus("playing");
  };

  const handleRestart = () => {
    if (!lottieRef.current) {
      return;
    }

    lottieRef.current.goToAndPlay(0, true);
    setIsPlaying(true);
    setStatus("restarted");
  };

  const handleSpeedChange = (newSpeed: number) => {
    if (!lottieRef.current) {
      return;
    }

    lottieRef.current.setSpeed(newSpeed);
    setSpeed(newSpeed);
  };

  const handleSourceChange = (newSource: AnimationSource) => {
    setSource(newSource);
    setStatus(`source:${newSource}`);
    setCurrentFrame(null);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={containerRef} className="rounded bg-[#111]">
        <Lottie
          key={source}
          lottieRef={lottieRef}
          animationData={animationData}
          loop
          autoplay
          className="border border-zinc-800/40"
          style={{ width: 256, height: 256, display: "block" }}
          onDataReady={() => setStatus("data-ready")}
          onDataFailed={() => setStatus("data-failed")}
          onDOMLoaded={() => setStatus("dom-loaded")}
          onEnterFrame={() => {
            const rawFrame = lottieRef.current?.animationItem?.currentFrame;
            setCurrentFrame(typeof rawFrame === "number" ? rawFrame : null);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleTogglePlayback}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          onClick={handleRestart}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Restart
        </button>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          Speed
          <select
            value={speed}
            onChange={(event) => handleSpeedChange(Number(event.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => handleSourceChange("idle")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            source === "idle"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Source: idle.json
        </button>
        <button
          type="button"
          onClick={() => handleSourceChange("debug")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            source === "debug"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Source: debug dot
        </button>
      </div>

      <div className="w-full max-w-md rounded-md border border-zinc-800/50 bg-zinc-950/60 p-3 text-xs text-zinc-300">
        <p>Status: {status}</p>
        <p>Current frame: {currentFrame === null ? "n/a" : currentFrame.toFixed(1)}</p>
        <p>Source: {source}</p>
        <p>JSON version: {String(animationData.v ?? "n/a")}</p>
        <p>Layers: {Array.isArray(animationData.layers) ? animationData.layers.length : 0}</p>
        <p>Layer names: {layerNames}</p>
        <p>DOM svg count: {svgCount}</p>
        <p>DOM path count: {pathCount}</p>
        <p>DOM canvas count: {canvasCount}</p>
      </div>
    </div>
  );
}
